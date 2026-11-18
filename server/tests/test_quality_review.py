import pytest

from dalro_api import pace
from dalro_api.quality_review import blocked_edge, course_needs_refresh, missing_slope, review_document, review_for


def test_review_only_applies_to_exact_base_version_and_feature_identity():
    document = review_document()
    review = review_for(document["base_network_version"])
    assert review_for("different-network") is None
    assert missing_slope(review, 18, "183272312")
    assert not missing_slope(review, 18, "different-osm")
    assert not missing_slope(review, 9999, "183272312")
    assert blocked_edge(review, "1109-0")
    assert not blocked_edge(review, "1109-1")  # 같은 OSM 전체를 제외하지 않는다
    assert not blocked_edge(None, "1109-0")


def test_restored_missing_slope_keeps_true_zero_distinct():
    review = review_for(review_document()["base_network_version"])
    effective = None if missing_slope(review, 18, "183272312") else 0.0
    assert pace.penalty(0, effective) == pytest.approx(0.17)
    assert pace.penalty(0, 0) == 0


def test_affected_stored_courses_require_a_new_recommendation():
    review = review_document()
    course = {"data_version": review["base_network_version"], "edge_ids": ["18-0"]}
    assert course_needs_refresh(course)
    assert not course_needs_refresh({**course, "data_version": review["effective_network_version"]})
    assert course_needs_refresh({**course, "edge_ids": ["1366-0"]})
    assert not course_needs_refresh({**course, "edge_ids": ["1109-1"]})


def test_graph_restores_missing_excludes_only_reviewed_edge_and_preserves_zero(database_url, monkeypatch):
    from sqlalchemy import create_engine, select
    import dalro_api.graph as module
    from dalro_api.db import session_factory
    from dalro_api.models import RoadEdge
    engine = create_engine(database_url)
    with session_factory(engine)() as session:
        affected = session.scalar(select(RoadEdge).where(RoadEdge.edge_id == "7_7_h"))
        affected.source_fid, affected.osm_id = 18, "183272312"
        affected.slope_deg = affected.slope_norm = 0.0
        measured = session.scalar(select(RoadEdge).where(RoadEdge.edge_id == "0_0_h"))
        measured.slope_deg = measured.slope_norm = 0.0
        session.commit()
        review = {"effective_network_version": "test-grid-v1-qc", "review_id": "test-qc",
                  "evidence": {"notion": "https://example.com/evidence"},
                  "missing_slope_features": [{"source_fid": 18, "osm_id": "183272312"}],
                  "blocked_edges": [{"edge_id": "7_7_h"}]}
        monkeypatch.setattr(module, "review_for", lambda _: review)
        graph = module.RoadGraph.load(session)
        by_id = {e.edge_id: e for e in graph.edges}
        assert graph.base_version == "test-grid-v1" and graph.version == "test-grid-v1-qc"
        assert by_id["7_7_h"].slope_pct is None and not by_id["7_7_h"].allowed
        assert by_id["7_7_h"].penalty == pytest.approx(pace.penalty(1.0, None))
        assert by_id["0_0_h"].slope_pct == 0 and by_id["0_0_h"].penalty == 0
        assert by_id["0_0_h"].allowed
        assert affected.slope_deg == affected.slope_norm == 0  # 원본 DB는 보존
        assert graph.quality_review["missing_slope_edges"] == 1
    engine.dispose()
