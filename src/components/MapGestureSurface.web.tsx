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

// 제스처 중에는 큰 SVG를 다시 그리지 않고 CSS transform으로만 움직인 뒤,
// 손을 떼면(휠은 잠시 멈추면) 카메라를 한 번 확정한다.
export function MapGestureSurface({
  children,
  camera,
  onChange,
}: MapGestureSurfaceProps) {
  const element = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Position>());
  const baseline = useRef<Snapshot | null>(null);
  const latest = useRef({ camera, onChange });
  const view = useRef(camera);
  const pending = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const paint = () => {
    const target = layer.current;
    const bounds = element.current?.getBoundingClientRect();
    if (!target || !bounds) return;
    const base = latest.current.camera;
    const next = view.current;
    if (!pending.current || next === base) {
      target.style.transform = "";
      return;
    }
    const scale = base.width / next.width;
    const x = ((base.x - next.x) / next.width) * bounds.width;
    const y = ((base.y - next.y) / next.height) * bounds.height;
    target.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  };
  useLayoutEffect(() => {
    latest.current = { camera, onChange };
    if (!pending.current) view.current = camera;
    paint();
  }, [camera, onChange]);
  const preview = (next: Camera) => {
    view.current = next;
    pending.current = true;
    paint();
  };
  const commit = () => {
    clearTimeout(wheelTimer.current);
    if (!pending.current) return;
    pending.current = false;
    latest.current.onChange(view.current);
  };
  const point = (event: PointerEvent<HTMLDivElement>): Position => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) / bounds.width,
      (event.clientY - bounds.top) / bounds.height,
    ];
  };
  const begin = () => {
    baseline.current = {
      camera: view.current,
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
    if (current.length < 2 && moved < 4 && !pending.current) return;
    event.preventDefault();
    if (!event.currentTarget.hasPointerCapture(event.pointerId))
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
    preview(
      transformTerrain(
        start.camera,
        factor,
        center(start.points),
        center(current),
      ),
    );
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size) begin();
    else {
      baseline.current = null;
      commit();
    }
  };
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    // 지도 이동 중 화면 밖 도로·지형이 비어 보이지 않게 viewBox 바깥도 그린다.
    target.querySelector("svg")?.style.setProperty("overflow", "visible");
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = target.getBoundingClientRect();
      const anchor: Position = [
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height,
      ];
      preview(
        transformTerrain(
          view.current,
          Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002))),
          anchor,
        ),
      );
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(commit, 150);
    };
    target.addEventListener("wheel", wheel, { passive: false });
    return () => {
      target.removeEventListener("wheel", wheel);
      clearTimeout(wheelTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={element}
      data-testid="map-gesture-surface"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={(event) => {
        // 터치를 처음 받은 SVG 요소가 캡처를 넘겨줄 때도 버블링되므로 무시한다.
        if (event.target === event.currentTarget) end(event);
      }}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
        overscrollBehavior: "contain",
        userSelect: "none",
      }}
    >
      <div
        ref={layer}
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
