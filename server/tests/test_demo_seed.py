import importlib.util
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from conftest import loop_request
from dalro_api.demo_seed import export_seed, restore_seed
from dalro_api.main import create_app


def test_seed_keeps_network_and_drops_generated_courses_and_logs(database_url, tmp_path):
    with TestClient(create_app(database_url)) as local:
        course = local.post("/v1/courses/recommendations", json=loop_request()).json()["courses"][0]
    source = Path(make_url(database_url).database)
    seed = tmp_path / "network.sql.gz"
    counts = export_seed(source, seed)
    assert counts["road_edges"] > 0
    restored = restore_seed(seed, tmp_path)
    with sqlite3.connect(restored) as db:
        assert db.execute("select count(*) from road_edges").fetchone()[0] == counts["road_edges"]
        assert db.execute("select count(*) from courses").fetchone()[0] == 0
        assert db.execute("select count(*) from recommendation_logs").fetchone()[0] == 0
    # 실제 사용 중인 원본 DB의 저장 코스는 보존된다.
    with sqlite3.connect(source) as db:
        assert db.execute("select id from courses where id=?", (course["id"],)).fetchone()
    with TestClient(create_app(seed_path=seed)) as first:
        assert first.get("/health").json()["storage"] == "temporary-demo"
        created = first.post("/v1/courses/recommendations", json=loop_request()).json()["courses"][0]
        assert first.get(f"/v1/courses/{created['id']}").status_code == 200
    with TestClient(create_app(seed_path=seed)) as second:
        assert second.get("/health").json()["status"] == "ok"
        assert second.get(f"/v1/courses/{created['id']}").status_code == 404


def test_vercel_rewrite_preserves_search_query_and_api_errors(database_url):
    path = Path(__file__).resolve().parents[2] / "api/index.py"
    spec = importlib.util.spec_from_file_location("dalro_vercel_entry", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    app = create_app(database_url)
    app.add_middleware(module.ApiPathMiddleware)
    with TestClient(app) as client:
        assert client.get("/api/index?__dalro_path=health").json()["status"] == "ok"
        response = client.get("/api/index", params={"__dalro_path": "v1/places/search", "query": "큰길"})
        assert response.status_code == 200 and response.json()["query"] == "큰길"
        assert client.get("/api/v1/courses/unknown").status_code == 404
