import { test, expect } from "@playwright/test";

test("공간정보 지도에서 레이어·확대·코스 선택·상세 진입", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (/Unknown event handler property.*onResponder/.test(message.text()))
      errors.push(message.text());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  const map = page.getByTestId("terrain-map");
  await expect(map).toBeVisible();
  await expect(page.getByTestId("kakao-map")).toHaveCount(0);
  const svg = map.getByLabel("용산구 공간정보 코스 지도");
  await expect(svg.locator("image")).toHaveCount(1);
  const routes = svg.locator('[data-testid^="route-line-"]');
  const firstRoute = await routes.last().getAttribute("data-testid");
  await routes.first().dispatchEvent("click");
  await expect(
    page.getByRole("button", { name: "추천 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await svg.getByTestId(firstRoute!).dispatchEvent("click");
  await expect(
    page.getByRole("button", { name: "추천 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const before = await svg.getAttribute("viewBox");
  await map.getByRole("button", { name: "지도 확대", exact: true }).click();
  await expect(svg).not.toHaveAttribute("viewBox", before!);
  await map
    .getByRole("button", { name: "지도 전체 보기", exact: true })
    .click();
  await expect(svg).toHaveAttribute("viewBox", before!);
  const box = await svg.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    box!.x + box!.width * 0.55,
    box!.y + box!.height * 0.55,
  );
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width * 0.7,
    box!.y + box!.height * 0.65,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(svg).not.toHaveAttribute("viewBox", before!);
  await map
    .getByRole("button", { name: "지도 전체 보기", exact: true })
    .click();
  await expect(svg).toHaveAttribute("viewBox", before!);
  await map.getByRole("button", { name: "지형 레이어", exact: true }).click();
  await expect(svg.locator("image")).toHaveCount(0);
  await map.getByRole("button", { name: "지형 레이어", exact: true }).click();
  await expect(svg.locator("image")).toHaveCount(1);
  await map.getByRole("button", { name: "경사 레이어", exact: true }).click();
  await expect(map.getByText("평균 지형 경사", { exact: false })).toHaveCount(
    0,
  );
  await map.getByRole("button", { name: "경사 레이어", exact: true }).click();
  await page.getByRole("button", { name: "추천 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "추천 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: `test-results/${test.info().project.name}-terrain-map.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await expect(page.getByText("러닝 준비", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("terrain-map").filter({ visible: true }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
