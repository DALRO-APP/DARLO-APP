from types import SimpleNamespace

import shapely
from fastapi.testclient import TestClient

from conftest import loop_request
from dalro_api.courses import signal_positions
from dalro_api.geo import to_xy
from dalro_api.db import make_engine, session_factory
from dalro_api.main import create_app
from dalro_api.models import Facility, StoredCourse


def test_signals_use_tight_two_metre_buffer_and_keep_source_positions():
    # 반복 구간은 한 번만 세며, 2m 경계는 포함하고 바로 바깥은 제외한다.
    route = shapely.LineString([(198000, 448000), (198100, 448000), (198000, 448000)])
    tree = shapely.STRtree([
        shapely.Point(198020, 448000),
        shapely.LineString([(198040, 447990), (198040, 448030)]),
        shapely.Point(198050, 448002),
        shapely.LineString([(198010, 448001), (198090, 448001)]),
        shapely.Point(198060, 448002.001),
        shapely.Point(198070, 448010),
    ])
    graph = SimpleNamespace(facilities={"signal": tree})
    positions = signal_positions(graph, route)
    assert len(positions) == 4
    distances = []
    for point in to_xy(positions):
        distances.append(route.distance(shapely.Point(point)))
    assert max(distances) <= 2.02  # 경위도 소수 7자리 전송 오차만 허용
    assert max(distances) >= 1.98  # 시설 위치를 경로 위로 억지로 옮기지 않는다.
    assert signal_positions(graph, shapely.LineString([(190000, 440000), (190100, 440000)])) == []
    assert signal_positions(SimpleNamespace(facilities={}), route) is None


def test_api_signals_match_count_and_survive_detail_read(database_url):
    # PACE가 큰길을 우회해도 반드시 만나는 출발점 근처에 신호등을 둔다.
    from conftest import ORIGIN
    from dalro_api.geo import to_lonlat
    ox, oy = to_xy([ORIGIN])[0]
    engine = make_engine(database_url)
    sessions = session_factory(engine)
    with sessions() as session:
        session.add(Facility(version="test-grid-v1", kind="signal", source_id="at-start", wkb=shapely.to_wkb(shapely.MultiLineString([[(ox - 20, oy), (ox + 20, oy)], [(ox, oy - 20), (ox, oy + 20)]]))))
        session.commit()
    end = to_lonlat([(ox + 500, oy)])[0]
    request = loop_request(route_type="straight", target_distance_m=None, end=list(end))
    with TestClient(create_app(database_url)) as client:
        response = client.post("/v1/courses/recommendations", json=request)
        assert response.status_code == 200
        courses = response.json()["courses"]
        assert courses and courses[0]["signal_positions"]
        for course in courses:
            assert len(course["signal_positions"]) <= course["summary"]["signal_count"]
            line = shapely.LineString(to_xy(course["geometry"]["coordinates"]))
            for p in to_xy(course["signal_positions"]):
                assert line.distance(shapely.Point(p)) <= 2.02
            assert client.get(f"/v1/courses/{course['id']}").json()["signal_positions"] == course["signal_positions"]
        # 새 필드가 없는 이전 저장 코스도 같은 버전이면 위치를 보완한다.
        course = courses[0]
        with sessions() as session:
            stored = session.get(StoredCourse, course["id"])
            payload = dict(stored.payload)
            del payload["signal_positions"]
            stored.payload = payload
            session.commit()
        assert client.get(f"/v1/courses/{course['id']}").json()["signal_positions"] == course["signal_positions"]
    engine.dispose()
