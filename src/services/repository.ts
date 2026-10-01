import {
  courseSchema,
  recommendationRequestSchema,
  recommendationResponseSchema,
  type RecommendationRequest,
  type RecommendationResponse,
  type Course,
  type Purpose,
} from "../domain/contracts";
import { makeMockCourse } from "../data/mock";

export interface CourseRepository {
  recommend(
    request: RecommendationRequest,
    signal?: AbortSignal,
  ): Promise<RecommendationResponse>;
  getCourse(id: string, signal?: AbortSignal): Promise<Course>;
}
export class MockCourseRepository implements CourseRepository {
  private courses = new Map<string, Course>();
  async recommend(
    input: RecommendationRequest,
    signal?: AbortSignal,
  ): Promise<RecommendationResponse> {
    const request = recommendationRequestSchema.parse(input);
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("요청이 취소되었습니다."));
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("요청이 취소되었습니다."));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, 420);
      signal?.addEventListener("abort", abort, { once: true });
    });
    const alternate: Purpose[] =
      request.time_of_day === "night"
        ? ["NIGHT", "PACE", "GREEN", "POWER"]
        : ["PACE", "GREEN", "POWER", "NIGHT"];
    const purposes = [
      request.purpose,
      ...alternate.filter((p) => p !== request.purpose),
    ].slice(0, 3);
    const courses = purposes.map((p, rank) => makeMockCourse(request, p, rank));
    courses.forEach((c) => this.courses.set(c.id, c));
    return recommendationResponseSchema.parse({
      schema_version: "1.0",
      request_id: "demo-recommendation",
      courses,
    });
  }
  async getCourse(id: string): Promise<Course> {
    const existing = this.courses.get(id);
    if (existing) return existing;
    // URL 직접 진입/새로고침에서도 동일한 데모 코스를 복원합니다.
    const match =
      /^(pace|power|night|green)-(ichon|namsan|yongsan)-(3000|5000|8000)-(day|night)-([0-2])$/.exec(
        id,
      );
    if (!match)
      throw new Error("코스를 찾을 수 없습니다. 홈에서 다시 추천받아 주세요.");
    const { STARTS } = await import("../domain/catalog");
    const start = STARTS.find((s) => s.id === match[2])!;
    return makeMockCourse(
      {
        schema_version: "1.0",
        start: start.coordinate,
        target_distance_m: Number(match[3]),
        purpose: match[1]!.toUpperCase() as Purpose,
        time_of_day: match[4] as "day" | "night",
        route_type: "loop",
        distance_tolerance_ratio: 0.1,
      },
      match[1]!.toUpperCase() as Purpose,
      Number(match[5]),
    );
  }
}

export class HttpCourseRepository implements CourseRepository {
  constructor(private readonly baseUrl: string) {}
  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, 15000);
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, "")}${path}`,
        {
          ...init,
          headers: { "Content-Type": "application/json", ...init.headers },
          signal: controller.signal,
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 422
            ? "이 조건으로 코스를 찾지 못했어요. 거리나 출발지를 바꿔 주세요."
            : "코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      return await response.json();
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abort);
    }
  }
  async recommend(request: RecommendationRequest, signal?: AbortSignal) {
    return recommendationResponseSchema.parse(
      await this.request("/v1/courses/recommendations", {
        method: "POST",
        body: JSON.stringify(recommendationRequestSchema.parse(request)),
        signal,
      }),
    );
  }
  async getCourse(id: string, signal?: AbortSignal) {
    return courseSchema.parse(
      await this.request(`/v1/courses/${encodeURIComponent(id)}`, { signal }),
    );
  }
}
const source = process.env.EXPO_PUBLIC_DATA_SOURCE ?? "mock";
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (source !== "mock" && source !== "http")
  throw new Error("EXPO_PUBLIC_DATA_SOURCE는 mock 또는 http여야 합니다.");
if (source === "http" && !apiUrl)
  throw new Error("http 모드에는 EXPO_PUBLIC_API_URL이 필요합니다.");
export const courseRepository: CourseRepository =
  source === "http"
    ? new HttpCourseRepository(apiUrl!)
    : new MockCourseRepository();
export const isDemo = source === "mock";
