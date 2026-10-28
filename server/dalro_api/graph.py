"""메모리 도로 그래프와 출발점 스냅.

DB의 탐색 구간을 한 번 읽어 인접 리스트로 만든다. 러너는 차량 일방통행과 무관하게
보도를 양방향으로 다닐 수 있다고 보고 모든 구간을 양방향으로 연결한다.
"""

import heapq
import math
from dataclasses import dataclass, field

import numpy as np
import shapely
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import pace
from .config import FACILITY_BUFFER_M, PACE_EXCLUDED_FCLASS, SNAP_RADIUS_M
from .geo import Position, slope_pct, to_lonlat, to_xy
from .models import Facility, NetworkVersion, Place, RoadEdge, ServiceArea


@dataclass
class Edge:
    edge_id: str
    u: int
    v: int
    length: float
    penalty: float
    allowed: bool
    name: str | None
    fclass: str
    slope_pct: float | None
    lonlat: list[Position]
    xy: list[Position]

    @property
    def cost(self) -> float:
        return pace.cost(self.length, self.penalty)


Step = tuple[int, bool]  # (edge index, u→v 방향 여부)


@dataclass
class Snap:
    node: int
    distance_m: float


@dataclass
class RoadGraph:
    version: str
    sources: list
    nodes_xy: list[Position]
    nodes_lonlat: list[Position]
    edges: list[Edge]
    adj: list[list[tuple[int, int]]]
    component: list[int]
    facilities: dict[str, shapely.STRtree]
    stats: dict = field(default_factory=dict)
    service_area: shapely.Geometry | None = None
    service_area_name: str = "서울 용산구"
    places: list[tuple[str, str, str, Position]] = field(default_factory=list)  # 이름·분류·주소·위치
    _vertex_xy: np.ndarray | None = None
    _vertex_ref: list[tuple[int, int]] = field(default_factory=list)

    @classmethod
    def load(cls, session: Session) -> "RoadGraph":
        network = session.scalar(select(NetworkVersion).where(NetworkVersion.is_active))
        if network is None:
            raise LookupError("임포트한 도로망이 없습니다. python -m dalro_api.importer를 실행하세요.")
        rows = session.scalars(select(RoadEdge).where(RoadEdge.version == network.version)).all()
        index: dict[str, int] = {}
        nodes_xy: list[Position] = []
        nodes_lonlat: list[Position] = []

        def node(node_id: str, xy: list, lonlat: list) -> int:
            if node_id not in index:
                index[node_id] = len(nodes_xy)
                nodes_xy.append((xy[0], xy[1]))
                nodes_lonlat.append((lonlat[0], lonlat[1]))
            return index[node_id]

        edges = []
        for row in sorted(rows, key=lambda r: r.edge_id):
            u = node(row.from_node, row.coords_xy[0], row.coords_lonlat[0])
            v = node(row.to_node, row.coords_xy[-1], row.coords_lonlat[-1])
            edges.append(
                Edge(
                    edge_id=row.edge_id,
                    u=u,
                    v=v,
                    length=row.length_m,
                    penalty=pace.penalty(row.stop_norm, row.slope_norm),
                    allowed=row.walkable and row.fclass not in PACE_EXCLUDED_FCLASS,
                    name=row.name,
                    fclass=row.fclass,
                    slope_pct=slope_pct(row.slope_deg),
                    lonlat=[tuple(p) for p in row.coords_lonlat],
                    xy=[tuple(p) for p in row.coords_xy],
                )
            )
        facilities = {}
        for kind in ("signal", "crosswalk", "streetlight"):
            blobs = session.scalars(
                select(Facility.wkb).where(Facility.version == network.version, Facility.kind == kind)
            ).all()
            facilities[kind] = shapely.STRtree(shapely.from_wkb(blobs)) if blobs else None
        graph = cls(
            version=network.version,
            sources=network.sources,
            nodes_xy=nodes_xy,
            nodes_lonlat=nodes_lonlat,
            edges=edges,
            adj=[],
            component=[],
            facilities=facilities,
        )
        area = session.scalar(select(ServiceArea).where(ServiceArea.version == network.version))
        if area is not None:
            graph.service_area = shapely.from_wkb(area.wkb)
            graph.service_area_name = area.name
            shapely.prepare(graph.service_area)
        graph.places = [
            (p.name, p.category, p.address, (p.lon, p.lat))
            for p in session.scalars(select(Place).where(Place.version == network.version))
        ]
        graph._build()
        return graph

    def _build(self) -> None:
        self.adj = [[] for _ in self.nodes_xy]
        for i, edge in enumerate(self.edges):
            if edge.allowed:
                self.adj[edge.u].append((edge.v, i))
                self.adj[edge.v].append((edge.u, i))
        # 탐색 가능한 연결 성분. 0이 가장 큰 성분이다.
        comp = [-1] * len(self.nodes_xy)
        sizes = []
        for start in range(len(self.nodes_xy)):
            if comp[start] != -1 or not self.adj[start]:
                continue
            label, stack, size = len(sizes), [start], 0
            comp[start] = label
            while stack:
                n = stack.pop()
                size += 1
                for m, _ in self.adj[n]:
                    if comp[m] == -1:
                        comp[m] = label
                        stack.append(m)
            sizes.append(size)
        order = {label: rank for rank, label in enumerate(sorted(range(len(sizes)), key=lambda l: -sizes[l]))}
        self.component = [order.get(c, -1) for c in comp]
        refs, points = [], []
        for i, edge in enumerate(self.edges):
            if edge.allowed and self.component[edge.u] == 0:
                for k, p in enumerate(edge.xy):
                    refs.append((i, k))
                    points.append(p)
        self._vertex_ref = refs
        self._vertex_xy = np.array(points) if points else np.zeros((0, 2))
        self._line_ref = [i for i, e in enumerate(self.edges) if e.allowed and self.component[e.u] == 0]
        self._lines = shapely.STRtree([shapely.LineString(self.edges[i].xy) for i in self._line_ref])
        self.stats = self._network_stats()

    def _network_stats(self) -> dict:
        main = [e for e in self.edges if e.allowed and self.component[e.u] == 0]
        length = sum(e.length for e in main) or 1.0
        measured = [e for e in main if e.slope_pct is not None]
        stops = 0
        if main and self.facilities.get("signal") is not None:
            buffers = shapely.buffer(np.array([shapely.LineString(e.xy) for e in main], dtype=object), FACILITY_BUFFER_M)
            for kind in ("signal", "crosswalk"):
                tree = self.facilities.get(kind)
                if tree is not None:
                    stops += len(np.unique(tree.query(buffers, predicate="intersects")[1]))
        return {
            "length_km": length / 1000,
            "mean_penalty": sum(e.penalty * e.length for e in main) / length,
            "mean_slope_pct": (
                sum(e.slope_pct * e.length for e in measured) / sum(e.length for e in measured)
                if measured
                else None
            ),
            "stops_per_km": stops / (length / 1000),
        }

    def in_service_area(self, lonlat: Position, margin_m: float = 0.0) -> bool:
        """베타 서비스 범위(용산구) 안인지. 경계가 없으면 도로망 스냅 가능 여부로 본다."""
        point = shapely.Point(to_xy([lonlat])[0])
        if self.service_area is None:
            return self.nearest_road_point(lonlat, SNAP_RADIUS_M) is not None
        return self.service_area.distance(point) <= margin_m

    def nearest_road_point(self, lonlat: Position, max_m: float) -> tuple[Position, float] | None:
        """주 연결 성분 도로 위에서 가장 가까운 점과 거리."""
        if not self._line_ref:
            return None
        point = shapely.Point(to_xy([lonlat])[0])
        hits, distances = self._lines.query_nearest(point, max_distance=max_m, return_distance=True)
        if not len(hits):
            return None
        line = shapely.LineString(self.edges[self._line_ref[int(hits[0])]].xy)
        nearest = line.interpolate(line.project(point))
        return to_lonlat([(nearest.x, nearest.y)])[0], float(distances[0])

    # ---- 스냅 ----
    def snap(self, lonlat: Position, overlay: "Overlay") -> Snap | None:
        """요청 좌표에서 50m 안의 주 연결 성분 도로 위 가장 가까운 점에 붙인다.
        구간 중간이면 임시 노드를 만들어 구간을 둘로 나눈다."""
        if not self._line_ref:
            return None
        point = shapely.Point(to_xy([lonlat])[0])
        hits, distances = self._lines.query_nearest(point, max_distance=SNAP_RADIUS_M, return_distance=True)
        if not len(hits):
            return None
        edge_index = self._line_ref[int(hits[0])]
        edge = self.edges[edge_index]
        line = shapely.LineString(edge.xy)
        along = line.project(point)
        distance = float(distances[0])
        if along <= 1.0:
            return Snap(edge.u, distance)
        if along >= line.length - 1.0:
            return Snap(edge.v, distance)
        return Snap(overlay.split(edge_index, along), distance)


class Overlay:
    """요청마다 만드는 임시 노드·구간. 원본 그래프는 바꾸지 않는다."""

    def __init__(self, graph: RoadGraph):
        self.graph = graph
        self.nodes_xy: dict[int, Position] = {}
        self.nodes_lonlat: dict[int, Position] = {}
        self.edges: dict[int, Edge] = {}
        self.adj: dict[int, list[tuple[int, int]]] = {}

    def split(self, edge_index: int, along: float) -> int:
        """구간 시작에서 along m 지점에 임시 노드를 넣는다."""
        g = self.graph
        edge = g.edges[edge_index]
        walked = 0.0
        for k in range(len(edge.xy) - 1):
            step = math.dist(edge.xy[k], edge.xy[k + 1])
            if walked + step >= along or k == len(edge.xy) - 2:
                t = min(1.0, max(0.0, (along - walked) / step)) if step else 0.0
                break
            walked += step

        def lerp(p, q):
            return tuple(a + (b - a) * t for a, b in zip(p, q))

        point_xy = lerp(edge.xy[k], edge.xy[k + 1])
        point_lonlat = lerp(edge.lonlat[k], edge.lonlat[k + 1])
        node = len(g.nodes_xy) + len(self.nodes_xy)
        self.nodes_xy[node] = point_xy
        self.nodes_lonlat[node] = point_lonlat
        # 기존 꼭짓점과 겹치면 같은 좌표를 두 번 넣지 않는다.
        head = k + 1 if t > 0 else k
        tail = k + 2 if t == 1.0 else k + 1
        for a, b, xy, lonlat in (
            (edge.u, node, [*edge.xy[:head], point_xy], [*edge.lonlat[:head], point_lonlat]),
            (node, edge.v, [point_xy, *edge.xy[tail:]], [point_lonlat, *edge.lonlat[tail:]]),
        ):
            half = Edge(
                edge_id=edge.edge_id,
                u=a,
                v=b,
                length=shapely.LineString(xy).length,
                penalty=edge.penalty,
                allowed=True,
                name=edge.name,
                fclass=edge.fclass,
                slope_pct=edge.slope_pct,
                lonlat=list(lonlat),
                xy=list(xy),
            )
            index = len(g.edges) + len(self.edges)
            self.edges[index] = half
            self.adj.setdefault(a, []).append((b, index))
            self.adj.setdefault(b, []).append((a, index))
        return node

    def edge(self, index: int) -> Edge:
        return self.edges[index] if index >= len(self.graph.edges) else self.graph.edges[index]

    def xy(self, node: int) -> Position:
        return self.nodes_xy[node] if node >= len(self.graph.nodes_xy) else self.graph.nodes_xy[node]

    def lonlat(self, node: int) -> Position:
        return self.nodes_lonlat[node] if node >= len(self.graph.nodes_lonlat) else self.graph.nodes_lonlat[node]

    def neighbors(self, node: int) -> list[tuple[int, int]]:
        base = self.graph.adj[node] if node < len(self.graph.adj) else []
        extra = self.adj.get(node)
        return base + extra if extra else base

    def nearest_node(self, xy: Position) -> int:
        """주 연결 성분에서 좌표와 가장 가까운 실제 노드(경유점 후보)."""
        g = self.graph
        d = np.hypot(g._vertex_xy[:, 0] - xy[0], g._vertex_xy[:, 1] - xy[1])
        edge_index, k = g._vertex_ref[int(np.argmin(d))]
        edge = g.edges[edge_index]
        return edge.u if k < len(edge.xy) / 2 else edge.v

    def search(
        self,
        source: int,
        target: int | None,
        weights: dict[int, float] | None = None,
    ) -> tuple[dict[int, float], dict[int, tuple[int, int]]]:
        """PACE 비용 기준 A*(target 지정) 또는 Dijkstra(target=None).
        weights는 이미 쓴 구간에 곱할 배율로, 같은 길 반복을 줄인다."""
        weights = weights or {}
        goal = self.xy(target) if target is not None else None
        dist = {source: 0.0}
        parent: dict[int, tuple[int, int]] = {}
        heap = [(0.0, 0.0, source)]
        done = set()
        while heap:
            _, d, n = heapq.heappop(heap)
            if n in done:
                continue
            done.add(n)
            if n == target:
                break
            for m, e in self.neighbors(n):
                if m in done:
                    continue
                nd = d + self.edge(e).cost * weights.get(e, 1.0)
                if nd < dist.get(m, math.inf):
                    dist[m] = nd
                    parent[m] = (n, e)
                    h = 0.0 if goal is None else math.dist(self.xy(m), goal)
                    heapq.heappush(heap, (nd + h, nd, m))
        return dist, parent

    def path(self, parent: dict[int, tuple[int, int]], source: int, target: int) -> list[Step] | None:
        if target != source and target not in parent:
            return None
        steps: list[Step] = []
        n = target
        while n != source:
            prev, e = parent[n]
            steps.append((e, self.edge(e).u == prev))
            n = prev
        steps.reverse()
        return steps
