import { test, expect } from "@playwright/test";

test("PACE만 선택 가능하고 Straight 예상 거리가 첫 추천과 일치한다", async ({
  page,
}) => {
  await page.goto("/");
  for (const purpose of ["POWER", "NIGHT", "GREEN"]) {
    await expect(
      page.getByRole("button", { name: `${purpose} 목적 선택`, exact: true }),
    ).toBeDisabled();
  }
  await expect(page.getByText("베타 준비 중", { exact: true })).toHaveCount(3);
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Straight 선택", exact: true })
    .click();
  const preview = page.getByTestId("straight-distance-preview");
  const value = preview.getByText(/^약 \d+\.\d km$/);
  await expect(value).toBeVisible();
  const previous = await value.textContent();
  await page.getByRole("button", { name: "목적지 선택", exact: true }).click();
  await page.getByRole("button", { name: "용산가족공원", exact: true }).click();
  await expect(
    preview.getByText("거리 계산 중이에요", { exact: true }),
  ).toBeVisible();
  await expect(value).toBeVisible();
  await expect(value).not.toHaveText(previous!);
  const expected = (await value.textContent())!
    .replace("약 ", "")
    .replace(" km", "km");
  await page.screenshot({
    path: `test-results/${test.info().project.name}-straight-preview.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(
    page.getByText(`추천 1 · ${expected}`, { exact: true }),
  ).toBeVisible();
});
