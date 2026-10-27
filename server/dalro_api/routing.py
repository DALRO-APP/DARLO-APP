"""PACE 비용으로 루프·편도 후보를 만든다.

루프: 출발점 S에서 방위 θ, θ+60° 방향 반경 r 지점 근처 노드 A·B를 경유점으로
S→A→B→S를 PACE 비용 최단경로로 잇는다. 앞 구간에서 쓴 도로는 비용을 높여
같은 길로 되돌아오는 것을 줄이고, r을 실제 길이에 맞춰 보정해 목표 거리에 맞춘다.
편도: S→E 최단경로와 앞 경로 도로에 비용을 높인 대안 경로.
"""

import math
from dataclasses import dataclass

from .graph import Overlay, Step

REUSE_FACTOR = 4.0
CIRCUITY = 1.3  # 도로 길이 / 직선 삼각형 둘레 초기 추정
BEARINGS = range(0, 360, 30)
MAX_OVERLAP = 0.3
OVERLAP_WEIGHT = 1.0
DISTANCE_WEIGHT = 0.5
MAX_SIMILARITY = 0.5
STRAIGHT_MAX_DETOUR = 1.5


@dataclass
class Candidate:
    steps: list[Step]
    length: float
    cost: float
    overlap: float
    error: float

    @property
    def score(self) -> float:
        # 팀 비용(길이당 C(e))에 반복 구간·거리 오차를 더한 정렬 기준
        return self.cost / self.length + OVERLAP_WEIGHT * self.overlap + DISTANCE_WEIGHT * abs(self.error)


def remove_spurs(steps: list[Step]) -> list[Step]:
    """경유점이 막다른 길에 붙어 생긴 '갔다가 바로 되돌아오기'를 없앤다."""
    out: list[Step] = []
    for step in steps:
        if out and out[-1][0] == step[0] and out[-1][1] != step[1]:
            out.pop()
        else:
            out.append(step)
    return out


def measure(overlay: Overlay, steps: list[Step], target: float | None) -> Candidate:
    length = cost = repeated = 0.0
    seen: set[str] = set()
    for e, _ in steps:
        edge = overlay.edge(e)
        length += edge.length
        cost += edge.cost
        if edge.edge_id in seen:
            repeated += edge.length
        seen.add(edge.edge_id)
    length = max(length, 1e-9)
    error = 0.0 if target is None else (length - target) / target
    return Candidate(steps, length, cost, repeated / length, error)


def similarity(overlay: Overlay, a: Candidate, b: Candidate) -> float:
    """두 경로가 공유하는 도로 길이 비율(짧은 쪽 기준)."""
    la = {overlay.edge(e).edge_id: overlay.edge(e).length for e, _ in a.steps}
    lb = {overlay.edge(e).edge_id: overlay.edge(e).length for e, _ in b.steps}
    shared = sum(min(la[k], lb[k]) for k in la.keys() & lb.keys())
    return shared / max(1e-9, min(sum(la.values()), sum(lb.values())))


def pick(overlay: Overlay, candidates: list[Candidate], count: int) -> list[Candidate]:
    chosen: list[Candidate] = []
    for candidate in sorted(candidates, key=lambda c: c.score):
        if all(similarity(overlay, candidate, other) <= MAX_SIMILARITY for other in chosen):
            chosen.append(candidate)
        if len(chosen) == count:
            break
    return chosen


def _penalized(steps: list[Step], weights: dict[int, float]) -> dict[int, float]:
    out = dict(weights)
    for e, _ in steps:
        out[e] = REUSE_FACTOR
    return out


def loop_candidates(overlay: Overlay, start: int, target_m: float, tolerance: float, count: int = 3):
    sx, sy = overlay.xy(start)
    tree_dist, tree_parent = overlay.search(start, None)
    candidates: list[Candidate] = []
    for bearing in BEARINGS:
        radius = target_m / (3 * CIRCUITY)
        for _ in range(4):
            waypoints = []
            for angle in (bearing, bearing + 60):
                rad = math.radians(angle)
                waypoints.append(overlay.nearest_node((sx + radius * math.sin(rad), sy + radius * math.cos(rad))))
            a, b = waypoints
            if len({start, a, b}) < 3 or a not in tree_dist:
                break
            leg1 = overlay.path(tree_parent, start, a)
            weights = _penalized(leg1, {})
            _, parent = overlay.search(a, b, weights)
            leg2 = overlay.path(parent, a, b)
            if leg2 is None:
                break
            weights = _penalized(leg2, weights)
            _, parent = overlay.search(b, start, weights)
            leg3 = overlay.path(parent, b, start)
            if leg3 is None:
                break
            candidate = measure(overlay, remove_spurs(leg1 + leg2 + leg3), target_m)
            if abs(candidate.error) <= tolerance:
                if candidate.overlap <= MAX_OVERLAP:
                    candidates.append(candidate)
                break
            radius *= min(2.0, max(0.5, target_m / candidate.length))
    return pick(overlay, candidates, count)


def straight_candidates(overlay: Overlay, start: int, end: int, count: int = 3):
    candidates: list[Candidate] = []
    weights: dict[int, float] = {}
    for _ in range(count + 2):
        _, parent = overlay.search(start, end, weights)
        steps = overlay.path(parent, start, end)
        if not steps:
            break
        candidate = measure(overlay, steps, None)
        if candidates and candidate.length > candidates[0].length * STRAIGHT_MAX_DETOUR:
            break
        candidates.append(candidate)
        weights = _penalized(steps, weights)
    # 편도는 첫 경로(PACE 비용 최소)를 먼저 두고 서로 충분히 다른 대안만 남긴다.
    chosen: list[Candidate] = []
    for candidate in candidates:
        if all(similarity(overlay, candidate, other) <= 0.8 for other in chosen):
            chosen.append(candidate)
        if len(chosen) == count:
            break
    return chosen
