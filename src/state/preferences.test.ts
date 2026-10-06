import { beforeEach, describe, expect, it, vi } from "vitest";
import { STARTS } from "../domain/catalog";
import { usePreferences } from "./preferences";
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
beforeEach(() =>
  usePreferences.setState({
    request: {
      schema_version: "1.0",
      route_type: "loop",
      start: STARTS[0]!.coordinate,
      target_distance_m: 7000,
      purpose: "PACE",
      time_of_day: "day",
      distance_tolerance_ratio: 0.1,
    },
    favorites: ["existing"],
  }),
);
describe("Loop / Straight 조건 전환", () => {
  it("방식 전환 시 사용하지 않는 목적지를 제거하고 즐겨찾기를 보존한다", () => {
    const update = usePreferences.getState().update;
    update({
      route_type: "straight",
      target_distance_m: null,
      end: STARTS[1]!.coordinate,
    });
    expect(usePreferences.getState().request).toMatchObject({
      route_type: "straight",
      target_distance_m: null,
      end: STARTS[1]!.coordinate,
    });
    update({ route_type: "loop", target_distance_m: 5000 });
    expect(usePreferences.getState().request).not.toHaveProperty("end");
    expect(usePreferences.getState().favorites).toEqual(["existing"]);
  });
  it("두 장소를 동시에 바꿀 수 있고 같은 장소로 바꾸면 이전 상태를 보존한다", () => {
    const update = usePreferences.getState().update;
    update({
      route_type: "straight",
      target_distance_m: null,
      end: STARTS[1]!.coordinate,
    });
    update({ start: STARTS[1]!.coordinate, end: STARTS[0]!.coordinate });
    const valid = usePreferences.getState().request;
    expect(() => update({ end: STARTS[1]!.coordinate })).toThrow();
    expect(usePreferences.getState().request).toEqual(valid);
  });
});
