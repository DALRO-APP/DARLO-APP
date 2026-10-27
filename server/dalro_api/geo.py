import math
from functools import lru_cache

import shapely
from pyproj import Transformer

Position = tuple[float, float]


@lru_cache(maxsize=None)
def _transformer(source: int, target: int) -> Transformer:
    return Transformer.from_crs(source, target, always_xy=True)


def to_lonlat(xy: list[Position]) -> list[Position]:
    """EPSG:5186 → EPSG:4326 [경도, 위도]."""
    if not xy:
        return []
    xs, ys = zip(*xy)
    lons, lats = _transformer(5186, 4326).transform(xs, ys)
    return [(round(lon, 7), round(lat, 7)) for lon, lat in zip(lons, lats)]


def to_xy(lonlat: list[Position]) -> list[Position]:
    if not lonlat:
        return []
    lons, lats = zip(*lonlat)
    xs, ys = _transformer(4326, 5186).transform(lons, lats)
    return list(zip(xs, ys))


def gpkg_geometry(blob: bytes) -> shapely.Geometry:
    """GeoPackage 바이너리 헤더를 건너뛰고 WKB를 읽는다."""
    if blob[:2] != b"GP":
        raise ValueError("GeoPackage geometry가 아닙니다.")
    envelope = (blob[3] >> 1) & 0b111
    offset = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envelope]
    return shapely.from_wkb(bytes(blob[offset:]))


def haversine(a: Position, b: Position) -> float:
    rad = math.pi / 180
    d_lat = (b[1] - a[1]) * rad
    d_lon = (b[0] - a[0]) * rad
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(a[1] * rad) * math.cos(b[1] * rad) * math.sin(d_lon / 2) ** 2
    )
    return 6371008.8 * 2 * math.asin(min(1.0, math.sqrt(h)))


def line_distance(points: list[Position]) -> float:
    return sum(haversine(points[i], points[i + 1]) for i in range(len(points) - 1))


def slope_pct(slope_deg: float | None) -> float | None:
    """팀 slope_mean은 QGIS 경사 래스터(도) 평균이다. 앱 계약은 %다."""
    if slope_deg is None:
        return None
    return math.tan(math.radians(slope_deg)) * 100
