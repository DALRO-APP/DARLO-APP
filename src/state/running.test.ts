import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRunning } from "./running";
import { makeMockCourse } from "../data/mock";
import { STARTS } from "../domain/catalog";
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
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
beforeEach(() =>
  useRunning.setState({ session: null, records: [], draft: null }),
);
describe("러닝 결과 저장 흐름", () => {
  it("일시정지 중 시간은 늘지 않고 잘못된 tick을 무시한다", () => {
    const state = useRunning.getState();
    state.begin(course);
    state.tick(-10);
    state.tick(NaN);
    expect(useRunning.getState().session!.elapsed).toBe(0);
    state.tick(60);
    state.togglePause();
    state.tick(60);
    expect(useRunning.getState().session!.elapsed).toBe(60);
    expect(state.finish()).toBeTruthy();
    expect(useRunning.getState().draft!.distance_m).toBe(
      Math.round(
        (course.summary.distance_m * 60) / course.summary.estimated_duration_s,
      ),
    );
  });
  it("종료 결과는 임시 보관하고 명시적으로 저장해야 기록에 추가된다", () => {
    const state = useRunning.getState();
    state.begin(course);
    expect(state.finish()).toBeNull();
    state.tick(course.summary.estimated_duration_s + 100);
    expect(useRunning.getState().session!.running).toBe(false);
    state.togglePause();
    expect(useRunning.getState().session!.running).toBe(false);
    const id = state.finish()!;
    expect(useRunning.getState().records).toHaveLength(0);
    expect(useRunning.getState().draft!.distance_m).toBe(
      course.summary.distance_m,
    );
    expect(state.finish()).toBe(id);
    state.begin(course);
    expect(useRunning.getState().session).toBeNull();
    expect(state.save("missing")).toBe(false);
    expect(state.save(id)).toBe(true);
    expect(state.save(id)).toBe(true);
    expect(useRunning.getState().records).toHaveLength(1);
    expect(useRunning.getState().draft).toBeNull();
  });
  it("결과를 버리면 기록을 추가하지 않고 새 러닝을 시작할 수 있다", () => {
    const state = useRunning.getState();
    state.begin(course);
    state.tick(60);
    const id = state.finish()!;
    state.discard("missing");
    expect(useRunning.getState().draft).not.toBeNull();
    state.discard(id);
    expect(useRunning.getState().draft).toBeNull();
    expect(useRunning.getState().records).toHaveLength(0);
    state.begin(course);
    expect(useRunning.getState().session).not.toBeNull();
  });
});
