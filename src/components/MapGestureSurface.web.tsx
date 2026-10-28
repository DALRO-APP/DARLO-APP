import { useEffect, useLayoutEffect, useRef, type PointerEvent } from "react";
import type { Position } from "../domain/contracts";
import { transformTerrain, type Camera } from "../maps/terrain";
import type { MapGestureSurfaceProps } from "./MapGestureSurface";

type Snapshot = { camera: Camera; points: Position[] };
const center = (points: Position[]): Position =>
  points.length > 1
    ? [(points[0]![0] + points[1]![0]) / 2, (points[0]![1] + points[1]![1]) / 2]
    : points[0]!;
const distance = (points: Position[]) =>
  Math.hypot(points[1]![0] - points[0]![0], points[1]![1] - points[0]![1]);

export function MapGestureSurface({
  children,
  camera,
  onChange,
}: MapGestureSurfaceProps) {
  const element = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Position>());
  const baseline = useRef<Snapshot | null>(null);
  const latest = useRef({ camera, onChange });
  useLayoutEffect(() => {
    latest.current = { camera, onChange };
  }, [camera, onChange]);
  const point = (event: PointerEvent<HTMLDivElement>): Position => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) / bounds.width,
      (event.clientY - bounds.top) / bounds.height,
    ];
  };
  const begin = () => {
    baseline.current = {
      camera: latest.current.camera,
      points: [...pointers.current.values()].slice(0, 2),
    };
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.set(event.pointerId, point(event));
    begin();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !baseline.current) return;
    pointers.current.set(event.pointerId, point(event));
    const start = baseline.current;
    const current = [...pointers.current.values()].slice(0, 2);
    if (start.points.length !== current.length) {
      begin();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const moved = Math.hypot(
      (current[0]![0] - start.points[0]![0]) * bounds.width,
      (current[0]![1] - start.points[0]![1]) * bounds.height,
    );
    if (current.length < 2 && moved < 4) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startPixels = start.points.map(
      ([x, y]) => [x * bounds.width, y * bounds.height] as Position,
    );
    const currentPixels = current.map(
      ([x, y]) => [x * bounds.width, y * bounds.height] as Position,
    );
    const factor =
      current.length > 1
        ? distance(startPixels) / Math.max(1, distance(currentPixels))
        : 1;
    latest.current.onChange(
      transformTerrain(
        start.camera,
        factor,
        center(start.points),
        center(current),
      ),
    );
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size) begin();
    else baseline.current = null;
  };
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = target.getBoundingClientRect();
      const anchor: Position = [
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height,
      ];
      latest.current.onChange(
        transformTerrain(
          latest.current.camera,
          Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002))),
          anchor,
        ),
      );
    };
    target.addEventListener("wheel", wheel, { passive: false });
    return () => target.removeEventListener("wheel", wheel);
  }, []);
  return (
    <div
      ref={element}
      data-testid="map-gesture-surface"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      style={{
        position: "absolute",
        inset: 0,
        touchAction: "none",
        overscrollBehavior: "contain",
        userSelect: "none",
      }}
    >
      {children}
    </div>
  );
}
