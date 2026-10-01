import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  courseSchema,
  haversine,
  recommendationRequestSchema,
  roadNetworkSchema,
} from "./contracts";
import { makeMockCourse } from "../data/mock";
import { STARTS } from "./catalog";
const request = recommendationRequestSchema.parse({
  schema_version: "1.0",
  start: STARTS[0]!.coordinate,
  target_distance_m: 5000,
  purpose: "PACE",
  time_of_day: "day",
  route_type: "loop",
  distance_tolerance_ratio: 0.1,
});
describe("데이터 경계와 회귀 경로 계약", () => {
  it.each(["PACE", "POWER", "NIGHT", "GREEN"] as const)(
    "%s 코스는 선택한 출발지로 돌아오며 목표 거리와 일치한다",
    (purpose) => {
      for (const start of STARTS)
        for (const distance of [3000, 5000, 8000]) {
          const course = makeMockCourse(
            {
              ...request,
              start: start.coordinate,
              target_distance_m: distance,
            },
            purpose,
          );
          expect(course.geometry.coordinates[0]).toEqual(start.coordinate);
          expect(
            haversine(
              course.geometry.coordinates[0]!,
              course.geometry.coordinates.at(-1)!,
            ),
          ).toBeLessThan(1);
          expect(Math.abs(course.summary.distance_m - distance)).toBeLessThan(
            10,
          );
        }
    },
  );
  it("허용 오차 0인 요청에서 대안 코스의 거리를 임의로 늘리지 않는다", () => {
    const course = makeMockCourse(
      { ...request, distance_tolerance_ratio: 0 },
      "GREEN",
      1,
    );
    expect(Math.abs(course.summary.distance_m - 5000)).toBeLessThan(10);
  });
  it("열린 경로와 불일치하는 표시 거리를 거부한다", () => {
    const course = makeMockCourse(request, "PACE");
    expect(
      courseSchema.safeParse({
        ...course,
        geometry: {
          ...course.geometry,
          coordinates: course.geometry.coordinates.slice(0, -1),
        },
      }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({
        ...course,
        summary: { ...course.summary, distance_m: 100 },
      }).success,
    ).toBe(false);
  });
  it("미측정과 측정된 0을 구분하며 음수 시설 수를 거부한다", () => {
    const course = makeMockCourse(request, "PACE");
    expect(
      courseSchema.parse({
        ...course,
        summary: { ...course.summary, light_count: null, signal_count: 0 },
      }).summary.light_count,
    ).toBeNull();
    expect(
      courseSchema.safeParse({
        ...course,
        summary: { ...course.summary, signal_count: -1 },
      }).success,
    ).toBe(false);
  });
  it("중복 edge_id와 같은 node의 서로 다른 좌표를 거부한다", () => {
    const network = JSON.parse(
      readFileSync("examples/data/roads.geojson", "utf8"),
    );
    const duplicate = structuredClone(network);
    duplicate.features.push(duplicate.features[0]);
    expect(roadNetworkSchema.safeParse(duplicate).success).toBe(false);
    const disconnected = structuredClone(network);
    disconnected.features[1].geometry.coordinates[0][0] += 0.0005;
    expect(roadNetworkSchema.safeParse(disconnected).success).toBe(false);
  });
  it("경위도 범위와 지원하지 않는 목적을 거부한다", () => {
    expect(
      recommendationRequestSchema.safeParse({ ...request, start: [200, 37] })
        .success,
    ).toBe(false);
    expect(
      recommendationRequestSchema.safeParse({ ...request, purpose: "FASTEST" })
        .success,
    ).toBe(false);
  });
});
