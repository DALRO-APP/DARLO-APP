import { describe, expect, it, vi, afterEach } from "vitest";
import { MockCourseRepository, HttpCourseRepository } from "./repository";
import { STARTS } from "../domain/catalog";
import { recommendationRequestSchema } from "../domain/contracts";
import { makeMockCourse } from "../data/mock";
const request = recommendationRequestSchema.parse({
  schema_version: "1.0",
  start: STARTS[0]!.coordinate,
  target_distance_m: 5000,
  purpose: "NIGHT",
  time_of_day: "night",
  route_type: "loop",
  distance_tolerance_ratio: 0.1,
});
afterEach(() => vi.unstubAllGlobals());
describe("추천 저장소 교체 계약", () => {
  it("선택 목적을 먼저 반환하고 새 저장소에서도 상세 URL을 복원한다", async () => {
    const response = await new MockCourseRepository().recommend(request);
    expect(response.courses).toHaveLength(3);
    expect(response.courses[0]!.purpose).toBe("NIGHT");
    expect(
      (await new MockCourseRepository().getCourse(response.courses[0]!.id))
        .geometry,
    ).toEqual(response.courses[0]!.geometry);
  });
  it("취소된 추천을 전달하지 않는다", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new MockCourseRepository().recommend(request, controller.signal),
    ).rejects.toThrow("취소");
  });
  it("HTTP 어댑터가 request를 전달하고 잘못된 서버 좌표를 거부한다", async () => {
    const course = makeMockCourse(request, "NIGHT");
    course.geometry.coordinates[1] = [230, 37];
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            schema_version: "1.0",
            request_id: "test",
            courses: [course],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      new HttpCourseRepository("https://api.example.com/").recommend(request),
    ).rejects.toThrow();
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://api.example.com/v1/courses/recommendations",
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(request);
  });
  it("서버 오류를 화면에서 쓸 수 있는 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    await expect(
      new HttpCourseRepository("https://api.example.com").recommend(request),
    ).rejects.toThrow("다시 시도");
  });
});
