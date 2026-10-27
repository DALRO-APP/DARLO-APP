"""PACE 목적의 도로 비용.

노션 '중간 발표 전 결과물 · PACE의 가중치 설정 및 cost 계산'(김시원):

    stop_den  = (signal_cnt + cross_cnt) / length_m
    stop_cap  = min(stop_den, 0.275)          # Q3 + 1.5·IQR
    stop_norm = min-max(stop_cap)
    C(e)      = length_m · [1 + a · (0.83·stop_norm + 0.17·slope_norm)]

가중치는 AHP(신호/횡단보도 : 경사 = 5 : 1) 결과이며 팀 실험값이다.
"""

from .config import PACE_ALPHA, PACE_SLOPE_WEIGHT, PACE_STOP_WEIGHT, STOP_DENSITY_CAP


def stop_density(signal_cnt: int, cross_cnt: int, length_m: float) -> float:
    return (signal_cnt + cross_cnt) / length_m if length_m > 0 else 0.0


def normalize_stop_density(densities: list[float], cap: float = STOP_DENSITY_CAP) -> list[float]:
    capped = [min(value, cap) for value in densities]
    low, high = min(capped), max(capped)
    if high <= low:
        return [0.0 for _ in capped]
    return [(value - low) / (high - low) for value in capped]


def penalty(stop_norm: float, slope_norm: float | None) -> float:
    """0~1 환경 악화 점수. 경사 미측정 구간은 경사 항을 0으로 두지 않고 최대값으로 본다."""
    slope = 1.0 if slope_norm is None else slope_norm
    return PACE_STOP_WEIGHT * stop_norm + PACE_SLOPE_WEIGHT * slope


def cost(length_m: float, penalty_value: float, alpha: float = PACE_ALPHA) -> float:
    return length_m * (1 + alpha * penalty_value)
