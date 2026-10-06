import { test, expect } from "@playwright/test";
import { mockKakaoSdk } from "./kakao-fixture";

test("카카오 공급자가 위경도·코스 선택·조건 변경·모의 주행을 반영한다", async ({
  page,
}) => {
  const requestCount = await mockKakaoSdk(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Straight 선택", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(page.getByText("한강 리듬 코스", { exact: true })).toBeVisible();
  test.skip(
    (await page.locator('[data-testid="kakao-map"]:visible').count()) === 0,
    "웹 export에 카카오 키가 없으면 도식 지도만 사용",
  );
  await expect(
    page.locator('[data-testid="kakao-map"]:visible'),
  ).toHaveAttribute("data-map-status", "ready");
  const initial = await page.evaluate(() => {
    const state = (window as any).__kakaoTest;
    return {
      center: state.maps[0].center,
      paths: state.paths
        .filter((path: any) => path.map)
        .map((path: any) => path.options.path),
      bounds: state.bounds.at(-1),
    };
  });
  expect(initial.center).toEqual({ lat: 37.5178, lon: 126.9745 });
  expect(initial.paths).toHaveLength(3);
  expect(
    initial.paths
      .flat()
      .every(
        (point: any) =>
          point.lat > 37 &&
          point.lat < 38 &&
          point.lon > 126 &&
          point.lon < 128,
      ),
  ).toBe(true);
  expect(initial.bounds.length).toBeGreaterThan(3);
  const nextPath = await page.evaluate(() => {
    const paths = (window as any).__kakaoTest.paths;
    const next = paths.find(
      (path: any) => path.map && path.options.strokeWeight === 4,
    );
    next.listeners.click();
    return next.options.path;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__kakaoTest.paths.findLast(
            (p: any) => p.map && p.options.strokeWeight === 6,
          )?.options.path,
      ),
    )
    .toEqual(nextPath);
  await page.getByRole("button", { name: "조건 변경", exact: true }).click();
  await page.getByRole("button", { name: "3km", exact: true }).click();
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(page.getByText("추천 1 · 3.0km", { exact: true })).toBeVisible();
  const coordinates = await page.evaluate(() =>
    (window as any).__kakaoTest.paths
      .filter((p: any) => p.map)
      .map((p: any) => p.options.path),
  );
  expect(coordinates).not.toEqual(initial.paths);
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await page.getByRole("button", { name: "러닝 시작", exact: true }).click();
  await expect(
    page.locator('[data-testid="kakao-map"]:visible'),
  ).toHaveAttribute("data-map-status", "ready");
  const position = () =>
    page.evaluate(
      () =>
        (window as any).__kakaoTest.overlays.findLast(
          (o: any) => o.map && o.options.content.textContent === "달로",
        )?.options.position,
    );
  const start = await position();
  await page.getByRole("button", { name: "시연 도구", exact: true }).click();
  await page
    .getByRole("button", { name: "시연 1분 이동", exact: true })
    .click();
  await page
    .getByRole("button", { name: "시연 1분 이동", exact: true })
    .click();
  await expect.poll(position).not.toEqual(start);
  expect(requestCount()).toBe(1);
});

test("SDK 실패를 표시하고 새 요청으로 재시도한다", async ({ page }) => {
  const requestCount = await mockKakaoSdk(page, true);
  await page.goto("/");
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Straight 선택", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(page.getByText("한강 리듬 코스", { exact: true })).toBeVisible();
  test.skip(
    (await page.locator('[data-testid="kakao-map"]:visible').count()) === 0,
    "카카오 키가 없는 export",
  );
  await expect(
    page.locator('[data-testid="kakao-map"]:visible'),
  ).toHaveAttribute("data-map-status", "error");
  await page
    .getByRole("button", { name: "지도 다시 시도", exact: true })
    .click();
  await expect(
    page.locator('[data-testid="kakao-map"]:visible'),
  ).toHaveAttribute("data-map-status", "ready");
  expect(requestCount()).toBe(2);
});

test("실패한 지도에서 사용자가 도식 지도로 전환해 시연을 계속한다", async ({
  page,
}) => {
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js?*", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Straight 선택", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(page.getByText("한강 리듬 코스", { exact: true })).toBeVisible();
  test.skip(
    (await page.locator('[data-testid="kakao-map"]:visible').count()) === 0,
    "카카오 키가 없는 export",
  );
  await page
    .getByRole("button", { name: "시연 지도 보기", exact: true })
    .click();
  await expect(page.locator('[data-testid="kakao-map"]:visible')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "이 코스로 달리기", exact: true }),
  ).toBeVisible();
  const map = page.getByLabel("용산구 오프라인 시연 코스 지도");
  await expect(map).toBeVisible();
  const contained = await map.evaluate((svg) => {
    const bounds = (svg as SVGSVGElement).viewBox.baseVal;
    return Array.from(svg.querySelectorAll("polyline")).every((line) =>
      Array.from(line.points).every(
        (point) =>
          point.x >= 0 &&
          point.x <= bounds.width &&
          point.y >= 0 &&
          point.y <= bounds.height,
      ),
    );
  });
  expect(contained).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-offline-recommendations.png`,
    fullPage: true,
  });
});
