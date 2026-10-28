import struct
import zlib

import numpy as np

from dalro_api.map_assets import png_rgba, read_ascii_dem


def test_dem_keeps_north_to_south_rows_and_nodata(tmp_path):
    path = tmp_path / "dem.tif"
    path.write_text("NCOLS 2\nNROWS 2\nXLLCORNER 195050\nYLLCORNER 444922.9\nDX 5\nDY 5\nNODATA_VALUE -9999\n10 20\n30 -9999\n")
    grid, header = read_ascii_dem(path)
    assert grid.tolist() == [[10, 20], [30, -9999]]
    assert header["xllcorner"] == 195050
    assert header["nodata_value"] == -9999


def test_relief_png_preserves_transparent_nodata_and_dimensions(tmp_path):
    pixels = np.array([[[30, 40, 30, 255], [0, 0, 0, 0]]], dtype=np.uint8)
    path = tmp_path / "relief.png"
    png_rgba(path, pixels)
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    assert struct.unpack(">II", data[16:24]) == (2, 1)
    offset = 8
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        assert zlib.crc32(kind + payload) == struct.unpack(">I", data[offset + 8 + length:offset + 12 + length])[0]
        if kind == b"IDAT":
            assert zlib.decompress(payload) == b"\0" + pixels[0].tobytes()
        offset += length + 12
