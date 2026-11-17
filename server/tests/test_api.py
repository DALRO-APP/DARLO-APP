import pytest
from fastapi.testclient import TestClient

from conftest import BUSY_ROW, ORIGIN, loop_request
from dalro_api.geo import haversine, line_distance
from dalro_api.main import create_app


def test_loop_courses_follow_app_contract(client):
    response = client.post("/v1/courses/recommendations", json=loop_request())
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0" and 1 <= len(body["courses"]) <= 3
    for course in body["courses"]:
        coords = course["geometry"]["coordinates"]
        assert course["route_type"] == "loop" and course["purpose"] == "PACE"
        assert "end" not in course and "end_label" not in course
        assert haversine(coords[0], coords[-1]) <= 20
        assert haversine(coords[0], ORIGIN) <= 50
        assert abs(course["summary"]["distance_m"] - 3000) <= 300
        assert abs(line_distance(coords) - course["summary"]["distance_m"]) / course["summary"]["distance_m"] < 0.02
        # 미측정 값은 키를 유지한 채 null
        assert course["summary"]["elevation_gain_m"] is None and course["summary"]["green_ratio"] is None
        assert course["is_mock"] is False and course["edge_ids"]
        assert course["data_version"] == "test-grid-v1"
        assert 0 <= course["summary"]["environment_penalty"] <= 1
        assert "environment_score" not in course["summary"]
        distances = [s["distance_from_start_m"] for s in course["segments"]]
        assert distances == sorted(distances) and distances[-1] == course["summary"]["distance_m"]


def test_penalty_is_unrounded_length_weighted_mean(client):
    from dalro_api.graph import Overlay
    from dalro_api.routing import loop_candidates
    graph = client.app.state.service.graph
    overlay = Overlay(graph)
    start = graph.snap(ORIGIN, overlay)
    candidate = loop_candidates(overlay, start.node, 3000, 0.1)[0]
    expected = sum(overlay.edge(e).penalty * overlay.edge(e).length for e, _ in candidate.steps) / candidate.length
    course = client.post("/v1/courses/recommendations", json=loop_request()).json()["courses"][0]
    assert course["summary"]["environment_penalty"] == pytest.approx(expected)


def test_legacy_summary_does_not_invert_rounded_score():
    from dalro_api.schemas import Summary
    legacy = dict(distance_m=1000, estimated_duration_s=372, elevation_gain_m=None,
                  avg_slope_pct=None, signal_count=0, crossing_count=0, light_count=None,
                  green_ratio=None, environment_score=95)
    summary = Summary.model_validate(legacy).model_dump()
    assert summary["environment_penalty"] is None
    assert "environment_score" not in summary


def test_pace_avoids_stop_heavy_road(client):
    body = client.post("/v1/courses/recommendations", json=loop_request(target_distance_m=2000)).json()
    best = body["courses"][0]
    busy = [e for e in best["edge_ids"] if e.endswith(f"_{BUSY_ROW}_h")]
    assert len(busy) <= 2  # 출발 노드가 큰길 위라서 나가고 들어오는 구간만 허용


def test_course_detail_survives_server_restart(database_url):
    with TestClient(create_app(database_url)) as first:
        course = first.post("/v1/courses/recommendations", json=loop_request()).json()["courses"][0]
    with TestClient(create_app(database_url)) as second:
        response = second.get(f"/v1/courses/{course['id']}")
    assert response.status_code == 200
    assert response.json() == course


def test_straight_course_ends_at_destination(client):
    end = [ORIGIN[0] + 0.006, ORIGIN[1] + 0.004]
    request = loop_request(route_type="straight", end=end, target_distance_m=None, time_of_day="night")
    body = client.post("/v1/courses/recommendations", json=request).json()
    assert body["courses"]
    for course in body["courses"]:
        coords = course["geometry"]["coordinates"]
        assert course["end"] == coords[-1] and course["end_label"] == "선택한 목적지"
        assert haversine(coords[-1], end) <= 50 and len(coords) >= 4
        assert any(r["code"] == "lighting" for r in course["reasons"])


def test_errors_use_contract_status_codes(client):
    assert client.get("/v1/courses/pace-loop-unknown").status_code == 404
    assert client.post("/v1/courses/recommendations", json=loop_request(purpose="POWER")).status_code == 501
    assert client.post("/v1/courses/recommendations", json=loop_request(start=[127.1, 37.6])).status_code == 422
    assert client.post("/v1/courses/recommendations", json=loop_request(target_distance_m=500)).status_code == 422
    same = loop_request(route_type="straight", end=list(ORIGIN), target_distance_m=None)
    assert client.post("/v1/courses/recommendations", json=same).status_code == 422


def test_unreachable_distance_returns_empty_list(client):
    body = client.post("/v1/courses/recommendations", json=loop_request(target_distance_m=20000)).json()
    assert body["courses"] == []


def test_health_reports_network(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["data_version"] == "test-grid-v1" and body["purposes"] == ["PACE"]
