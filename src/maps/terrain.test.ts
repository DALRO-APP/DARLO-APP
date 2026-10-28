import { describe, expect, it } from "vitest";
import {
  fitTerrain,
  terrain,
  terrainPoint,
  transformTerrain,
  zoomTerrain,
} from "./terrain";
import type { Position } from "../domain/contracts";

describe("공간정보 지도 좌표와 카메라", () => {
  it("앱 경위도를 pyproj 기준 Mercator 위치에 맞춘다", () => {
    // pyproj Transformer(4326 → 3857, always_xy=True)의 이촌 좌표.
    const [x, y] = terrainPoint([126.9745, 37.5178]);
    expect(x + terrain.origin[0]!).toBeCloseTo(14134736.683730515, 3);
    expect(terrain.origin[1]! - y).toBeCloseTo(4511529.300481455, 3);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(terrain.height);
  });
  it("좁은 모바일·넓은 데스크톱에서 모든 코스를 화면 안에 맞춘다", () => {
    const points: Position[] = [
      [126.9745, 37.5178],
      [126.9992, 37.547],
    ];
    for (const aspect of [0.85, 3.2]) {
      const frame = fitTerrain(points, aspect);
      expect(frame.width / frame.height).toBeCloseTo(aspect);
      for (const [x, y] of points.map(terrainPoint)) {
        expect(x).toBeGreaterThan(frame.x);
        expect(x).toBeLessThan(frame.x + frame.width);
        expect(y).toBeGreaterThan(frame.y);
        expect(y).toBeLessThan(frame.y + frame.height);
      }
    }
  });
  it("빈 코스·한 점도 유효한 화면을 만들고 확대 한계를 지킨다", () => {
    for (const points of [[], [[126.9745, 37.5178]] as Position[]]) {
      const frame = fitTerrain(points, 1);
      expect(Object.values(frame).every(Number.isFinite)).toBe(true);
      const zoomed = zoomTerrain(frame, 0.00001);
      expect(zoomed.width).toBe(450);
      expect(zoomed.x + zoomed.width / 2).toBeCloseTo(
        frame.x + frame.width / 2,
      );
      expect(zoomTerrain(frame, 100).width).toBe(24000);
    }
  });
  it("핀치 확대는 손가락 중심의 지도 좌표를 고정하고 함께 이동한다", () => {
    const frame = fitTerrain([[126.9745, 37.5178]], 0.8);
    const at = (camera: typeof frame, [u, v]: Position) => [
      camera.x + u * camera.width,
      camera.y + v * camera.height,
    ];
    const zoomed = transformTerrain(frame, 0.5, [0.3, 0.7]);
    expect(zoomed.width).toBeCloseTo(frame.width / 2);
    expect(at(zoomed, [0.3, 0.7])[0]).toBeCloseTo(at(frame, [0.3, 0.7])[0]!);
    expect(at(zoomed, [0.3, 0.7])[1]).toBeCloseTo(at(frame, [0.3, 0.7])[1]!);
    const moved = transformTerrain(frame, 1, [0.3, 0.7], [0.5, 0.5]);
    expect(at(moved, [0.5, 0.5])[0]).toBeCloseTo(at(frame, [0.3, 0.7])[0]!);
    expect(at(moved, [0.5, 0.5])[1]).toBeCloseTo(at(frame, [0.3, 0.7])[1]!);
  });
  it("번들 자료에 도로망 버전·원본 해시·DEM 좌표계와 실제 벡터가 있다", () => {
    expect(terrain.network_version).toMatch(/^yongsan-verified-[a-f0-9]{8}$/);
    expect(terrain.dem_crs_wkt).toContain("Bessel");
    expect(terrain.road_count).toBe(4426);
    expect(terrain.roads).toHaveLength(4);
    // 현재 검증 도로망은 경사가 모두 측정돼 미측정 그룹에 선이 없다.
    expect(terrain.roads[3]).toBe("");
    expect(
      Object.values(terrain.source_sha256).every((hash) =>
        /^[a-f0-9]{64}$/.test(hash),
      ),
    ).toBe(true);
    for (const path of [
      ...terrain.roads.slice(0, 3),
      terrain.boundary,
      terrain.contours,
      terrain.parks,
    ]) {
      expect(path).toMatch(/^M/);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
  });
});
