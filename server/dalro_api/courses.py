"""탐색 경로 → 앱 계약(src/domain/contracts.ts)의 Course 객체."""

import hashlib

import numpy as np
import shapely

from .config import BASE_PACE_S_PER_KM, FACILITY_BUFFER_M
from .geo import Position, haversine
from .graph import Overlay
from .routing import Candidate

ALGORITHM_VERSION = "pace-cost-a3-v1"
FCLASS_LABEL = {
    "footway": "보행로",
    "cycleway": "자전거·보행 겸용로",
    "path": "산책로",
    "pedestrian": "보행자 거리",
    "living_street": "생활 도로",
    "residential": "주택가 길",
    "service": "이면 도로",
    "track": "오솔길",
    "unclassified": "소로",
}
PLACES: list[tuple[str, Position]] = [
    # 앱 src/domain/catalog.ts STARTS와 같은 시연 장소
    ("이촌 한강공원", (126.9745, 37.5178)),
    ("남산 둘레길", (126.995, 37.546)),
    ("용산가족공원", (126.9845, 37.5223)),
]


def place_label(point: Position, fallback: str) -> str:
    for label, coordinate in PLACES:
        if haversine(point, coordinate) <= 100:
            return label
    return fallback


def _label(edge) -> str:
    return edge.name or FCLASS_LABEL.get(edge.fclass, "큰길 보도")


def _runs(overlay: Overlay, candidate: Candidate):
    """같은 도로명(이름 없으면 유형)이 이어지는 구간."""
    runs, position = [], 0.0
    for e, _ in candidate.steps:
        edge = overlay.edge(e)
        label = _label(edge)
        if runs and runs[-1]["label"] == label:
            runs[-1]["length"] += edge.length
        else:
            runs.append({"label": label, "start": position, "length": edge.length, "named": bool(edge.name)})
        position += edge.length
    return runs


def _geometry(overlay: Overlay, candidate: Candidate):
    lonlat: list[Position] = []
    xy: list[Position] = []
    for e, forward in candidate.steps:
        edge = overlay.edge(e)
        a, b = (edge.lonlat, edge.xy) if forward else (edge.lonlat[::-1], edge.xy[::-1])
        lonlat.extend(a if not lonlat else a[1:])
        xy.extend(b if not xy else b[1:])
    # 계약은 최소 4점이다. 짧은 편도는 직선 구간 중간점을 넣어 모양을 바꾸지 않고 맞춘다.
    while len(lonlat) < 4:
        i = max(range(len(xy) - 1), key=lambda k: haversine(lonlat[k], lonlat[k + 1]))
        lonlat.insert(i + 1, tuple((p + q) / 2 for p, q in zip(lonlat[i], lonlat[i + 1])))
        xy.insert(i + 1, tuple((p + q) / 2 for p, q in zip(xy[i], xy[i + 1])))
    return lonlat, xy


def _count(overlay: Overlay, kind: str, buffer) -> int | None:
    tree = overlay.graph.facilities.get(kind)
    if tree is None:
        return None
    return int(len(np.unique(tree.query(buffer, predicate="intersects"))))


def build_course(
    overlay: Overlay,
    candidate: Candidate,
    *,
    route_type: str,
    time_of_day: str,
    start_label: str,
    end_label: str | None = None,
) -> dict:
    graph = overlay.graph
    lonlat, xy = _geometry(overlay, candidate)
    distance = round(candidate.length)
    buffer = shapely.buffer(shapely.LineString(xy), FACILITY_BUFFER_M)
    signals = _count(overlay, "signal", buffer)
    crossings = _count(overlay, "crosswalk", buffer)
    lights = _count(overlay, "streetlight", buffer)
    edges = [overlay.edge(e) for e, _ in candidate.steps]
    measured = [e for e in edges if e.slope_pct is not None]
    slope = (
        sum(e.slope_pct * e.length for e in measured) / sum(e.length for e in measured) if measured else None
    )
    penalty = sum(e.penalty * e.length for e in edges) / candidate.length
    stops = None if signals is None or crossings is None else signals + crossings
    stops_per_km = None if stops is None else stops / (candidate.length / 1000)
    stats = graph.stats

    runs = _runs(overlay, candidate)
    named: dict[str, float] = {}
    for run in runs:
        if run["named"]:
            named[run["label"]] = named.get(run["label"], 0.0) + run["length"]
    main_roads = sorted(named, key=lambda k: -named[k])[:2]
    loop = route_type == "loop"
    if main_roads:
        name = "·".join(main_roads) + (" 리듬 루프" if loop else " 경유 리듬 코스")
    else:
        name = f"{start_label} 리듬 {'루프' if loop else '코스'}"

    stop_text = "멈춤 요인 미확인" if stops_per_km is None else f"멈춤 요인 km당 {stops_per_km:.1f}곳"
    slope_text = "경사 미확인" if slope is None else f"평균 경사 {slope:.1f}%"
    reasons = [
        {
            "code": "signals",
            "title": (
                "멈춤 요인이 적은 길"
                if stops_per_km is not None and stops_per_km < stats["stops_per_km"]
                else "멈춤 요인 정보 반영"
            ),
            "description": (
                "신호 부착대·횡단보도 정보가 없어요."
                if stops_per_km is None
                else f"신호 부착대·횡단보도 km당 {stops_per_km:.1f}곳 (용산구 도로 평균 {stats['stops_per_km']:.1f}곳)"
            ),
        },
        {
            "code": "flat",
            "title": (
                "완만한 길 위주"
                if slope is not None and stats["mean_slope_pct"] is not None and slope < stats["mean_slope_pct"]
                else "경사 정보 반영"
            ),
            "description": (
                "경사 정보가 없어요."
                if slope is None
                else f"평균 지형 경사 {slope:.1f}% (용산구 도로 평균 {stats['mean_slope_pct']:.1f}%)"
            ),
        },
        (
            {"code": "loop", "title": "출발지로 돌아오기", "description": f"{start_label}에서 출발해 같은 곳으로 돌아와요"}
            if loop
            else {"code": "destination", "title": "목적지까지 달리기", "description": f"{end_label}까지 이어지는 편도 코스"}
        ),
    ]
    if time_of_day == "night":
        reasons.append(
            {
                "code": "lighting",
                "title": "가로등 정보 반영",
                "description": (
                    "가로등 정보가 없어요."
                    if lights is None
                    else f"코스 10m 안 서울시 관리 가로등 {lights}개 · 밝기·안전을 보장하지 않아요"
                ),
            }
        )

    highlights = sorted(
        sorted((r for r in runs if r["length"] >= 150), key=lambda r: -r["length"])[:3], key=lambda r: r["start"]
    )
    segments = [
        {"id": "start", "name": start_label, "description": "몸을 풀고 리듬을 찾아요", "distance_from_start_m": 0}
    ]
    for index, run in enumerate(highlights, 1):
        segments.append(
            {
                "id": f"s{index}",
                "name": run["label"],
                "description": f"약 {run['length'] / 1000:.1f}km 이어지는 구간",
                "distance_from_start_m": min(distance, round(run["start"])),
            }
        )
    segments.append(
        {
            "id": "finish",
            "name": start_label if loop else end_label,
            "description": "오늘의 달리기를 마쳤어요",
            "distance_from_start_m": distance,
        }
    )
    edge_ids = [e.edge_id for e in edges]
    digest = hashlib.sha1(
        "|".join([graph.version, ALGORITHM_VERSION, time_of_day, *edge_ids]).encode()
    ).hexdigest()[:12]
    course = {
        "id": f"pace-{route_type}-{digest}",
        "name": name,
        "subtitle": f"{stop_text} · {slope_text}",
        "purpose": "PACE",
        "region": "서울 용산구",
        "start_label": start_label,
        "route_type": route_type,
        "geometry": {"type": "LineString", "coordinates": [list(p) for p in lonlat]},
        "summary": {
            "distance_m": distance,
            "estimated_duration_s": round(distance / 1000 * BASE_PACE_S_PER_KM),
            # 도로별 고도 상승량은 아직 산출되지 않았다(경사는 지형 경사 평균).
            "elevation_gain_m": None,
            "avg_slope_pct": None if slope is None else round(slope, 1),
            "signal_count": signals,
            "crossing_count": crossings,
            "light_count": lights,
            # park_cnt는 공원 피처 수이며 녹지 면적 비율이 아니다.
            "green_ratio": None,
            "environment_score": round(max(0.0, min(1.0, 1 - penalty)) * 100),
        },
        "reasons": reasons,
        "segments": segments,
        "edge_ids": edge_ids,
        "data_version": graph.version,
        "algorithm_version": ALGORITHM_VERSION,
        "is_mock": False,
    }
    if not loop:
        course["end"] = list(lonlat[-1])
        course["end_label"] = end_label
    return course
