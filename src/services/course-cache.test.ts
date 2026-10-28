import { describe, expect, it, vi } from "vitest";
import { CourseCache } from "./course-cache";
import { HttpCourseRepository } from "./repository";
import { makeMockCourse } from "../data/mock";
import { STARTS } from "../domain/catalog";
import type { RecommendationRequest } from "../domain/contracts";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
}));
const request: RecommendationRequest = {
  schema_version: "1.0",
  start: STARTS[0]!.coordinate,
  route_type: "loop",
  purpose: "PACE",
  target_distance_m: 5000,
  time_of_day: "day",
  distance_tolerance_ratio: 0.1,
};
const realCourse = {
  ...makeMockCourse(request, "PACE"),
  id: "pace-loop-server-course",
  is_mock: false,
};
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
describe("일시적인 서버 저장과 독립적인 코스 상세", () => {
  it("추천받은 서버 코스는 저장소 인스턴스를 새로 만들어도 HTTP 요청 없이 복원한다", async () => {
    const disk = storage();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            schema_version: "1.0",
            request_id: "demo",
            courses: [realCourse],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    try {
      await new HttpCourseRepository(
        "/api",
        new CourseCache("/api", disk),
      ).recommend(request);
      fetcher.mockRejectedValue(
        new Error("새 서버 인스턴스에는 코스가 없습니다."),
      );
      const fresh = new HttpCourseRepository(
        "/api",
        new CourseCache("/api", disk),
      );
      expect(await fresh.getCourse(realCourse.id)).toEqual(realCourse);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("서버 주소가 다르면 캐시를 공유하지 않으며 손상된 캐시를 무시한다", async () => {
    const disk = storage();
    await new CourseCache("a", disk).remember([realCourse]);
    expect(await new CourseCache("b", disk).get(realCourse.id)).toBeUndefined();
    await disk.setItem(
      "dalro-server-courses-v1:a",
      JSON.stringify([{ id: realCourse.id, geometry: {} }]),
    );
    expect(await new CourseCache("a", disk).get(realCourse.id)).toBeUndefined();
  });
  it("최근 24개만 보관하고 동시 저장 응답을 잃지 않는다", async () => {
    const cache = new CourseCache("bounded", storage());
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        cache.remember([{ ...realCourse, id: `server-${i}` }]),
      ),
    );
    expect(await cache.get("server-0")).toBeUndefined();
    expect(await cache.get("server-6")).toBeDefined();
    expect(await cache.get("server-29")).toBeDefined();
  });
  it("기기 저장소가 막혀 있어도 정상 추천을 막지 않는다", async () => {
    const cache = new CourseCache("blocked", {
      getItem: async () => {
        throw Error("blocked");
      },
      setItem: async () => {
        throw Error("blocked");
      },
    });
    await expect(cache.remember([realCourse])).resolves.toBeUndefined();
    expect(await cache.get(realCourse.id)).toBeUndefined();
  });
});
