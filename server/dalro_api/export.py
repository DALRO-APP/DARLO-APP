"""임포트한 도로망과 실제 추천 결과를 앱 전달 묶음(docs/TEAM-DATA-HANDOFF.md)으로 쓴다.

    python -m dalro_api.export data/export
    node --import tsx ../scripts/validate-data.ts data/export   # 앱 계약 검사
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from .config import FACILITY_BUFFER_M
from .db import init_db, make_engine, session_factory
from .geo import slope_pct
from .graph import RoadGraph
from .models import NetworkVersion, RoadEdge
from .schemas import LoopRequest, StraightRequest
from .service import RecommendationService

LOOP_REQUEST = {
    "schema_version": "1.0",
    "start": [126.9745, 37.5178],
    "target_distance_m": 5000,
    "purpose": "PACE",
    "time_of_day": "day",
    "route_type": "loop",
    "distance_tolerance_ratio": 0.1,
}
STRAIGHT_REQUEST = {
    "schema_version": "1.0",
    "start": [126.9745, 37.5178],
    "end": [126.9845, 37.5223],
    "target_distance_m": None,
    "purpose": "PACE",
    "time_of_day": "night",
    "route_type": "straight",
    "distance_tolerance_ratio": 0.1,
}


def write(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def export(out: Path, database_url: str | None = None) -> None:
    engine = make_engine(database_url)
    init_db(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        network = session.scalar(select(NetworkVersion).where(NetworkVersion.is_active))
        rows = session.scalars(select(RoadEdge).where(RoadEdge.version == network.version)).all()
        graph = RoadGraph.load(session)
    out.mkdir(parents=True, exist_ok=True)
    write(
        out / "manifest.json",
        {
            "schema_version": "1.0",
            "data_version": network.version,
            "region": network.region,
            "geometry_crs": "EPSG:4326",
            "analysis_crs": network.source_crs,
            "network_version": network.version,
            "edge_count": len(rows),
            "is_mock": False,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "contributors": ["김유진", "김시원", "유경수", "김진"],
            "sources": [{**s, "observed_at": None} for s in network.sources],
            "processing": {
                "signal_buffer_m": FACILITY_BUFFER_M,
                "light_buffer_m": FACILITY_BUFFER_M,
                "green_buffer_m": None,
                "dem_resolution_m": 5,
                "notes": "OSM 선형을 공유 꼭짓점에서 나눈 탐색 구간. 시설 수는 구간 10m 버퍼로 다시 셌다. "
                "slope_pct는 도로 구역 평균 지형 경사(°)를 %로 변환한 값이며 노면 경사보다 클 수 있다. "
                "미군기지 내부 추정 도로는 walkable=false.",
                "quality": network.quality,
            },
        },
    )
    write(
        out / "roads.geojson",
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": row.coords_lonlat},
                    "properties": {
                        "edge_id": row.edge_id,
                        "from_node": row.from_node,
                        "to_node": row.to_node,
                        "length_m": row.length_m,
                        "walkable": row.walkable,
                        "bidirectional": True,
                        "slope_pct": None if row.slope_deg is None else round(slope_pct(row.slope_deg), 2),
                        "elevation_gain_forward_m": None,
                        "elevation_gain_reverse_m": None,
                        "signal_cnt": row.signal_cnt,
                        "cross_cnt": row.cross_cnt,
                        "light_cnt": row.light_cnt,
                        "park_dist_m": None,
                        "green_ratio": None,
                        "data_version": network.version,
                    },
                }
                for row in rows
            ],
        },
    )
    service = RecommendationService(graph, sessions)
    for request, request_file, response_file, model in (
        (LOOP_REQUEST, "request.json", "recommendations.json", LoopRequest),
        (STRAIGHT_REQUEST, "request-straight.json", "recommendations-straight.json", StraightRequest),
    ):
        write(out / request_file, request)
        write(out / response_file, service.recommend(model.model_validate(request)))
    print(f"{out}: 도로 {len(rows)}개 · {network.version}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("out", type=Path)
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args()
    export(args.out, args.database_url)


if __name__ == "__main__":
    main()
