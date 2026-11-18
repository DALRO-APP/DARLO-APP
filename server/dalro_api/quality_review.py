"""원본을 보존하는 버전 지정 검토표. NULL 복원과 팀이 지적한 간선 제외만 적용한다."""

import json
from functools import lru_cache
from pathlib import Path

REVIEW_PATH = Path(__file__).resolve().parents[1] / "seed" / "yongsan-quality-review.json"


@lru_cache(maxsize=1)
def review_document() -> dict:
    return json.loads(REVIEW_PATH.read_text(encoding="utf-8"))


def review_for(version: str) -> dict | None:
    review = review_document()
    return review if version == review["base_network_version"] else None


def missing_slope(review: dict | None, source_fid: int, osm_id: str | None) -> bool:
    return bool(review and any(
        item["source_fid"] == source_fid and item["osm_id"] == osm_id
        for item in review["missing_slope_features"]
    ))


def blocked_edge(review: dict | None, edge_id: str) -> bool:
    # Overlay에서 분할된 임시 간선은 이미 검토된 원본 간선의 속성을 물려받는다.
    return bool(review and any(item["edge_id"] == edge_id for item in review["blocked_edges"]))


def course_needs_refresh(course: dict) -> bool:
    """보행 제외 간선을 포함한 코스와 보정 전 결측 구간 코스는 재추천한다."""
    review = review_document()
    version = course.get("data_version")
    if version not in (review["base_network_version"], review["effective_network_version"]):
        return False
    ids = course.get("edge_ids", [])
    if any(blocked_edge(review, edge_id) for edge_id in ids):
        return True
    affected = {str(item["source_fid"]) for item in review["missing_slope_features"]}
    return version == review["base_network_version"] and any(edge_id.split("-", 1)[0] in affected for edge_id in ids)
