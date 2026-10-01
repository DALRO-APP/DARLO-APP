import type { Course, Position } from "../domain/contracts";

export interface NativeCoordinate {
  latitude: number;
  longitude: number;
}
export const nativeCoordinate = ([
  longitude,
  latitude,
]: Position): NativeCoordinate => ({ latitude, longitude });

export function nativeRoutes(courses: Course[], selectedId?: string) {
  const selected =
    courses.find((course) => course.id === selectedId) ?? courses[0];
  return courses.map((course) => ({
    id: course.id,
    selected: course.id === selected?.id,
    points: course.geometry.coordinates.map(nativeCoordinate),
  }));
}

export function nativeRunner(
  course: Course | undefined,
  progress?: number,
): NativeCoordinate | null {
  if (!course || progress === undefined || !Number.isFinite(progress))
    return null;
  const points = course.geometry.coordinates;
  const cursor = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const index = Math.floor(cursor);
  const first = points[index]!;
  const next = points[Math.min(index + 1, points.length - 1)]!;
  return nativeCoordinate([
    first[0] + (next[0] - first[0]) * (cursor - index),
    first[1] + (next[1] - first[1]) * (cursor - index),
  ]);
}

// Fit Web Mercator bounds with room for markers; progress updates never change the camera.
export function nativeCamera(
  points: Position[],
  width: number,
  height: number,
) {
  if (!points.length)
    return { latitude: 37.5178, longitude: 126.9745, zoomLevel: 15 };
  const xs = points.map(([lon]) => (lon + 180) / 360);
  const y = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  };
  const ys = points.map(([, lat]) => y(Math.max(-85, Math.min(85, lat))));
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const zoom = Math.floor(
    Math.min(
      Math.log2(
        Math.max(80, width - 90) / (256 * Math.max(maxX - minX, 0.000001)),
      ),
      Math.log2(
        Math.max(80, height - 90) / (256 * Math.max(maxY - minY, 0.000001)),
      ),
    ),
  );
  return {
    longitude: ((minX + maxX) / 2) * 360 - 180,
    latitude:
      (Math.atan(Math.sinh(Math.PI * (1 - minY - maxY))) * 180) / Math.PI,
    zoomLevel: Math.max(1, Math.min(19, zoom)),
  };
}
