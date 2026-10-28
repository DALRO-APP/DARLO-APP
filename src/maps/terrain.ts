import type { Position } from "../domain/contracts";
import data from "../data/terrain-map.json";

export const terrain = data;
const radius = 6378137;
export function terrainPoint([lon, lat]: Position): Position {
  const safeLat = Math.max(-85, Math.min(85, lat));
  return [
    (radius * lon * Math.PI) / 180 - terrain.origin[0]!,
    terrain.origin[1]! -
      radius * Math.log(Math.tan(Math.PI / 4 + (safeLat * Math.PI) / 360)),
  ];
}
export type Camera = { x: number; y: number; width: number; height: number };
export function fitTerrain(points: Position[], aspect: number): Camera {
  const projected = points.length
    ? points.map(terrainPoint)
    : [[terrain.width / 2, terrain.height / 2]];
  const xs = projected.map((p) => p[0]!);
  const ys = projected.map((p) => p[1]!);
  const left = Math.min(...xs),
    right = Math.max(...xs);
  const top = Math.min(...ys),
    bottom = Math.max(...ys);
  const height = Math.max(
    ((right - left) * 1.45) / aspect,
    (bottom - top) * 1.65,
    2100,
  );
  const width = height * aspect;
  return {
    x: (left + right - width) / 2,
    y: (top + bottom - height) / 2,
    width,
    height,
  };
}
export function zoomTerrain(camera: Camera, factor: number): Camera {
  const width = Math.min(24000, Math.max(450, camera.width * factor));
  const height = (camera.height * width) / camera.width;
  return {
    x: camera.x + (camera.width - width) / 2,
    y: camera.y + (camera.height - height) / 2,
    width,
    height,
  };
}

// 손가락 중심의 지도 좌표를 고정한 채 핀치 확대와 이동을 함께 반영한다.
export function transformTerrain(
  camera: Camera,
  factor: number,
  anchor: Position,
  nextAnchor: Position = anchor,
): Camera {
  const frame = zoomTerrain(camera, factor);
  return {
    ...frame,
    x: camera.x + anchor[0] * camera.width - nextAnchor[0] * frame.width,
    y: camera.y + anchor[1] * camera.height - nextAnchor[1] * frame.height,
  };
}
