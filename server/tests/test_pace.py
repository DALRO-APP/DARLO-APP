import pytest
import shapely

from dalro_api import pace
from dalro_api.geo import slope_pct
from dalro_api.importer import Feature, restricted_area, split_network
from dalro_api.routing import remove_spurs


def test_cost_matches_team_cost_a3():
    # cost.zip 첫 행: 신흥로7길 375.17m, stop_norm 0, slope_norm 0.28523 → cost_a3 429.745
    value = pace.cost(375.17, pace.penalty(0.0, 0.28523), alpha=3)
    assert value == pytest.approx(429.745, abs=0.01)


def test_stop_density_is_capped_then_min_max_normalized():
    densities = [0.0, 0.1375, 0.275, 2.0]
    assert pace.normalize_stop_density(densities) == [0.0, 0.5, 1.0, 1.0]
    assert pace.stop_density(3, 2, 50) == pytest.approx(0.1)


def test_unmeasured_slope_is_not_treated_as_flat():
    assert pace.penalty(0.0, None) == pytest.approx(0.17)
    assert pace.penalty(0.0, None) > pace.penalty(0.0, 0.0)


def test_slope_mean_degrees_are_reported_as_percent():
    assert slope_pct(45) == pytest.approx(100)
    assert slope_pct(None) is None


def _feature(fid, coords, name=None):
    return Feature(fid, None, "residential", name, 0, False, False, 0, 0, 1.0, None, None, [coords])


def test_split_network_connects_shared_vertices_only():
    cross = [_feature(1, [(0, 0), (50, 0), (100, 0)]), _feature(2, [(50, -50), (50, 0), (50, 50)])]
    # 3번은 1번 위를 지나지만 꼭짓점을 공유하지 않는 고가도로
    bridge = _feature(3, [(25, -50), (25, 50)])
    segments, node_ids = split_network(cross + [bridge])
    ids = [s[1] for s in segments]
    assert ids == ["1-0", "1-1", "2-0", "2-1", "3-0"]
    junction = node_ids[(50000, 0)]
    touching = [s for s in segments if junction in {node_ids[(round(s[2][0][0] * 1000), round(s[2][0][1] * 1000))], node_ids[(round(s[2][-1][0] * 1000), round(s[2][-1][1] * 1000))]}]
    assert len(touching) == 4
    assert (25000, 0) not in node_ids


def test_restricted_area_keeps_korean_named_roads():
    base = [_feature(i, [(i * 40, 0), (i * 40 + 40, 0)], name="X Corps Boulevard") for i in range(5)]
    base += [_feature(10 + i, [(i * 40, 120), (i * 40 + 40, 120)], name="Malloy Road") for i in range(5)]
    base += [_feature(20, [(0, 0), (0, 120)], name="Dunn Street"), _feature(21, [(200, 0), (200, 120)], name="Dunn Street")]
    inner = _feature(30, [(60, 30), (60, 90)])
    segments, _ = split_network(base + [inner])
    area = restricted_area(segments)
    assert area.contains(shapely.LineString([(60, 30), (60, 90)]))
    assert not area.contains(shapely.Point(400, 400))


def test_remove_spurs_drops_immediate_u_turns():
    steps = [(1, True), (2, True), (3, True), (3, False), (2, False), (4, True)]
    assert remove_spurs(steps) == [(1, True), (4, True)]
