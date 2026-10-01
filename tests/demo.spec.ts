import { test, expect } from "@playwright/test";
test("조건 선택 → 코스 저장 → 모의 러닝 → 기록/후기 → 재시작 시 저장 유지", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("한강 리듬 코스", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "3km", exact: true }).click();
  await page.getByRole("button", { name: "야간 러닝", exact: true }).click();
  await expect(page.getByText("빛을 따라 달로", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "출발지 선택", exact: true }).click();
  await page.getByRole("button", { name: "용산가족공원", exact: true }).click();
  await expect(
    page.getByText("용산가족공원", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "빛을 따라 달로 저장", exact: true })
    .click();
  await page
    .getByRole("button", { name: "빛을 따라 달로 상세 보기", exact: true })
    .click();
  await expect(page.getByText("3.0km", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "시연 1분 이동", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "계속 달리기", exact: true }).click();
  await page.getByRole("button", { name: "완주 시연", exact: true }).click();
  await expect(page.getByText("잘 달렸어요!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "러닝 마치기", exact: true }).click();
  await expect(page.getByText("3.00 km", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "평점 4점", exact: true }).click();
  await page
    .getByRole("button", { name: "풍경이 멋져요", exact: true })
    .click();
  await expect(
    page.getByText("후기는 이 기기에 저장되었어요.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "평점 4점", exact: true }),
  ).toBeChecked();
  await page.getByRole("tab", { name: "탐색", exact: true }).click();
  await expect(page).toHaveURL(/\/explore/);
  await page
    .getByRole("button", { name: "저장한 코스 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "빛을 따라 달로 상세 보기", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-saved.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("빈 기록과 없는 코스 URL을 안내한다", async ({ page }) => {
  await page.goto("/records");
  await expect(
    page.getByText("첫 번째 달리기를 기다리고 있어요.", { exact: true }),
  ).toBeVisible();
  await page.goto("/course/missing");
  await expect(
    page.getByText("코스를 찾을 수 없어요", { exact: true }),
  ).toBeVisible();
});
