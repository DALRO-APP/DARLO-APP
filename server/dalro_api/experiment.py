"""교수님 피드백용 α 비교. DB를 읽기 전용으로 열고 코스·로그를 저장하지 않는다.

실행: cd server && .venv/bin/python -m dalro_api.experiment --output ../artifacts/DALRO-feedback-2026-11-17
"""

import argparse
import csv
import json
from pathlib import Path

from sqlalchemy import create_engine

from .config import DEFAULT_DB, FACILITY_BUFFER_M
from .courses import PLACES, _geometry, build_course
from .db import session_factory
from .graph import Overlay, RoadGraph
from .pace import cost
from .routing import Candidate, loop_candidates

ALPHAS = (0, 1, 3, 5)


def route_metrics(overlay: Overlay, source: int, target: int, alpha: float) -> dict:
    dist, parent = overlay.search(source, target, alpha=alpha)
    steps = overlay.path(parent, source, target)
    if not steps:
        raise ValueError("비교할 출발–도착지 사이 경로가 없습니다.")
    edges = [overlay.edge(e) for e, _ in steps]
    length = sum(e.length for e in edges)
    candidate = Candidate(steps, length, sum(cost(e.length, e.penalty, alpha) for e in edges), 0, 0)
    # 앱과 같은 10m 버퍼·고유 시설·길이 가중 평균으로 집계한다.
    course = build_course(overlay, candidate, route_type="straight", time_of_day="day",
                          start_label="실험 출발지", end_label="실험 도착지")
    _, xy = _geometry(overlay, candidate)
    summary = course["summary"]
    signals, crossings = summary["signal_count"], summary["crossing_count"]
    stops = None if signals is None or crossings is None else signals + crossings
    return {
        "alpha": alpha, "distance_m": length, "environment_penalty": summary["environment_penalty"],
        "cost": dist[target], "cost_at_alpha3": sum(e.cost for e in edges),
        "signal_count": signals, "crossing_count": crossings, "stop_factors": stops,
        "stop_factors_per_km": None if stops is None else stops / (length / 1000),
        "avg_slope_pct": summary["avg_slope_pct"], "edge_ids": course["edge_ids"],
        "coordinates": course["geometry"]["coordinates"], "xy": xy,
    }


def compare_pair(graph: RoadGraph, label: str, start, end) -> dict:
    overlay = Overlay(graph)
    snapped = []
    for point in (start, end):
        road = graph.nearest_road_point(point, 300)
        if road is None or not graph.in_service_area(point):
            raise ValueError(f"실험 장소가 서비스 범위·도로망 밖입니다: {label}")
        snapped.append(road)
    source = graph.snap(snapped[0][0], overlay)
    target = graph.snap(snapped[1][0], overlay)
    runs = [route_metrics(overlay, source.node, target.node, a) for a in ALPHAS]
    base = runs[0]
    for run in runs:
        run["distance_change_pct"] = (run["distance_m"] / base["distance_m"] - 1) * 100
        run["stop_reduction_pct"] = (
            None if base["stop_factors"] in (None, 0) or run["stop_factors"] is None
            else (1 - run["stop_factors"] / base["stop_factors"]) * 100
        )
    return {"label": label, "start": start, "end": end,
            "snapped_start": snapped[0][0], "snapped_end": snapped[1][0],
            "snap_distances_m": [p[1] for p in snapped], "runs": runs}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DEFAULT_DB)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///file:{args.database.resolve()}?mode=ro&uri=true")
    with session_factory(engine)() as session:
        graph = RoadGraph.load(session)
    parks = sorted(p for p in graph.places if p[0] == "어린이공원(삼각지)" and p[2] == "서울 용산구")
    if not parks:
        raise ValueError("세 번째 실험 출발지인 어린이공원(삼각지)가 자료에 없습니다.")
    ichon, namsan, family = [p[1] for p in PLACES]
    # 결과를 보기 전에 고정한 장소쌍. 감소하지 않는 결과도 모두 보존한다.
    pairs = [
        ("기존 · 이촌 한강공원 → 남산 둘레길", ichon, namsan),
        ("추가 1 · 이촌 한강공원 → 용산가족공원", ichon, family),
        ("추가 2 · 용산가족공원 → 남산 둘레길", family, namsan),
        ("추가 3 · 어린이공원(삼각지) → 이촌 한강공원", parks[0][3], ichon),
    ]
    results = [compare_pair(graph, *p) for p in pairs]
    overlay = Overlay(graph)
    start = graph.snap(ichon, overlay)
    chosen = loop_candidates(overlay, start.node, 5000, 0.1)
    loop = [{"course": build_course(overlay, c, route_type="loop", time_of_day="day", start_label=PLACES[0][0]),
             "cost": c.cost, "selection_cost": c.selection_cost, "overlap": c.overlap,
             "error": c.error, "xy": _geometry(overlay, c)[1]} for c in chosen]
    payload = {
        "date": "2026-11-17", "network_version": graph.version,
        "method": {"alphas": ALPHAS, "facility_buffer_m": FACILITY_BUFFER_M,
                   "stops": "10m 버퍼 안 신호 부착대·횡단보도의 종류별 고유 시설 수 합계",
                   "scope": "용산구 주 연결 성분·양방향·PACE 통행 조건 동일, 관측 주행 아님",
                   "selection": "기존 1쌍 + 사전 고정 추가 3쌍, 결과 선별 없음"},
        "network_stats": graph.stats, "pairs": results, "loop": loop,
        "edges": [{"xy": e.xy, "penalty": e.penalty} for e in graph.edges
                  if e.allowed and graph.component[e.u] == 0],
    }
    (args.output / "experiments.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    fields = ["pair", "alpha", "distance_m", "distance_change_pct", "signal_count", "crossing_count",
              "stop_factors", "stop_reduction_pct", "stop_factors_per_km", "avg_slope_pct",
              "environment_penalty", "cost_at_alpha3"]
    with (args.output / "experiments.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for pair in results:
            for run in pair["runs"]:
                writer.writerow({"pair": pair["label"], **{k: run[k] for k in fields[1:]}})
    features = []
    for pair in results:
        for run in pair["runs"]:
            features.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": run["coordinates"]},
                             "properties": {"pair": pair["label"], "alpha": run["alpha"],
                                            "distance_m": run["distance_m"], "environment_penalty": run["environment_penalty"]}})
    (args.output / "routes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    lines = ["# PACE α 경로 비교 실험", "", "2026-11-17 · " + graph.version, "",
             "같은 도로망·통행 조건에서 α=0(최단거리)과 1·3·5를 비교했다. 시설 수는 실제 정지 횟수가 아니다.", ""]
    for pair in results:
        lines += ["## " + pair["label"], "", "| α | 거리 km | 거리 변화 | 신호 부착대 | 횡단보도 | 멈춤 요인 합계 | 감소율 | 평균 패널티 |",
                  "|---|---:|---:|---:|---:|---:|---:|---:|"]
        for r in pair["runs"]:
            reduction = "산출 불가" if r["stop_reduction_pct"] is None else f"{r['stop_reduction_pct']:+.1f}%"
            lines.append(f"| {r['alpha']} | {r['distance_m']/1000:.3f} | {r['distance_change_pct']:+.1f}% | {r['signal_count']} | {r['crossing_count']} | {r['stop_factors']} | {reduction} | {r['environment_penalty']:.4f} |")
        lines += ["", "도로 스냅 거리(출발/도착): " + "/".join(f"{p:.1f}m" for p in pair["snap_distances_m"]), ""]
    additional = [p["runs"][2] for p in results[1:]]
    improved = sum(r["stop_factors"] < p["runs"][0]["stop_factors"] for p, r in zip(results[1:], additional))
    lines += ["## 해석과 한계", "", f"추가 3쌍 중 α=3에서 멈춤 요인이 감소한 경우는 {improved}쌍이다.",
              "α가 커져도 시설 수가 항상 줄지는 않는다. 최적화 대상은 길이×(1+α×패널티)의 합이며, 시설 수는 경로 버퍼의 고유 시설로 별도 집계한다.",
              "α=3은 기존 팀 설정을 유지했다. 이 소수 사례로 최적 α나 효과의 일반성을 확정하지 않는다.",
              "신호 부착대 수는 교차로 수·빨간불 대기 횟수가 아니다. 시설 자료의 시점·위치, 지형 경사, 미측정 최대 처리, 계단·출입 제한 제외에 따른 한계가 있다.",
              "거리 변화와 시설 감소율은 반올림 전 값으로 계산했다. 실제 GPS 주행·대기 시간·안전성 검증은 하지 않았다."]
    (args.output / "experiment-report.md").write_text("\n".join(lines) + "\n")
    engine.dispose()
    for p in results:
        r = p["runs"][2]
        print(p["label"], f"α3 거리 {r['distance_m']/1000:.3f}km ({r['distance_change_pct']:+.1f}%), 멈춤 요인 {r['stop_factors']} ({r['stop_reduction_pct']:+.1f}% 감소)")


if __name__ == "__main__":
    main()
