import AsyncStorage from "@react-native-async-storage/async-storage";
import { courseSchema, type Course } from "../domain/contracts";

type Storage = Pick<typeof AsyncStorage, "getItem" | "setItem">;
const limit = 24;

// Vercel 인스턴스가 바뀌어도 이미 추천받은 코스의 상세·새로고침을 이어간다.
// Zustand 입력 상태와 분리한 repository 캐시이며, 새 코스를 만들어 대체하지 않는다.
export class CourseCache {
  private pending: Promise<void> = Promise.resolve();
  private readonly key: string;
  constructor(
    namespace: string,
    private readonly storage: Storage = AsyncStorage,
  ) {
    this.key = `dalro-server-courses-v1:${namespace}`;
  }
  private async read(): Promise<Course[]> {
    try {
      const raw: unknown = JSON.parse(
        (await this.storage.getItem(this.key)) ?? "[]",
      );
      if (!Array.isArray(raw)) return [];
      return raw
        .flatMap((value) => {
          const course = courseSchema.safeParse(value);
          return course.success ? [course.data] : [];
        })
        .slice(-limit);
    } catch {
      return [];
    }
  }
  async get(id: string) {
    await this.pending;
    return (await this.read()).find((course) => course.id === id);
  }
  async remember(courses: Course[]) {
    this.pending = this.pending.then(async () => {
      try {
        const known = new Map(
          (await this.read()).map((course) => [course.id, course]),
        );
        for (const course of courses) {
          known.delete(course.id);
          known.set(course.id, course);
        }
        await this.storage.setItem(
          this.key,
          JSON.stringify([...known.values()].slice(-limit)),
        );
      } catch {
        // 브라우저 저장소가 막혀 있어도 정상 추천 응답을 버리지 않는다.
      }
    });
    await this.pending;
  }
}
