import { describe, expect, it } from "vitest";
import { courseReviewIssue } from "./course-review";
import review from "../../server/seed/yongsan-quality-review.json";
import { makeMockCourse } from "../data/mock";
import { STARTS } from "./catalog";

const course = {
  ...makeMockCourse(
    {
      schema_version: "1.0",
      start: STARTS[0]!.coordinate,
      purpose: "PACE",
      route_type: "loop",
      target_distance_m: 5000,
      time_of_day: "day",
      distance_tolerance_ratio: 0.1,
    },
    "PACE",
  ),
  is_mock: false,
  data_version: review.base_network_version,
};
describe("검토로 바뀐 코스의 재추천", () => {
  it("보행 불가 구간과 경사 보정 이전 코스를 구분한다", () => {
    expect(courseReviewIssue({ ...course, edge_ids: ["1366-0"] })).toContain(
      "보행 불가",
    );
    expect(courseReviewIssue({ ...course, edge_ids: ["18-0"] })).toContain(
      "경사 미측정",
    );
    expect(
      courseReviewIssue({
        ...course,
        edge_ids: ["18-0"],
        data_version: review.effective_network_version,
      }),
    ).toBeNull();
    expect(
      courseReviewIssue({
        ...course,
        edge_ids: ["1366-0"],
        data_version: review.effective_network_version,
      }),
    ).toContain("보행 불가");
  });
  it("다른 버전·더미·검토와 무관한 코스는 유지한다", () => {
    expect(
      courseReviewIssue({
        ...course,
        edge_ids: ["1366-0"],
        data_version: "another-version",
      }),
    ).toBeNull();
    expect(
      courseReviewIssue({ ...course, edge_ids: ["1366-0"], is_mock: true }),
    ).toBeNull();
    expect(courseReviewIssue({ ...course, edge_ids: ["1109-1"] })).toBeNull();
  });
});
