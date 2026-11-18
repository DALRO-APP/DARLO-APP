"""노션 첨부·원본·로컬 DB·고정 배포 seed를 대조하고 전후 추천을 재현한다.

cd server && .venv/bin/python -m dalro_api.audit_quality --evidence data/audit-2026-11-18 --output data/audit-2026-11-18/report
원본 DB는 읽기 전용으로 열고, seed는 별도 임시 DB에 복원한다.
"""
import argparse
import csv
import hashlib
import json
import sqlite3
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import shapefile
from sqlalchemy import create_engine

from . import pace
from .config import DEFAULT_DB
from .courses import PLACES, build_course
from .db import session_factory
from .demo_seed import SEED_PATH, restore_seed
from .graph import Overlay, RoadGraph
from .importer import ROADS_MEMBER, extract
from .quality_review import review_document
from .routing import loop_candidates

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_xlsx(path: Path) -> list[dict]:
    with zipfile.ZipFile(path) as archive:
        shared = ([] if "xl/sharedStrings.xml" not in archive.namelist() else
                  ["".join(n.itertext()).strip() for n in ET.fromstring(archive.read("xl/sharedStrings.xml"))])
        rows = []
        for node in ET.fromstring(archive.read("xl/worksheets/sheet1.xml")).findall(".//m:row", NS):
            row = {}
            for cell in node:
                value, inline = cell.find("m:v", NS), cell.find("m:is", NS)
                value = value.text if value is not None else "".join(inline.itertext()) if inline is not None else ""
                if cell.get("t") == "s":
                    value = shared[int(value)]
                row["".join(c for c in cell.get("r") if c.isalpha())] = str(value).strip()
            rows.append(row)
    return [{rows[0][key]: value for key, value in row.items()} for row in rows[1:]]


def courses(graph):
    overlay = Overlay(graph)
    start = graph.snap(PLACES[0][1], overlay)
    candidates = loop_candidates(overlay, start.node, 5000, .1)
    return [{"course": build_course(overlay, c, route_type="loop", time_of_day="day", start_label=PLACES[0][0]),
             "cost": c.cost, "selection_cost": c.selection_cost} for c in candidates]


def write_csv(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    raw = DEFAULT_DB.parent / "raw"
    review = review_document()
    missing = read_xlsx(args.evidence / "slope_missing_20.xlsx")
    final = read_xlsx(args.evidence / "DALRO_slope_missing_final_18.xlsx")
    ids = {r["osm_id"] for r in missing}
    with tempfile.TemporaryDirectory() as temp:
        temp = Path(temp)
        gpkg = extract(raw / "verified_yongsan_roads.zip", {ROADS_MEMBER}, temp)[ROADS_MEMBER]
        gpkg_sha = hashlib.sha256(gpkg.read_bytes()).hexdigest()
        assert gpkg_sha == review["source_gpkg_sha256"]
        with sqlite3.connect(gpkg.as_uri() + "?mode=ro", uri=True) as db:
            source_features = db.execute('select count(*) from yongsan_running_roads_final_verified').fetchone()[0]
            columns = [r[1] for r in db.execute('pragma table_info(yongsan_running_roads_final_verified)')]
        stats = extract(raw / "yongsan_slope_preprocessing.zip", {"도로 통계.dbf"}, temp)["도로 통계.dbf"]
        reader = shapefile.Reader(dbf=str(stats), encoding="cp949", encodingErrors="replace")
        names = [r[0] for r in reader.fields[1:]]
        stats_rows = [dict(zip(names, row)) for row in reader.iterRecords()]
        reader.close()
        null_ids = {r["osm_id"] for r in stats_rows if r["slope_mean"] is None}
        assert ids == null_ids and len(missing) == 20 and len(final) == 18
        assert {r["osm_id"] for r in final} == {r["osm_id"] for r in review["missing_slope_features"]}
        for name, key in [("slope_missing_20.xlsx", "missing20_xlsx_sha256"),
                          ("DALRO_slope_missing_final_18.xlsx", "final18_xlsx_sha256")]:
            assert hashlib.sha256((args.evidence / name).read_bytes()).hexdigest() == review["evidence"][key]
        assert hashlib.sha256(stats.read_bytes()).hexdigest() == review["evidence"]["slope_stats_dbf_sha256"]
        seed_db = restore_seed(SEED_PATH, temp)
        with sqlite3.connect(seed_db.as_uri() + "?mode=ro", uri=True) as db:
            seed_version = db.execute('select version from network_versions where is_active=1').fetchone()[0]
            seed_missing = db.execute('select count(*) from road_edges where slope_norm is null').fetchone()[0]
            fids = [r["source_fid"] for r in review["missing_slope_features"]]
            seed_affected = db.execute(
                'select edge_id, slope_deg, slope_norm from road_edges where source_fid in (' +
                ','.join('?' for _ in fids) + ')', fids).fetchall()
            assert len(seed_affected) == 42 and all(deg == norm == 0 for _, deg, norm in seed_affected)
        with sqlite3.connect(DEFAULT_DB.resolve().as_uri() + "?mode=ro", uri=True) as db:
            db.row_factory = sqlite3.Row
            network = dict(db.execute('select * from network_versions where is_active=1').fetchone())
            network["sources"], network["quality"] = json.loads(network["sources"]), json.loads(network["quality"])
            rows = [dict(r) for r in db.execute('select * from road_edges where version=?', (network["version"],))]
        engine = create_engine(f"sqlite:///file:{DEFAULT_DB.resolve()}?mode=ro&uri=true")
        with session_factory(engine)() as session:
            before = RoadGraph.load(session, apply_review=False)
            after = RoadGraph.load(session)
        after_by_id = {e.edge_id: e for e in after.edges}
        before_by_id = {e.edge_id: e for e in before.edges}
        feature_rows, edge_rows = [], []
        expected = {r["source_fid"]: r for r in review["missing_slope_features"]}
        for fid, item in expected.items():
            selected = [row for row in rows if row["source_fid"] == fid and row["osm_id"] == item["osm_id"]]
            assert selected and all(row["slope_deg"] == row["slope_norm"] == 0 for row in selected)
            feature_rows.append({"source_fid": fid, "osm_id": item["osm_id"], "name": item["name"],
                                 "split_edges": len(selected), "raw_slope_mean": 0, "raw_slope_norm": 0,
                                 "effective_slope_mean": "NULL", "effective_slope_norm": 1})
            for row in selected:
                edge = after_by_id[row["edge_id"]]
                assert edge.slope_pct is None
                assert abs(edge.penalty - pace.penalty(row["stop_norm"], 1)) < 1e-12
                edge_rows.append({"source_fid": fid, "osm_id": item["osm_id"], "edge_id": row["edge_id"],
                                  "length_m": row["length_m"], "before_penalty": before_by_id[row["edge_id"]].penalty,
                                  "after_penalty": edge.penalty, "after_slope_pct": "NULL", "allowed": edge.allowed})
        untouched_zero = [r for r in rows if r["slope_norm"] == 0 and r["source_fid"] not in expected]
        assert all(after_by_id[r["edge_id"]].slope_pct == 0 for r in untouched_zero)
        excluded = [{k: v for k, v in row.items() if k != "coordinates"} for row in review["blocked_edges"]]
        assert all(not after_by_id[row["edge_id"]].allowed for row in excluded)
        before_courses, after_courses = courses(before), courses(after)
        blocked_ids = {r["edge_id"] for r in excluded}
        assert blocked_ids.issubset(before_courses[1]["course"]["edge_ids"])
        assert all(not blocked_ids.intersection(c["course"]["edge_ids"]) for c in after_courses)
        assert abs(before_courses[1]["course"]["summary"]["distance_m"] - 4700) < 2
        with session_factory(create_engine(f"sqlite:///file:{seed_db}?mode=ro&uri=true"))() as s:
            seed_graph = RoadGraph.load(s)
            assert seed_graph.version == after.version and seed_graph.quality_review == after.quality_review
        payload = {"date": "2026-11-18", "base_network_version": network["version"],
                   "effective_network_version": after.version, "local_network": network,
                   "source_features": source_features, "slope_stats_features": len(stats_rows),
                   "original_missing_features": len(missing), "matched_features": len(feature_rows),
                   "matched_edges": len(edge_rows), "unmatched_osm_ids": sorted(ids - {r["osm_id"] for r in final}),
                   "normal_zero_edges_preserved": len(untouched_zero), "source_gpkg_sha256": gpkg_sha,
                   "notion_zip_matches_local": hashlib.sha256((args.evidence / "verified_yongsan_roads_notion.zip").read_bytes()).digest() == hashlib.sha256((raw / "verified_yongsan_roads.zip").read_bytes()).digest(),
                   "seed_base_version": seed_version, "seed_raw_null_count": seed_missing,
                   "seed_affected_zero_edges": len(seed_affected),
                   "health_after": {"data_version": after.version, "base_data_version": after.base_version,
                                    "quality_review": after.quality_review, "network_stats": after.stats},
                   "raw_fields": columns, "before": before_courses, "after": after_courses,
                   "before_edges": [{"edge_id": e.edge_id, "xy": e.xy, "allowed": e.allowed} for e in before.edges],
                   "blocked": review["blocked_edges"], "features": feature_rows, "edges": edge_rows}
        engine.dispose()
    (args.output / "audit.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    write_csv(args.output / "missing-slope-18-features.csv", feature_rows)
    write_csv(args.output / "missing-slope-42-edges.csv", edge_rows)
    write_csv(args.output / "excluded-4-edges.csv", excluded)
    geojson = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "LineString", "coordinates": row["coordinates"]},
         "properties": {k: v for k, v in row.items() if k != "coordinates"}} for row in review["blocked_edges"]]}
    (args.output / "excluded-4-edges.geojson").write_text(json.dumps(geojson, ensure_ascii=False, indent=2))
    (args.output / "audit.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(json.dumps({k: payload[k] for k in ["base_network_version", "effective_network_version", "source_features",
          "slope_stats_features", "original_missing_features", "matched_features", "matched_edges",
          "unmatched_osm_ids", "normal_zero_edges_preserved", "notion_zip_matches_local"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
