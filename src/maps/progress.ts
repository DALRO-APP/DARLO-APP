import type { Position } from "../domain/contracts";

// 일정한 시간 비율로 geometry를 따라가는 모의 이동입니다.
export function routeProgress(points: Position[], progress: number) {
  if (!points.length || !Number.isFinite(progress)) return null;
  const cursor = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const index = Math.floor(cursor);
  const first = points[index]!;
  const next = points[Math.min(index + 1, points.length - 1)]!;
  const position: Position = [
    first[0] + (next[0] - first[0]) * (cursor - index),
    first[1] + (next[1] - first[1]) * (cursor - index),
  ];
  return {
    position,
    travelled: [...points.slice(0, index + 1), position],
    remaining: [position, ...points.slice(index + 1)],
  };
}
