"""노션 원본 → 앱에 번들하는 용산구 공간정보 지도. DB를 변경하지 않는다.

server/에서 .venv/bin/python -m dalro_api.map_assets
"""

import hashlib
import json
import math
import struct
import tempfile
import zlib
from pathlib import Path

import numpy as np
import shapefile
import shapely
from pyproj import CRS, Transformer
from shapely.ops import transform

from .geo import gpkg_geometry
from .importer import (
    LIGHT_MEMBER, LIGHT_ZIP, ROADS_MEMBER, ROADS_ZIP, SIGNAL_ZIP,
    extract, read_districts, read_features,
)

ROOT = Path(__file__).resolve().parents[2]
DEM_ZIP = "yongsan_slope_preprocessing.zip"


def read_ascii_dem(path: Path):
    """확장자는 tif지만 실제 형식은 ESRI ASCII다. 셀 중심·북→남 행 순서를 보존한다."""
    with path.open() as f:
        header = dict(f.readline().lower().split() for _ in range(7))
        grid = np.loadtxt(f)
    assert grid.shape == (int(header["nrows"]), int(header["ncols"]))
    return grid, {k: float(v) for k, v in header.items()}


def png_rgba(path: Path, pixels):
    height, width, _ = pixels.shape
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    raw = b"".join(b"\0" + row.tobytes() for row in pixels)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    )


def main():
    raw = ROOT / "server/data/raw"
    to_mercator = Transformer.from_crs(5186, 3857, always_xy=True).transform
    with tempfile.TemporaryDirectory() as directory:
        tmp = Path(directory)
        district = read_districts(raw, tmp)["용산구"]
        area = transform(to_mercator, district)
        west, south, east, north = area.buffer(700).bounds
        width, height = east - west, north - south
        def local(geom, crs=5186):
            projected = transform(Transformer.from_crs(crs, 3857, always_xy=True).transform, geom)
            return transform(lambda x, y, z=None: (np.asarray(x) - west, north - np.asarray(y)), projected)

        def path(geom):
            if geom.is_empty:
                return ""
            if hasattr(geom, "geoms"):
                return "".join(path(g) for g in geom.geoms)
            if geom.geom_type == "Polygon":
                return path(geom.exterior) + "Z" + "".join(path(r) + "Z" for r in geom.interiors)
            return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in geom.coords)

        road_file = extract(raw / ROADS_ZIP, {ROADS_MEMBER}, tmp)[ROADS_MEMBER]
        features = read_features(road_file)
        roads = [[] for _ in range(4)]
        for feature in features:
            # 표시용 도로망이다. 통행 가능 여부는 추천 서버에서 판정한다.
            pct = None if feature.slope_deg is None else math.tan(math.radians(feature.slope_deg)) * 100
            bucket = 3 if pct is None else 0 if pct < 5 else 1 if pct < 10 else 2
            for part in feature.parts:
                roads[bucket].append(path(local(shapely.LineString(part).simplify(2))))

        parks_file = extract(raw / LIGHT_ZIP, {LIGHT_MEMBER}, tmp)[LIGHT_MEMBER]
        import sqlite3
        with sqlite3.connect(parks_file.as_uri() + "?mode=ro", uri=True) as con:
            blobs = con.execute("select geom from seoul_parks_5186").fetchall()
        parks = []
        clip = district.buffer(400)
        for (blob,) in blobs:
            geom = shapely.make_valid(gpkg_geometry(blob)).intersection(clip)
            if not geom.is_empty:
                parks.append(path(local(geom.simplify(6))))

        files = extract(raw / DEM_ZIP, {"보간.tif", "보간.prj", "등고.shp", "등고.shx", "등고.dbf", "등고.prj"}, tmp)
        dem_crs = CRS.from_wkt(files["보간.prj"].read_text().strip())
        grid, header = read_ascii_dem(files["보간.tif"])
        # 하나의 Web Mercator 격자로 재투영하므로 벡터·DEM·코스가 같은 위치에 겹친다.
        raster_width = 1400
        raster_height = round(raster_width * height / width)
        xs = west + (np.arange(raster_width) + 0.5) * width / raster_width
        ys = north - (np.arange(raster_height) + 0.5) * height / raster_height
        xx, yy = Transformer.from_crs(3857, dem_crs, always_xy=True).transform(*np.meshgrid(xs, ys))
        col = np.rint((xx - header["xllcorner"]) / header["dx"] - 0.5).astype(int)
        row = np.rint(grid.shape[0] - 0.5 - (yy - header["yllcorner"]) / header["dy"]).astype(int)
        valid = (row >= 0) & (row < grid.shape[0]) & (col >= 0) & (col < grid.shape[1])
        elevations = grid[np.clip(row, 0, grid.shape[0] - 1), np.clip(col, 0, grid.shape[1] - 1)]
        valid &= elevations != header["nodata_value"]
        elevations = np.where(valid, elevations, 0)
        gy, gx = np.gradient(elevations, height / raster_height, width / raster_width)
        # 북서쪽 빛. 3857 축척을 실제 지상 거리로 보정한다.
        factor = math.cos(math.radians(37.53))
        gx, gy = gx / factor, gy / factor
        shade = np.clip((1 - 1.8 * gx - 1.8 * gy) / np.sqrt(1 + 5 * gx * gx + 5 * gy * gy), -1, 1)
        elevation_tint = np.clip(elevations / 240, 0, 1)
        rgb = np.array([22, 31, 29]) + elevation_tint[..., None] * np.array([29, 35, 21])
        rgb += shade[..., None] * np.array([9, 12, 10])
        pixels = np.dstack((np.clip(rgb, 0, 255).astype(np.uint8), (valid * 255).astype(np.uint8)))
        assets = ROOT / "assets/maps"
        assets.mkdir(parents=True, exist_ok=True)
        png_rgba(assets / "yongsan-relief.png", pixels)

        contours = []
        contour_crs = CRS.from_wkt(files["등고.prj"].read_text().strip())
        with shapefile.Reader(str(files["등고.shp"])) as reader:
            for item in reader.iterShapes():
                geom = shapely.geometry.shape(item.__geo_interface__)
                # 원본 등고선을 그대로 쓰되 지도 표시를 위해 5m로 단순화한다.
                contours.append(path(local(geom.simplify(5), contour_crs)))
        sources = {name: hashlib.sha256((raw / name).read_bytes()).hexdigest() for name in (ROADS_ZIP, DEM_ZIP, LIGHT_ZIP, SIGNAL_ZIP)}
        data = dict(
            schema_version="1.0", projection="EPSG:3857", origin=[west, north],
            width=round(width, 3), height=round(height, 3),
            network_version="yongsan-verified-" + hashlib.sha256(road_file.read_bytes()).hexdigest()[:8],
            dem_crs_wkt=dem_crs.to_wkt(), source_sha256=sources,
            road_count=len(features), park_count=len(parks),
            roads=["".join(group) for group in roads], parks="".join(parks),
            boundary=path(local(district.simplify(5))), contours="".join(contours),
        )
        target = ROOT / "src/data/terrain-map.json"
        target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"지도 생성: 도로 {len(features)} · 공원 {len(parks)} · DEM {dem_crs.to_string()} → EPSG:3857 · {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
