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
    expect(response.courses.every((course) => course.purpose === "NIGHT")).toBe(
      true,
    );
    expect(
      new Set(response.courses.map((course) => JSON.stringify(course.geometry)))
        .size,
    ).toBe(3);
    expect(
      (await new MockCourseRepository().getCourse(response.courses[0]!.id))
        .geometry,
    ).toEqual(response.courses[0]!.geometry);
  });
  it.each([1000, 7000, 7500, 8000, 10000, 20000])(
    "%i m 코스의 상세 URL을 새 저장소에서 복원한다",
    async (distance) => {
      const response = await new MockCourseRepository().recommend({
        ...request,
        route_type: "loop",
        target_distance_m: distance,
      });
      const repository = new MockCourseRepository();
      for (const course of response.courses)
        expect(await repository.getCourse(course.id)).toEqual(course);
    },
  );
  it("상세 URL의 계약 범위 밖 거리를 거부한다", async () => {
    await expect(
      new MockCourseRepository().getCourse("pace-ichon-99999-day-0"),
    ).rejects.toThrow();
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
    const fetcher = vi.fn().mockResolvedValue(
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

describe("Straight 저장소 교체", () => {
  const straight = recommendationRequestSchema.parse({
    ...request,
    route_type: "straight",
    end: STARTS[1]!.coordinate,
    target_distance_m: null,
  });
  it("후보 세 개를 새 저장소의 상세 URL에서 그대로 복원한다", async () => {
    const response = await new MockCourseRepository().recommend(straight);
    for (const course of response.courses)
      expect(await new MockCourseRepository().getCourse(course.id)).toEqual(
        course,
      );
    await expect(
      new MockCourseRepository().getCourse("straight-pace-ichon-ichon-day-0"),
    ).rejects.toThrow();
  });
  it("HTTP에 목적지와 자동 거리를 보내고 올바른 응답을 받는다", async () => {
    const course = makeMockCourse(straight, "NIGHT");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            schema_version: "1.0",
            request_id: "straight",
            courses: [course],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await new HttpCourseRepository("https://api.example.com").recommend(
          straight,
        )
      ).courses[0],
    ).toEqual(course);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(straight);
  });
  it("HTTP가 요청과 다른 방식이나 목적지를 반환하면 거부한다", async () => {
    for (const course of [
      makeMockCourse(request, "NIGHT"),
      makeMockCourse(
        {
          ...straight,
          route_type: "straight",
          target_distance_m: null,
          end: STARTS[2]!.coordinate,
        },
        "NIGHT",
      ),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({
                schema_version: "1.0",
                request_id: "wrong",
                courses: [course],
              }),
            ),
          ),
      );
      await expect(
        new HttpCourseRepository("https://api.example.com").recommend(straight),
      ).rejects.toThrow(/다른 코스/);
    }
  });
});
