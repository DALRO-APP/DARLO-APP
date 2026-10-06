import { describe, expect, it } from "vitest";
import { parseDistanceKm, courseExplanation } from "./presentation";
import { makeMockCourse } from "../data/mock";
import { STARTS } from "./catalog";
describe("직접 입력 거리", () => {
  it.each([
    ["1", 1000],
    ["20", 20000],
    ["7.125", 7125],
    [" 8 ", 8000],
  ])("%s km를 m로 바꾼다", (input, expected) =>
    expect(parseDistanceKm(input)).toBe(expected),
  );
  it.each([
    "",
    "0",
    "0.999",
    "20.001",
    "-3",
    "abc",
    "5km",
    "1e1",
    "7.1234",
    "1,5",
  ])("잘못된 입력 %s를 거부한다", (input) =>
    expect(parseDistanceKm(input)).toBeNull(),
  );
  it("미측정 녹지 비율을 0으로 표시하지 않는다", () => {
    const course = makeMockCourse(
      {
        schema_version: "1.0",
        start: STARTS[0]!.coordinate,
        target_distance_m: 5000,
        purpose: "GREEN",
        time_of_day: "day",
        route_type: "loop",
        distance_tolerance_ratio: 0.1,
      },
      "GREEN",
    );
    course.summary.green_ratio = null;
    expect(courseExplanation(course)).not.toContain("0%");
    course.summary.green_ratio = 0;
    expect(courseExplanation(course)).toContain("0%");
  });
});
