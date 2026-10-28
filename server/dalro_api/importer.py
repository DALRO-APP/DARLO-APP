"""노션 '데이터 저장소' zip → SQLite 도로망.

    python -m dalro_api.importer --raw data/raw

필요한 zip(노션 첨부 원본 이름 → data/raw 저장 이름):
  검증된_용산구_도로망.zip        → verified_yongsan_roads.zip      (도로·경사·신호·횡단보도 수)
  종설_기본망신호.zip             → base_network_signal.zip         (A057_L 부착대, A004_A 횡단보도 원본)
  가로등공원_데이터_전처리.zip    → streetlight_park_preprocessing.zip (용산구 가로등 포인트)
  cost.zip                        → cost.zip                        (선택: 팀 stop_norm 대조)
"""

import argparse
import hashlib
import logging
import re
import sqlite3
import tempfile
import unicodedata
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
import shapefile
import shapely
from shapely.geometry import shape as geo_shape
from sqlalchemy import delete, insert, update
from sqlalchemy.orm import Session

from . import pace
from .config import FACILITY_BUFFER_M, NON_WALKABLE_FCLASS
from .db import init_db, make_engine, session_factory
from .geo import gpkg_geometry, to_lonlat, to_xy
from .models import Base, Facility, NetworkVersion, Place, RoadEdge, RoadNode, ServiceArea

NETWORK_TABLES = (Place, ServiceArea, Facility, RoadEdge, RoadNode, NetworkVersion)

ROADS_ZIP = "verified_yongsan_roads.zip"
ROADS_MEMBER = "yongsan_running_roads_final_verified.gpkg"
ROADS_TABLE = "yongsan_running_roads_final_verified"
SIGNAL_ZIP = "base_network_signal.zip"
LIGHT_ZIP = "streetlight_park_preprocessing.zip"
LIGHT_MEMBER = "yongsan_preprocessing.gpkg"
LIGHT_TABLE = "yongsan_streetlight_5186"
COST_ZIP = "cost.zip"


def _member_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if not info.flag_bits & 0x800:
        raw = name.encode("cp437")
        for encoding in ("utf-8", "cp949"):
            try:
                name = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
    return unicodedata.normalize("NFC", name)


def extract(zip_path: Path, wanted: set[str], target: Path) -> dict[str, Path]:
    """파일 이름(경로 제외)으로 필요한 멤버만 꺼낸다. 한글 cp437/UTF-8 이름을 처리한다."""
    found: dict[str, Path] = {}
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            base = _member_name(info).rsplit("/", 1)[-1]
            if base in wanted:
                out = target / base
                out.write_bytes(archive.read(info))
                found[base] = out
    missing = wanted - found.keys()
    if missing:
        raise FileNotFoundError(f"{zip_path.name}에 {sorted(missing)}가 없습니다.")
    return found


@dataclass
class Feature:
    fid: int
    osm_id: str | None
    fclass: str
    name: str | None
    layer: int
    bridge: bool
    tunnel: bool
    signal_cnt: int
    cross_cnt: int
    length_m: float
    slope_deg: float | None
    slope_norm: float | None
    parts: list[list[tuple[float, float]]]


def read_features(gpkg: Path) -> list[Feature]:
    con = sqlite3.connect(f"file:{gpkg}?mode=ro", uri=True)
    rows = con.execute(
        f'select fid, geom, osm_id, fclass, name, layer, bridge, tunnel, signal_cnt, '
        f'cross_cnt, length_m, slope_mean, slope_norm from "{ROADS_TABLE}" order by fid'
    ).fetchall()
    con.close()
    features = []
    for fid, blob, osm_id, fclass, name, layer, bridge, tunnel, sig, cross, length, slope, slope_n in rows:
        geom = gpkg_geometry(blob)
        lines = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
        features.append(
            Feature(
                fid=int(fid),
                osm_id=osm_id,
                fclass=fclass or "unknown",
                name=(name or "").strip() or None,
                layer=int(layer or 0),
                bridge=bridge == "T",
                tunnel=tunnel == "T",
                # 팀 결합 결과의 NULL은 '버퍼 안 시설 없음'을 뜻하므로 0이 측정값이다.
                signal_cnt=int(sig or 0),
                cross_cnt=int(cross or 0),
                length_m=float(length),
                slope_deg=None if slope is None else float(slope),
                slope_norm=None if slope_n is None else float(slope_n),
                parts=[[(float(x), float(y)) for x, y, *_ in line.coords] for line in lines],
            )
        )
    return features


def _key(point: tuple[float, float]) -> tuple[int, int]:
    return round(point[0] * 1000), round(point[1] * 1000)  # mm 단위 일치


def split_network(features: list[Feature]):
    """OSM 선형을 공유 꼭짓점(교차점)에서 나눈다. 높이가 다른 고가·지하 도로는
    꼭짓점을 공유하지 않으므로 평면 교차만으로 연결되지 않는다."""
    usage: Counter = Counter()
    for feature in features:
        for part in feature.parts:
            for index, point in enumerate(part):
                usage[_key(point)] += 2 if index in (0, len(part) - 1) else 1
    segments = []
    for feature in features:
        sequence = 0
        for part in feature.parts:
            cut = [i for i, p in enumerate(part) if i in (0, len(part) - 1) or usage[_key(p)] >= 2]
            for start, end in zip(cut, cut[1:]):
                coords = part[start : end + 1]
                length = shapely.LineString(coords).length
                if length <= 0:
                    continue
                segments.append((feature, f"{feature.fid}-{sequence}", coords, float(length)))
                sequence += 1
    keys = sorted({_key(s[2][0]) for s in segments} | {_key(s[2][-1]) for s in segments})
    node_ids = {key: f"n{index}" for index, key in enumerate(keys)}
    return segments, node_ids


def read_facilities(raw: Path, tmp: Path, bounds: tuple[float, float, float, float]):
    minx, miny, maxx, maxy = bounds
    box = shapely.box(minx - 50, miny - 50, maxx + 50, maxy + 50)
    files = extract(
        raw / SIGNAL_ZIP,
        {f"{stem}.{ext}" for stem in ("A057_L", "A004_A") for ext in ("shp", "shx", "dbf", "prj")},
        tmp,
    )
    facilities: list[tuple[str, str | None, shapely.Geometry]] = []
    # 내부 고리만 있는 횡단보도 폴리곤 4개를 외곽 고리로 읽는다는 경고. 결과에는 영향 없다.
    logging.getLogger("shapefile").setLevel(logging.ERROR)
    for stem, kind in (("A057_L", "signal"), ("A004_A", "crosswalk")):
        reader = shapefile.Reader(str(files[f"{stem}.shp"])[:-4], encoding="euc-kr")
        mgr_index = [f[0] for f in reader.fields[1:]].index("MGRNU")
        for item in reader.iterShapeRecords():
            geom = geo_shape(item.shape.__geo_interface__)
            if geom.intersects(box):
                facilities.append((kind, item.record[mgr_index], geom))
        reader.close()
    light = extract(raw / LIGHT_ZIP, {LIGHT_MEMBER}, tmp)[LIGHT_MEMBER]
    con = sqlite3.connect(f"file:{light}?mode=ro", uri=True)
    # 이 레이어의 SRS 정의가 비어 있어(99999) 함께 제공된 위도·경도를 변환해 쓴다.
    rows = con.execute(f'select "관리번호", "경도", "위도" from "{LIGHT_TABLE}"').fetchall()
    con.close()
    points = to_xy([(float(lon), float(lat)) for _, lon, lat in rows])
    for (manager, _, _), (x, y) in zip(rows, points):
        facilities.append(("streetlight", manager, shapely.Point(x, y)))
    return facilities


SERVICE_AREA_NAME = "용산구"


def read_districts(raw: Path, tmp: Path) -> dict[str, shapely.Geometry]:
    """서울 25개 자치구 경계(EPSG:5186)."""
    stem = "seoul_district_boundary_5186"
    files = extract(raw / SIGNAL_ZIP, {f"{stem}.{ext}" for ext in ("shp", "shx", "dbf", "prj")}, tmp)
    reader = shapefile.Reader(str(files[f"{stem}.shp"])[:-4], encoding="utf-8", encodingErrors="replace")
    names = [f[0] for f in reader.fields[1:]]
    try:
        return {
            item.record[names.index("SIGUNGU_NM")]: shapely.make_valid(geo_shape(item.shape.__geo_interface__))
            for item in reader.iterShapeRecords()
        }
    finally:
        reader.close()


Point = tuple[float, float]


def read_parks(tmp: Path, area: shapely.Geometry) -> list[tuple[str, Point]]:
    """서울 공원 이름과 대표점. 용산구와 겹치는 공원은 구 안의 점을 쓴다."""
    con = sqlite3.connect(f"file:{tmp / LIGHT_MEMBER}?mode=ro", uri=True)
    rows = con.execute('select "LABEL", geom from seoul_parks_5186 where "LABEL" is not null').fetchall()
    con.close()
    parks: dict[str, Point] = {}
    for label, blob in rows:
        label = label.strip()
        geom = shapely.make_valid(gpkg_geometry(blob))
        inside = geom.intersection(area)
        point = (inside if not inside.is_empty else geom).representative_point()
        if label not in parks or not inside.is_empty:
            parks[label] = (point.x, point.y)
    return sorted(parks.items())


def read_seoul_roads(raw: Path, tmp: Path) -> list[tuple[str, Point]]:
    """서울 전체 도로명마다 가장 긴 피처의 중간점. 용산구 밖 장소 검색용."""
    stem = "seoul_running_roads"
    files = extract(raw / SIGNAL_ZIP, {f"{stem}.{ext}" for ext in ("shp", "shx", "dbf", "prj")}, tmp)
    reader = shapefile.Reader(str(files[f"{stem}.shp"])[:-4], encoding="utf-8", encodingErrors="replace")
    name_index = [f[0] for f in reader.fields[1:]].index("name")
    longest: dict[str, tuple[float, shapely.Geometry]] = {}
    try:
        for item in reader.iterShapeRecords():
            name = (item.record[name_index] or "").strip()
            if not name or ASCII_NAME.fullmatch(name):
                continue
            geom = geo_shape(item.shape.__geo_interface__)
            if name not in longest or geom.length > longest[name][0]:
                longest[name] = (geom.length, geom)
    finally:
        reader.close()
    out = []
    for name, (_, geom) in sorted(longest.items()):
        point = geom.interpolate(0.5, normalized=True)
        out.append((name, (point.x, point.y)))
    return out


def road_places(edge_rows: list[dict]) -> list[tuple[str, Point]]:
    """도로명마다 가장 긴 통행 가능 구간의 중간점."""
    longest: dict[str, dict] = {}
    for row in edge_rows:
        name = row["name"]
        if row["walkable"] and name and (name not in longest or row["length_m"] > longest[name]["length_m"]):
            longest[name] = row
    out = []
    for name, row in sorted(longest.items()):
        point = shapely.LineString(row["coords_xy"]).interpolate(0.5, normalized=True)
        out.append((name, (point.x, point.y)))
    return out


def count_near(lines: np.ndarray, facilities, kind: str) -> np.ndarray:
    geoms = [g for k, _, g in facilities if k == kind]
    if not geoms:
        return np.zeros(len(lines), dtype=int)
    tree = shapely.STRtree(geoms)
    buffers = shapely.buffer(lines, FACILITY_BUFFER_M)
    hits = tree.query(buffers, predicate="intersects")
    return np.bincount(hits[0], minlength=len(lines))


def components(edges: list[tuple[str, str]]) -> dict[str, int]:
    parent: dict[str, str] = {}

    def find(node: str) -> str:
        parent.setdefault(node, node)
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    roots = {node: find(node) for node in parent}
    sizes = Counter(roots.values())
    order = {root: index for index, (root, _) in enumerate(sizes.most_common())}
    return {node: order[root] for node, root in roots.items()}


ASCII_NAME = re.compile(r"[A-Za-z0-9 .,'&()/-]+")
# 영문 표기지만 기지 밖 공공 도로인 이름
PUBLIC_ASCII_NAMES = {"UN village 3-gil", "Hoenamu-ro 44da-gil", "Bike Path"}


def restricted_area(segments) -> shapely.Geometry | None:
    """용산 미군기지 내부 도로(OSM 영문 도로명)의 오목 껍질.

    OSM 원본의 access 태그가 SHP 변환에서 빠져 기지 안 도로도 일반 도로처럼 들어왔다.
    영문 도로명 구간을 60m 버퍼로 묶은 덩어리마다 concave hull(ratio 0.2)을 만든다.
    한글 이름 공공 도로는 이 영역 안에 있어도 제외하지 않는다."""
    lines = [
        shapely.LineString(coords)
        for feature, _, coords, _ in segments
        if feature.name and ASCII_NAME.fullmatch(feature.name) and feature.name not in PUBLIC_ASCII_NAMES
    ]
    if not lines:
        return None
    merged = shapely.union_all([line.buffer(60) for line in lines])
    clusters = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    hulls = [
        shapely.concave_hull(shapely.MultiLineString([l for l in lines if l.intersects(c)]), ratio=0.2)
        for c in clusters
    ]
    return shapely.union_all(hulls).buffer(5)


def compare_cost_zip(raw: Path, tmp: Path, features: list[Feature], stop_norms: list[float]):
    path = raw / COST_ZIP
    if not path.exists():
        return None
    files = extract(path, {"yongsan_running_roads_final.dbf"}, tmp)
    reader = shapefile.Reader(
        dbf=open(files["yongsan_running_roads_final.dbf"], "rb"), encoding="cp949", encodingErrors="replace"
    )
    names = [f[0] for f in reader.fields[1:]]
    rows = list(reader.iterRecords())
    reader.close()
    # cost.zip의 fid는 서울 전체 번호다. 같은 행 순서에서 osm_id·길이가 같은 행만 대조한다.
    diffs = [
        abs(float(row[names.index("stop_norm")]) - mine)
        for row, feature, mine in zip(rows, features, stop_norms)
        if row[names.index("osm_id")] == feature.osm_id
        and abs(float(row[names.index("length_m")]) - feature.length_m) < 0.02
    ]
    return {
        "compared": len(diffs),
        "max_abs_diff": round(max(diffs), 4) if diffs else None,
        "within_0_001": sum(d <= 0.001 for d in diffs),
    }


def import_network(raw: Path, session: Session) -> NetworkVersion:
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        gpkg = extract(raw / ROADS_ZIP, {ROADS_MEMBER}, tmp)[ROADS_MEMBER]
        digest = hashlib.sha256(gpkg.read_bytes()).hexdigest()[:8]
        version = f"yongsan-verified-{digest}"
        features = read_features(gpkg)
        stop_dens = [pace.stop_density(f.signal_cnt, f.cross_cnt, f.length_m) for f in features]
        stop_norms = pace.normalize_stop_density(stop_dens)
        by_fid = {f.fid: (den, norm) for f, den, norm in zip(features, stop_dens, stop_norms)}
        segments, node_ids = split_network(features)
        lines = np.array([shapely.LineString(s[2]) for s in segments], dtype=object)
        bounds = tuple(shapely.total_bounds(lines))
        facilities = read_facilities(raw, tmp, bounds)
        counts = {k: count_near(lines, facilities, k) for k in ("signal", "crosswalk", "streetlight")}
        cost_check = compare_cost_zip(raw, tmp, features, stop_norms)
        districts = read_districts(raw, tmp)
        service_area = districts[SERVICE_AREA_NAME]
        parks = read_parks(tmp, service_area)
        seoul_roads = read_seoul_roads(raw, tmp)
    area = restricted_area(segments)
    restricted = (
        np.zeros(len(lines), dtype=bool)
        if area is None
        else shapely.within(lines, area)
        & np.array([not (f.name and not ASCII_NAME.fullmatch(f.name)) for f, _, _, _ in segments])
    )

    node_xy = {}
    for _, _, coords, _ in segments:
        for point in (coords[0], coords[-1]):
            node_xy[node_ids[_key(point)]] = point
    node_list = sorted(node_xy.items(), key=lambda item: int(item[0][1:]))
    node_lonlat = to_lonlat([xy for _, xy in node_list])
    edge_rows = []
    for index, (feature, edge_id, coords, length) in enumerate(segments):
        lonlat = to_lonlat(coords)
        den, norm = by_fid[feature.fid]
        edge_rows.append(
            dict(
                version=version,
                edge_id=edge_id,
                source_fid=feature.fid,
                osm_id=feature.osm_id,
                from_node=node_ids[_key(coords[0])],
                to_node=node_ids[_key(coords[-1])],
                length_m=round(length, 2),
                fclass=feature.fclass,
                name=feature.name,
                layer=feature.layer,
                bridge=feature.bridge,
                tunnel=feature.tunnel,
                walkable=feature.fclass not in NON_WALKABLE_FCLASS and not restricted[index],
                access_note=(
                    "용산 미군기지 내부 추정(출입 제한)"
                    if restricted[index]
                    else ("러너 통행 불가 도로 유형" if feature.fclass in NON_WALKABLE_FCLASS else None)
                ),
                feature_signal_cnt=feature.signal_cnt,
                feature_cross_cnt=feature.cross_cnt,
                feature_length_m=feature.length_m,
                slope_deg=feature.slope_deg,
                slope_norm=feature.slope_norm,
                stop_den=den,
                stop_norm=norm,
                signal_cnt=int(counts["signal"][index]),
                cross_cnt=int(counts["crosswalk"][index]),
                light_cnt=int(counts["streetlight"][index]),
                coords_lonlat=[list(p) for p in lonlat],
                coords_xy=[[round(x, 3), round(y, 3)] for x, y in coords],
            )
        )
    # 노드 좌표와 선형 끝점이 정확히 같도록 맞춘다.
    lonlat_by_node = {node: lonlat for (node, _), lonlat in zip(node_list, node_lonlat)}
    for row in edge_rows:
        row["coords_lonlat"][0] = list(lonlat_by_node[row["from_node"]])
        row["coords_lonlat"][-1] = list(lonlat_by_node[row["to_node"]])

    walkable_edges = [(r["from_node"], r["to_node"]) for r in edge_rows if r["walkable"]]
    component = components(walkable_edges)
    main_nodes = {n for n, c in component.items() if c == 0}
    main_length = sum(r["length_m"] for r in edge_rows if r["walkable"] and r["from_node"] in main_nodes)
    total_length = sum(r["length_m"] for r in edge_rows)
    quality = {
        "source_feature_count": len(features),
        "multipart_feature_count": sum(len(f.parts) > 1 for f in features),
        "walkable_edge_count": len(walkable_edges),
        "restricted_base_edge_count": int(restricted.sum()),
        "restricted_base_area_km2": None if area is None else round(area.area / 1e6, 2),
        "component_count": len(set(component.values())),
        "main_component_length_ratio": round(main_length / total_length, 4),
        "total_length_km": round(total_length / 1000, 2),
        "fclass_counts": dict(Counter(r["fclass"] for r in edge_rows).most_common()),
        "facility_counts": dict(Counter(k for k, _, _ in facilities)),
        "slope_unit": "slope_mean은 도(°). 경사.tif를 DEM에서 다시 계산해 확인했고 앱에는 tan(°)×100 %로 보낸다.",
        "team_stop_norm_check": cost_check,
        "service_area": f"{SERVICE_AREA_NAME} 행정경계 {service_area.area / 1e6:.2f}km²",
    }
    # 검색 색인. 용산구 도로는 탐색망 위의 점을, 구 밖 도로·공원·자치구는 베타 범위 안내용 위치를 쓴다.
    yongsan_roads = road_places(edge_rows)
    known = {name for name, _ in yongsan_roads}
    places = [(name, "도로", xy) for name, xy in yongsan_roads]
    places += [(name, "도로", xy) for name, xy in seoul_roads if name not in known]
    places += [(name, "공원", xy) for name, xy in parks]
    places += [(name, "자치구", (g.representative_point().x, g.representative_point().y)) for name, g in sorted(districts.items())]
    place_lonlat = to_lonlat([xy for _, _, xy in places])
    district_names = list(districts)
    district_tree = shapely.STRtree(list(districts.values()))
    place_points = shapely.points([xy for _, _, xy in places])
    nearest = district_tree.query_nearest(place_points, max_distance=500, all_matches=False)
    place_district = dict(zip(nearest[0].tolist(), nearest[1].tolist()))

    session.execute(delete(Place))
    session.execute(delete(ServiceArea))
    session.execute(delete(Facility))
    session.execute(delete(RoadEdge))
    session.execute(delete(RoadNode))
    session.execute(delete(NetworkVersion))
    session.add(
        NetworkVersion(
            version=version,
            region="서울 용산구",
            source_crs="EPSG:5186",
            sources=SOURCES,
            edge_count=len(edge_rows),
            node_count=len(node_list),
            quality=quality,
            is_active=True,
        )
    )
    session.flush()
    session.execute(
        insert(RoadNode),
        [
            dict(version=version, node_id=node, lon=lonlat[0], lat=lonlat[1], x=xy[0], y=xy[1])
            for (node, xy), lonlat in zip(node_list, node_lonlat)
        ],
    )
    session.execute(insert(RoadEdge), edge_rows)
    session.execute(
        insert(Facility),
        [dict(version=version, kind=k, source_id=s, wkb=shapely.to_wkb(g)) for k, s, g in facilities],
    )
    session.add(ServiceArea(version=version, name=f"서울 {SERVICE_AREA_NAME}", wkb=shapely.to_wkb(service_area)))
    session.execute(
        insert(Place),
        [
            dict(
                version=version,
                name=name,
                category=category,
                address="서울 " + district_names[place_district[i]] if i in place_district else "서울 밖",
                lon=lonlat[0],
                lat=lonlat[1],
            )
            for i, ((name, category, _), lonlat) in enumerate(zip(places, place_lonlat))
        ],
    )
    session.execute(update(NetworkVersion).where(NetworkVersion.version != version).values(is_active=False))
    session.commit()
    return session.get(NetworkVersion, version)


SOURCES = [
    {
        "layer": "roads",
        "source": "노션 데이터 저장소 · 검증된_용산구_도로망.zip / yongsan_running_roads_final_verified.gpkg (김유진·김시원·유경수 전처리, OSM 기반)",
        "license": "OpenStreetMap ODbL · 팀 전처리",
    },
    {
        "layer": "signal",
        "source": "종설_기본망신호.zip / 서울시 교통안전시설물 부착대 A057_L (신호등 개수가 아닌 부착대)",
        "license": "서울시 공공데이터 · 이용조건 팀 확인 필요",
    },
    {
        "layer": "crosswalk",
        "source": "종설_기본망신호.zip / 서울시 교통안전시설물 횡단보도 A004_A",
        "license": "서울시 공공데이터 · 이용조건 팀 확인 필요",
    },
    {
        "layer": "streetlight",
        "source": "가로등공원_데이터_전처리.zip / yongsan_streetlight_5186 (서울특별시 관리 가로등, 2023-12-22 기준)",
        "license": "서울시 공공데이터 · 이용조건 팀 확인 필요",
    },
    {
        "layer": "slope",
        "source": "용산구_전처리.zip / 등고선·표고점 TIN 5m DEM → 경사(°) 도로 구역 평균 slope_mean",
        "license": "서울시 공공데이터 · 팀 전처리",
    },
]


KEPT_TABLES = ("courses", "recommendation_logs")


def set_aside_if_corrupt(engine) -> dict[str, list[tuple]] | None:
    """SQLite 파일이 손상됐으면 data/corrupt-*/로 옮기고, 읽을 수 있는 코스·추천 기록을 돌려준다.

    도로망 테이블은 원본 zip에서 다시 만들 수 있지만 저장한 코스는 상세 URL에 필요하다.
    서버가 DB를 연 채 -wal/-shm 파일을 지우면 이렇게 손상될 수 있다."""
    url = engine.url
    if url.get_backend_name() != "sqlite" or not url.database or not Path(url.database).exists():
        return None
    path = Path(url.database)
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        healthy = con.execute("pragma quick_check").fetchone()[0] == "ok"
    except sqlite3.DatabaseError:
        healthy = False
    if healthy:
        con.close()
        return None
    salvaged: dict[str, list[tuple]] = {}
    # 잘린 파일은 이 설정이 있어야 헤더보다 짧아도 남은 페이지를 읽는다(읽기 전용 연결).
    con.execute("pragma writable_schema=on")
    for table in KEPT_TABLES:
        try:
            cursor = con.execute(f"select * from {table}")
            salvaged[table] = [tuple(d[0] for d in cursor.description), *cursor.fetchall()]
        except sqlite3.DatabaseError:
            salvaged[table] = []
    con.close()
    engine.dispose()
    target = path.parent / f"corrupt-{datetime.now():%Y%m%d-%H%M%S}"
    target.mkdir()
    for suffix in ("", "-wal", "-shm"):
        file = path.with_name(path.name + suffix)
        if file.exists():
            file.rename(target / file.name)
    counts = {t: max(0, len(rows) - 1) for t, rows in salvaged.items()}
    print(f"손상된 DB를 {target}로 옮겼어요. 살린 행: {counts}")
    return salvaged


def restore_rows(engine, salvaged: dict[str, list[tuple]]) -> None:
    with engine.begin() as conn:
        raw = conn.connection.driver_connection
        for table, rows in salvaged.items():
            if not rows:
                continue
            columns, *values = rows
            raw.executemany(
                f"insert or ignore into {table} ({', '.join(columns)}) values ({', '.join('?' * len(columns))})",
                values,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", type=Path, default=Path("data/raw"))
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args()
    engine = make_engine(args.database_url)
    salvaged = set_aside_if_corrupt(engine)
    # 도로망 파생 테이블은 스키마째 다시 만든다. 저장한 코스·추천 기록은 유지한다.
    Base.metadata.drop_all(engine, tables=[m.__table__ for m in NETWORK_TABLES])
    init_db(engine)
    if salvaged:
        restore_rows(engine, salvaged)
    with session_factory(engine)() as session:
        network = import_network(args.raw, session)
        q = network.quality
        print(
            f"{network.version}: 구간 {network.edge_count}개 · 노드 {network.node_count}개 · "
            f"연결 성분 {q['component_count']}개(최대 성분 길이 {q['main_component_length_ratio']:.1%}) · "
            f"시설 {q['facility_counts']} · 팀 stop_norm 대조 {q['team_stop_norm_check']}"
        )


if __name__ == "__main__":
    main()
