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
  it("실제 추천은 고정 문구 대신 서버 근거를 보여준다", () => {
    const course = makeMockCourse(
      {
        schema_version: "1.0",
        start: STARTS[0]!.coordinate,
        target_distance_m: 5000,
        purpose: "PACE",
        time_of_day: "day",
        route_type: "loop",
        distance_tolerance_ratio: 0.1,
      },
      "PACE",
    );
    expect(courseExplanation(course)).toContain("신호가 적어");
    course.is_mock = false;
    course.reasons = [
      {
        code: "signals",
        title: "멈춤 요인 정보 반영",
        description: "신호 부착대·횡단보도 km당 9.1곳 (용산구 도로 평균 5.1곳)",
      },
      { code: "loop", title: "출발지로 돌아오기", description: "제자리로" },
    ];
    expect(courseExplanation(course)).toBe(
      "신호 부착대·횡단보도 km당 9.1곳 (용산구 도로 평균 5.1곳)",
    );
  });
});
