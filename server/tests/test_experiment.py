import math

import pytest
import shapely

from conftest import ORIGIN
from dalro_api.db import make_engine, session_factory
from dalro_api.experiment import compare_pair, route_metrics
from dalro_api.graph import Overlay, RoadGraph


def test_alpha_comparison_uses_same_graph_and_reports_actual_tradeoff(database_url):
    engine = make_engine(database_url)
    with session_factory(engine)() as session:
        graph = RoadGraph.load(session)
    # 신호가 몰린 행을 가로지르는 OD. α=0은 짧은 큰길, α=3은 우회한다.
    start = (ORIGIN[0] - 0.005, ORIGIN[1])
    end = (ORIGIN[0] + 0.005, ORIGIN[1])
    before = [e.cost for e in graph.edges]
    pair = compare_pair(graph, "합성 격자", start, end)
    base, _, pace3, _ = pair["runs"]
    assert base["cost"] == pytest.approx(base["distance_m"])
    assert pace3["distance_m"] > base["distance_m"]
    assert pace3["signal_count"] < base["signal_count"]
    assert pace3["environment_penalty"] < base["environment_penalty"]
    assert pace3["cost_at_alpha3"] <= base["cost_at_alpha3"]
    assert [e.cost for e in graph.edges] == before
    assert [r["alpha"] for r in pair["runs"]] == [0, 1, 3, 5]
    # A*와 Dijkstra의 최소 비용이 α마다 같다.
    overlay = Overlay(graph)
    a, b = graph.snap(start, overlay), graph.snap(end, overlay)
    for alpha in (0, 1, 3, 5):
        dijkstra, _ = overlay.search(a.node, None, alpha=alpha)
        assert route_metrics(overlay, a.node, b.node, alpha)["cost"] == pytest.approx(dijkstra[b.node])
    for alpha in (-1, math.nan, math.inf):
        with pytest.raises(ValueError):
            overlay.search(a.node, b.node, alpha=alpha)
    engine.dispose()


def test_zero_baseline_stops_are_not_reported_as_a_reduction(database_url):
    engine = make_engine(database_url)
    with session_factory(engine)() as session:
        graph = RoadGraph.load(session)
    # 신호 행보다 북쪽에 고정한다. 횡단보도 자료가 없으므로 전체 합계도 미측정이다.
    pair = compare_pair(graph, "미측정 시설", (ORIGIN[0], ORIGIN[1] + 0.003),
                        (ORIGIN[0] + 0.003, ORIGIN[1] + 0.003))
    assert all(r["stop_factors"] is None and r["stop_reduction_pct"] is None for r in pair["runs"])
    # 자료가 존재하지만 시설 수가 0인 경우도 감소율 분모로 쓰지 않는다.
    graph.facilities["crosswalk"] = shapely.STRtree([])
    pair = compare_pair(graph, "측정된 0", (ORIGIN[0], ORIGIN[1] + 0.003),
                        (ORIGIN[0] + 0.003, ORIGIN[1] + 0.003))
    assert all(r["stop_factors"] == 0 and r["stop_reduction_pct"] is None for r in pair["runs"])
    engine.dispose()
