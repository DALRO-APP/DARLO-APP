import time
import uuid

from sqlalchemy.orm import Session, sessionmaker

from .courses import build_course, place_label
from .graph import Overlay, RoadGraph
from .models import RecommendationLog, StoredCourse
from .routing import loop_candidates, straight_candidates
from .schemas import Course, LoopRequest, StraightRequest


class UnsupportedPurpose(Exception):
    pass


class StartNotCovered(Exception):
    pass


class RecommendationService:
    def __init__(self, graph: RoadGraph, sessions: sessionmaker[Session]):
        self.graph = graph
        self.sessions = sessions

    def recommend(self, request: LoopRequest | StraightRequest) -> dict:
        if request.purpose != "PACE":
            raise UnsupportedPurpose(f"{request.purpose} 추천은 아직 서버에 구현되지 않았어요. 현재는 PACE만 지원합니다.")
        began = time.perf_counter()
        overlay = Overlay(self.graph)
        start = self.graph.snap(request.start, overlay)
        if start is None:
            raise StartNotCovered("출발지 50m 안에 탐색 가능한 용산구 도로가 없어요.")
        start_label = place_label(request.start, "선택한 출발지")
        if request.route_type == "loop":
            candidates = loop_candidates(
                overlay, start.node, request.target_distance_m, request.distance_tolerance_ratio
            )
            courses = [
                build_course(overlay, c, route_type="loop", time_of_day=request.time_of_day, start_label=start_label)
                for c in candidates
            ]
        else:
            end = self.graph.snap(request.end, overlay)
            if end is None:
                raise StartNotCovered("목적지 50m 안에 탐색 가능한 용산구 도로가 없어요.")
            end_label = place_label(request.end, "선택한 목적지")
            candidates = straight_candidates(overlay, start.node, end.node) if end.node != start.node else []
            courses = [
                build_course(
                    overlay,
                    c,
                    route_type="straight",
                    time_of_day=request.time_of_day,
                    start_label=start_label,
                    end_label=end_label,
                )
                for c in candidates
            ]
        seen: dict[str, int] = {}
        for course in courses:
            # 같은 큰길을 지나는 후보가 같은 이름이 되지 않게 번호를 붙인다.
            seen[course["name"]] = seen.get(course["name"], 0) + 1
            if seen[course["name"]] > 1:
                course["name"] = f"{course['name']} {seen[course['name']]}"
            Course.model_validate(course)
        request_id = uuid.uuid4().hex
        with self.sessions() as session:
            for course in courses:
                session.merge(
                    StoredCourse(
                        id=course["id"],
                        purpose=course["purpose"],
                        route_type=course["route_type"],
                        data_version=course["data_version"],
                        algorithm_version=course["algorithm_version"],
                        payload=course,
                    )
                )
            session.add(
                RecommendationLog(
                    request_id=request_id,
                    request=request.model_dump(mode="json"),
                    course_ids=[c["id"] for c in courses],
                    elapsed_ms=round((time.perf_counter() - began) * 1000),
                )
            )
            session.commit()
        return {"schema_version": "1.0", "request_id": request_id, "courses": courses}

    def get_course(self, course_id: str) -> dict | None:
        with self.sessions() as session:
            stored = session.get(StoredCourse, course_id)
            return None if stored is None else stored.payload
