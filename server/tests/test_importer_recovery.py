import sqlite3

from dalro_api.db import init_db, make_engine
from dalro_api.importer import restore_rows, set_aside_if_corrupt


def _make_db(path):
    engine = make_engine(f"sqlite:///{path}")
    init_db(engine)
    with engine.begin() as conn:
        raw = conn.connection.driver_connection
        raw.execute(
            "insert into courses (id, purpose, route_type, data_version, algorithm_version, payload, created_at) "
            "values ('pace-loop-abc', 'PACE', 'loop', 'v1', 'a1', '{\"id\": \"pace-loop-abc\"}', '2026-10-28 00:00:00')"
        )
        # 뒤쪽 페이지를 채울 큰 도로 테이블
        raw.execute("insert into network_versions (version, region, source_crs, sources, edge_count, node_count, quality, is_active, imported_at) values ('v1', 'r', 'c', '[]', 0, 0, '{}', 1, '2026-10-28 00:00:00')")
        raw.executemany(
            "insert into road_nodes (version, node_id, lon, lat, x, y) values ('v1', ?, 0, 0, 0, 0)",
            [(f"n{i}-{'x' * 200}",) for i in range(3000)],
        )
    engine.dispose()
    return engine


def test_healthy_db_is_left_alone(tmp_path):
    db = tmp_path / "dalro.sqlite3"
    engine = _make_db(db)
    assert set_aside_if_corrupt(engine) is None and db.exists()


def test_corrupt_db_is_moved_and_courses_restored(tmp_path):
    db = tmp_path / "dalro.sqlite3"
    engine = _make_db(db)
    with sqlite3.connect(db) as con:
        con.execute("pragma wal_checkpoint(truncate)")
    data = db.read_bytes()
    page = 4096
    db.write_bytes(data[: page * (len(data) // page // 2)])  # 뒤쪽 페이지 유실
    salvaged = set_aside_if_corrupt(engine)
    assert not db.exists()
    assert len(list(tmp_path.glob("corrupt-*/dalro.sqlite3"))) == 1
    assert salvaged["courses"][1][0] == "pace-loop-abc"

    fresh = make_engine(f"sqlite:///{db}")
    init_db(fresh)
    restore_rows(fresh, salvaged)
    with sqlite3.connect(db) as con:
        assert con.execute("select id, payload from courses").fetchall() == [("pace-loop-abc", '{"id": "pace-loop-abc"}')]
        assert con.execute("pragma quick_check").fetchone()[0] == "ok"
