"""합성 격자 도로망. 실제 노션 자료 없이 CI에서 계약·알고리즘을 검사한다."""

import pytest
import shapely
from fastapi.testclient import TestClient

from dalro_api.db import init_db, make_engine, session_factory
from dalro_api.geo import to_lonlat, to_xy
from dalro_api.main import create_app
from dalro_api.models import Facility, NetworkVersion, RoadEdge, RoadNode

ORIGIN = (126.9745, 37.5178)  # 이촌 한강공원 시연 출발지
SIZE = 15
STEP = 100.0
BUSY_ROW = 7  # 신호·횡단보도가 몰린 큰길


def grid_rows(version: str):
    ox, oy = to_xy([ORIGIN])[0]
    x0, y0 = ox - STEP * (SIZE // 2), oy - STEP * (SIZE // 2)

    def node(i, j):
        return f"n{i}_{j}", (x0 + i * STEP, y0 + j * STEP)

    nodes, edges = {}, []
    for i in range(SIZE):
        for j in range(SIZE):
            for di, dj in ((1, 0), (0, 1)):
                if i + di >= SIZE or j + dj >= SIZE:
                    continue
                (a, pa), (b, pb) = node(i, j), node(i + di, j + dj)
                nodes[a], nodes[b] = pa, pb
                busy = dj == 0 and j == BUSY_ROW
                edges.append((f"{i}_{j}_{'h' if dj == 0 else 'v'}", a, b, pa, pb, busy))
    return nodes, edges


@pytest.fixture
def database_url(tmp_path):
    url = f"sqlite:///{tmp_path / 'test.sqlite3'}"
    engine = make_engine(url)
    init_db(engine)
    version = "test-grid-v1"
    nodes, edges = grid_rows(version)
    with session_factory(engine)() as session:
        session.add(
            NetworkVersion(
                version=version,
                region="서울 용산구",
                source_crs="EPSG:5186",
                sources=[{"layer": "roads", "source": "test", "license": "test"}],
                edge_count=len(edges),
                node_count=len(nodes),
                quality={},
                is_active=True,
            )
        )
        session.flush()
        lonlat = dict(zip(nodes, to_lonlat(list(nodes.values()))))
        for node_id, (x, y) in nodes.items():
            session.add(RoadNode(version=version, node_id=node_id, lon=lonlat[node_id][0], lat=lonlat[node_id][1], x=x, y=y))
        for edge_id, a, b, pa, pb, busy in edges:
            session.add(
                RoadEdge(
                    version=version,
                    edge_id=edge_id,
                    source_fid=0,
                    osm_id=None,
                    from_node=a,
                    to_node=b,
                    length_m=STEP,
                    fclass="primary" if busy else "residential",
                    name="큰길" if busy else None,
                    layer=0,
                    bridge=False,
                    tunnel=False,
                    walkable=True,
                    feature_signal_cnt=4 if busy else 0,
                    feature_cross_cnt=4 if busy else 0,
                    feature_length_m=STEP,
                    slope_deg=1.0,
                    slope_norm=0.03,
                    stop_den=0.08 if busy else 0.0,
                    stop_norm=1.0 if busy else 0.0,
                    signal_cnt=4 if busy else 0,
                    cross_cnt=4 if busy else 0,
                    light_cnt=2,
                    coords_lonlat=[list(lonlat[a]), list(lonlat[b])],
                    coords_xy=[list(pa), list(pb)],
                )
            )
            if busy:
                mid = ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
                session.add(Facility(version=version, kind="signal", source_id=edge_id, wkb=shapely.to_wkb(shapely.Point(mid))))
        session.commit()
    engine.dispose()
    return url


@pytest.fixture
def client(database_url):
    with TestClient(create_app(database_url)) as test_client:
        yield test_client


def loop_request(**patch):
    return {
        "schema_version": "1.0",
        "start": list(ORIGIN),
        "target_distance_m": 3000,
        "purpose": "PACE",
        "time_of_day": "day",
        "route_type": "loop",
        "distance_tolerance_ratio": 0.1,
        **patch,
    }
