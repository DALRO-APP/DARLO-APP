import {
  courseSchema,
  placeSearchResponseSchema,
  recommendationRequestSchema,
  recommendationResponseSchema,
  parseRecommendations,
  type RecommendationRequest,
  type RecommendationResponse,
  type Course,
  type PlaceSearchResponse,
  type Purpose,
} from "../domain/contracts";
import { MOCK_PLACE_ID, makeMockCourse, parsePlaceId } from "../data/mock";
import { searchDemoPlaces } from "../data/places";

export interface CourseRepository {
  recommend(
    request: RecommendationRequest,
    signal?: AbortSignal,
  ): Promise<RecommendationResponse>;
  getCourse(id: string, signal?: AbortSignal): Promise<Course>;
  searchPlaces(
    query: string,
    signal?: AbortSignal,
  ): Promise<PlaceSearchResponse>;
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
    const courses = [0, 1, 2].map((rank) =>
      makeMockCourse(request, request.purpose, rank),
    );
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
    const straight = new RegExp(
      `^straight-(pace|power|night|green)-(${MOCK_PLACE_ID})-(${MOCK_PLACE_ID})-(day|night)-([0-2])$`,
    ).exec(id);
    if (straight) {
      const request = recommendationRequestSchema.parse({
        schema_version: "1.0",
        start: parsePlaceId(straight[2]!),
        end: parsePlaceId(straight[3]!),
        purpose: straight[1]!.toUpperCase(),
        route_type: "straight",
        target_distance_m: null,
        time_of_day: straight[4],
        distance_tolerance_ratio: 0.1,
      });
      return makeMockCourse(request, request.purpose, Number(straight[5]));
    }
    // URL 직접 진입/새로고침에서도 동일한 데모 코스를 복원합니다.
    // 검색한 장소는 좌표로 복원하며 이름은 '선택한 출발지'로 표시됩니다.
    const match = new RegExp(
      `^(pace|power|night|green)-(${MOCK_PLACE_ID})-(\\d{4,5})-(day|night)-([0-2])$`,
    ).exec(id);
    if (!match)
      throw new Error("코스를 찾을 수 없습니다. 홈에서 다시 추천받아 주세요.");
    const request = recommendationRequestSchema.parse({
      schema_version: "1.0",
      start: parsePlaceId(match[2]!),
      target_distance_m: Number(match[3]),
      purpose: match[1]!.toUpperCase() as Purpose,
      time_of_day: match[4] as "day" | "night",
      route_type: "loop",
      distance_tolerance_ratio: 0.1,
    });
    return makeMockCourse(
      request,
      match[1]!.toUpperCase() as Purpose,
      Number(match[5]),
    );
  }
  async searchPlaces(query: string) {
    return searchDemoPlaces(query);
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
      if (!response.ok) {
        // 서버가 사용자용 문장(detail)을 주면 그대로 보여준다(예: 베타 범위 안내).
        const detail = await response
          .json()
          .then((body: { detail?: unknown }) =>
            typeof body?.detail === "string" ? body.detail : null,
          )
          .catch(() => null);
        throw new Error(
          response.status === 422
            ? (detail ??
                "이 조건으로 코스를 찾지 못했어요. 거리나 출발지를 바꿔 주세요.")
            : response.status === 501 && detail
              ? detail
              : "코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abort);
    }
  }
  async recommend(request: RecommendationRequest, signal?: AbortSignal) {
    const valid = recommendationRequestSchema.parse(request);
    return parseRecommendations(
      await this.request("/v1/courses/recommendations", {
        method: "POST",
        body: JSON.stringify(valid),
        signal,
      }),
      valid,
    );
  }
  async getCourse(id: string, signal?: AbortSignal) {
    return courseSchema.parse(
      await this.request(`/v1/courses/${encodeURIComponent(id)}`, { signal }),
    );
  }
  async searchPlaces(query: string, signal?: AbortSignal) {
    return placeSearchResponseSchema.parse(
      await this.request(
        `/v1/places/search?query=${encodeURIComponent(query)}`,
        { signal },
      ),
    );
  }
}
// 서버가 구현한 목적만 HTTP로 보내고 나머지는 더미로 시연한다. 장애 시
// 전환이 아니라 목적별 고정 경로이며, 코스의 is_mock으로 화면에 구분한다.
export class RoutedCourseRepository implements CourseRepository {
  constructor(
    private readonly server: CourseRepository,
    private readonly demo: CourseRepository,
    private readonly serverPurposes: ReadonlySet<Purpose>,
  ) {}
  recommend(request: RecommendationRequest, signal?: AbortSignal) {
    return (
      this.serverPurposes.has(request.purpose) ? this.server : this.demo
    ).recommend(request, signal);
  }
  getCourse(id: string, signal?: AbortSignal) {
    return (isMockCourseId(id) ? this.demo : this.server).getCourse(id, signal);
  }
  // 장소 검색은 목적과 무관하게 서버(카카오·용산구 자료)를 쓴다.
  searchPlaces(query: string, signal?: AbortSignal) {
    return this.server.searchPlaces(query, signal);
  }
}
export const isMockCourseId = (id: string) =>
  new RegExp(`^(straight-)?(pace|power|night|green)-(${MOCK_PLACE_ID})-`).test(
    id,
  );
const source = process.env.EXPO_PUBLIC_DATA_SOURCE ?? "mock";
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (source !== "mock" && source !== "http" && source !== "hybrid")
  throw new Error(
    "EXPO_PUBLIC_DATA_SOURCE는 mock, http, hybrid 중 하나여야 합니다.",
  );
if (source !== "mock" && !apiUrl)
  throw new Error(`${source} 모드에는 EXPO_PUBLIC_API_URL이 필요합니다.`);
export const serverPurposes = new Set(
  (process.env.EXPO_PUBLIC_SERVER_PURPOSES ?? "PACE")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is Purpose =>
      ["PACE", "POWER", "NIGHT", "GREEN"].includes(p),
    ),
);
export const courseRepository: CourseRepository =
  source === "http"
    ? new HttpCourseRepository(apiUrl!)
    : source === "hybrid"
      ? new RoutedCourseRepository(
          new HttpCourseRepository(apiUrl!),
          new MockCourseRepository(),
          serverPurposes,
        )
      : new MockCourseRepository();
export const dataSource = source;
export const isDemo = source === "mock";
