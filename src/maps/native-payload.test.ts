import { describe, expect, it } from "vitest";
import { makeMockCourse } from "../data/mock";
import { recommendationRequestSchema } from "../domain/contracts";
import {
  nativeCamera,
  nativeCoordinate,
  nativeRoutes,
  nativeRunner,
} from "./native-payload";

describe("native 지도 경계", () => {
  it("GeoJSON을 위도/경도 필드로 전달하며 선택 코스는 하나다", () => {
    expect(nativeCoordinate([126.9745, 37.5178])).toEqual({
      latitude: 37.5178,
      longitude: 126.9745,
    });
    const courses = fixtures();
    const lines = nativeRoutes(courses, courses[1]!.id);
    expect(
      lines.filter((line) => line.selected).map((line) => line.id),
    ).toEqual([courses[1]!.id]);
    expect(lines[0]!.points[0]).toEqual(
      nativeCoordinate(courses[0]!.geometry.coordinates[0]!),
    );
    expect(
      nativeRoutes(courses, "missing")
        .filter((line) => line.selected)
        .map((line) => line.id),
    ).toEqual([courses[0]!.id]);
  });
  it("러너를 보간하고 종료 위치·비정상 진행률을 처리한다", () => {
    const course = fixtures()[0]!;
    const [start, next] = course.geometry.coordinates;
    expect(nativeRunner(course)).toBeNull();
    expect(nativeRunner(course, Number.NaN)).toBeNull();
    expect(nativeRunner(course, -1)).toEqual(nativeCoordinate(start!));
    expect(nativeRunner(course, 2)).toEqual(
      nativeCoordinate(course.geometry.coordinates.at(-1)!),
    );
    const halfSegment = 0.5 / (course.geometry.coordinates.length - 1);
    expect(nativeRunner(course, halfSegment)).toEqual(
      nativeCoordinate([
        (start![0] + next![0]) / 2,
        (start![1] + next![1]) / 2,
      ]),
    );
  });
  it("주행한 선과 남은 선을 나누고 러너가 두 선의 경계에 위치한다", () => {
    const course = fixtures()[0]!;
    const lines = nativeRoutes([course], course.id, 0.35);
    const travelled = lines.find((line) => line.selected)!;
    const remaining = lines.find((line) => !line.selected)!;
    expect(travelled.points[0]).toEqual(
      nativeCoordinate(course.geometry.coordinates[0]!),
    );
    expect(travelled.points.at(-1)).toEqual(nativeRunner(course, 0.35));
    expect(remaining.points[0]).toEqual(nativeRunner(course, 0.35));
    expect(remaining.points.at(-1)).toEqual(
      nativeCoordinate(course.geometry.coordinates.at(-1)!),
    );
    expect(nativeRoutes([course], course.id, 1)).toHaveLength(1);
    expect(nativeRoutes([course], course.id, Number.NaN)).toEqual(
      nativeRoutes([course], course.id),
    );
  });
  it("코스 전체를 담는 중심/줌을 계산하고 작은 지도에서 더 넓게 보여준다", () => {
    const points = fixtures().flatMap((course) => course.geometry.coordinates);
    const large = nativeCamera(points, 1200, 700);
    const small = nativeCamera(points, 300, 250);
    expect(small.zoomLevel).toBeLessThan(large.zoomLevel);
    expect(large.latitude).toBeGreaterThanOrEqual(
      Math.min(...points.map((point) => point[1])),
    );
    expect(large.latitude).toBeLessThanOrEqual(
      Math.max(...points.map((point) => point[1])),
    );
    expect(large.longitude).toBeCloseTo(
      (Math.min(...points.map((point) => point[0])) +
        Math.max(...points.map((point) => point[0]))) /
        2,
    );
    expect(nativeCamera([], 0, 0)).toEqual({
      latitude: 37.5178,
      longitude: 126.9745,
      zoomLevel: 15,
    });
    expect(Number.isFinite(nativeCamera([[126.9, 37.5]], 0, 0).zoomLevel)).toBe(
      true,
    );
  });
});

function fixtures() {
  const request = recommendationRequestSchema.parse({
    schema_version: "1.0",
    start: [126.9745, 37.5178],
    target_distance_m: 5000,
    purpose: "PACE",
    time_of_day: "day",
    route_type: "loop",
    distance_tolerance_ratio: 0.1,
  });
  return (["PACE", "GREEN", "POWER"] as const).map((purpose) =>
    makeMockCourse(request, purpose),
  );
}

it("Straight 도착 표시는 진행률과 무관하게 실제 목적지에 남는다", () => {
  const end: [number, number] = [126.991, 37.5205];
  const course = makeMockCourse(
    {
      schema_version: "1.0",
      start: [126.9745, 37.5178],
      end,
      target_distance_m: null,
      purpose: "PACE",
      time_of_day: "day",
      route_type: "straight",
      distance_tolerance_ratio: 0.1,
    },
    "PACE",
  );
  for (const progress of [0, 0.4, 1]) {
    expect(
      nativeRoutes([course], course.id, progress).find((line) => line.selected)!
        .end,
    ).toEqual(nativeCoordinate(end));
  }
  expect(nativeRunner(course, 1)).toEqual(nativeCoordinate(end));
});
