import type { Course, Position } from "../domain/contracts";
import { routeProgress } from "./progress";

export interface NativeCoordinate {
  latitude: number;
  longitude: number;
}
export const nativeCoordinate = ([
  longitude,
  latitude,
]: Position): NativeCoordinate => ({ latitude, longitude });

export function nativeRoutes(
  courses: Course[],
  selectedId?: string,
  progress?: number,
) {
  const selected =
    courses.find((course) => course.id === selectedId) ?? courses[0];
  const trail =
    selected && progress !== undefined
      ? routeProgress(selected.geometry.coordinates, progress)
      : null;
  const routes = courses.map((course) => ({
    id: course.id,
    selected: course.id === selected?.id,
    end:
      course.route_type === "straight"
        ? nativeCoordinate(course.geometry.coordinates.at(-1)!)
        : null,
    points: (course.id === selected?.id && trail
      ? trail.travelled
      : course.geometry.coordinates
    ).map(nativeCoordinate),
  }));
  if (trail && selected && trail.remaining.length > 1)
    routes.push({
      id: `${selected.id}-remaining`,
      selected: false,
      end: null,
      points: trail.remaining.map(nativeCoordinate),
    });
  return routes;
}

export function nativeRunner(
  course: Course | undefined,
  progress?: number,
): NativeCoordinate | null {
  if (!course || progress === undefined || !Number.isFinite(progress))
    return null;
  return nativeCoordinate(
    routeProgress(course.geometry.coordinates, progress)!.position,
  );
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
