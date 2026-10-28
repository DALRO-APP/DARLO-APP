import httpx
from fastapi.testclient import TestClient

from conftest import ORIGIN, loop_request
from dalro_api.geo import haversine
from dalro_api.main import create_app

INSIDE = [ORIGIN[0] + 0.001, ORIGIN[1] + 0.001]
OUTSIDE = [127.0276, 37.4979]  # 강남역 부근


def kakao_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def keyword_response(request: httpx.Request) -> httpx.Response:
    assert request.headers["Authorization"] == "KakaoAK test-key"
    return httpx.Response(
        200,
        json={
            "documents": [
                {"id": "1", "place_name": "격자 카페", "road_address_name": "용산구 어딘가", "category_group_name": "카페", "x": str(INSIDE[0]), "y": str(INSIDE[1])},
                {"id": "2", "place_name": "강남역 2호선", "road_address_name": "강남구 강남대로", "category_group_name": "지하철역", "x": str(OUTSIDE[0]), "y": str(OUTSIDE[1])},
            ]
        },
    )


def test_local_search_without_kakao_key(client):
    body = client.get("/v1/places/search", params={"query": "격자"}).json()
    assert body["service_area"] == "서울 용산구"
    assert "카카오 장소 검색이 꺼져" in body["notice"]
    names = [p["name"] for p in body["places"]]
    assert names.index("격자공원") < names.index("격자 밖 공원")  # 베타 범위 안 먼저
    park, outside = body["places"][names.index("격자공원")], body["places"][names.index("격자 밖 공원")]
    assert park["in_service_area"] and park["source"] == "local" and park["start_position"]
    assert park["address"] == "서울 용산구 · 공원"
    assert not outside["in_service_area"] and outside["start_position"] is None


def test_kakao_results_are_marked_inside_or_outside_beta_area(database_url):
    app = create_app(database_url, kakao_key="test-key", http_client=kakao_client(keyword_response))
    with TestClient(app) as client:
        body = client.get("/v1/places/search", params={"query": "카페"}).json()
    inside, outside = body["places"][:2]
    assert body["notice"] is None
    assert inside["in_service_area"] and inside["source"] == "kakao"
    # 출발은 장소 좌표가 아니라 가장 가까운 도로 위 지점
    assert haversine(inside["start_position"], inside["position"]) <= 300
    assert not outside["in_service_area"] and outside["start_position"] is None


def test_kakao_failure_falls_back_with_notice(database_url):
    app = create_app(database_url, kakao_key="test-key", http_client=kakao_client(lambda r: httpx.Response(401)))
    with TestClient(app) as client:
        body = client.get("/v1/places/search", params={"query": "큰길"}).json()
    assert "실패" in body["notice"] and body["places"][0]["name"] == "큰길"


def test_recommendation_uses_searched_labels_and_rejects_outside_area(client):
    course = client.post("/v1/courses/recommendations", json=loop_request(start_label="격자 카페")).json()["courses"][0]
    assert course["start_label"] == "격자 카페" and course["segments"][0]["name"] == "격자 카페"
    response = client.post("/v1/courses/recommendations", json=loop_request(start=OUTSIDE))
    assert response.status_code == 422 and "베타" in response.json()["detail"]
    assert client.get("/v1/places/search", params={"query": ""}).status_code == 422
