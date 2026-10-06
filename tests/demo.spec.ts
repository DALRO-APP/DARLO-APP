import { test, expect } from "./kakao-fixture";

test("목적 → 조건 → 추천 → 준비 → 모의 러닝 → 결과 저장 → 다시 달리기", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "PACE 목적 선택", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("kakao-map")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-home.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "NIGHT 목적 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Straight 선택", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await expect(page.getByText("NIGHT · Loop", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "야간", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "3km", exact: true }).click();
  await page.getByRole("button", { name: "출발지 선택", exact: true }).click();
  await page.getByRole("button", { name: "용산가족공원", exact: true }).click();
  await expect(
    page.getByText("어디서 출발할까요?", { exact: true }),
  ).not.toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-settings.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(page.getByText("빛을 따라 달로", { exact: true })).toBeVisible();
  await expect(
    page.getByText("오늘의 NIGHT 코스", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "추천 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "추천 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("course-carousel").evaluate((element) => {
    element.scrollLeft = element.clientWidth * 2;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(
    page.getByRole("button", { name: "추천 3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "추천 1", exact: true }).click();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-recommendations.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await expect(page.getByText("러닝 준비", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "코스 저장", exact: true }).click();
  await page.getByRole("button", { name: "러닝 시작", exact: true }).click();
  await page.getByRole("button", { name: "시연 도구", exact: true }).click();
  await page
    .getByRole("button", { name: "시연 1분 이동", exact: true })
    .click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "시연 1분 이동", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-run.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "계속하기", exact: true }).click();
  await page.getByRole("button", { name: "완주 시연", exact: true }).click();
  await expect(page.getByText("완주했어요", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "러닝 종료", exact: true }).click();
  await expect(page.getByText("3.00 km", { exact: true })).toBeVisible();
  await expect(
    page.getByText("NIGHT 환경 점수 94점", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-result.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("3.00 km", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(page.getByText("1회", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("1회", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await page
    .getByRole("button", { name: "저장한 코스 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "빛을 따라 달로 상세 보기", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "빛을 따라 달로 상세 보기", exact: true })
    .click();
  await page.getByRole("button", { name: "러닝 시작", exact: true }).click();
  await expect(page.getByText("모의 러닝 중", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("중도 종료 결과를 버리면 기록을 만들지 않고 새 러닝을 시작한다", async ({
  page,
}) => {
  await page.goto("/course/power-namsan-7000-day-0");
  await page.getByRole("button", { name: "러닝 시작", exact: true }).click();
  await page.getByRole("button", { name: "시연 도구", exact: true }).click();
  await page
    .getByRole("button", { name: "시연 1분 이동", exact: true })
    .click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByRole("button", { name: "러닝 종료", exact: true }).click();
  await expect(page.getByText(/일부 구간만 모의로 달렸어요/)).toBeVisible();
  await page
    .getByRole("button", { name: "저장하지 않고 홈으로", exact: true })
    .click();
  await page.getByRole("tab", { name: "기록", exact: true }).click();
  await expect(
    page.getByText("첫 번째 달리기를 기다리고 있어요.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "런닝", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PACE 목적 선택", exact: true }),
  ).toBeVisible();
});

test("기록 / 런닝 / 마이 3탭과 홈의 조건·기록·저장 코스 바로가기", async ({
  page,
}) => {
  await page.goto("/");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute("aria-label", "기록");
  await expect(tabs.nth(1)).toHaveAttribute("aria-label", "런닝");
  await expect(tabs.nth(2)).toHaveAttribute("aria-label", "마이");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("첫 발걸음부터 함께해요", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "오늘의 러닝 조건 변경", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.getByRole("button", { name: "7km", exact: true }).click();
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(
    page.getByText("7km · 주간 · 출발지로 돌아오기", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "러닝 기록 보기", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "기록", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await page.getByRole("tab", { name: "런닝", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "PACE 목적 선택", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "저장한 코스 0개 보기", exact: true })
    .click();
  await expect(
    page.getByText("마음에 드는 길을 모아보세요", { exact: true }),
  ).toBeVisible();
});

test("거리 직접 입력 검증과 코스 새로고침 복원", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "GREEN 목적 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Straight 선택", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await page.getByRole("button", { name: "직접 입력", exact: true }).click();
  const input = page.getByRole("textbox", {
    name: "직접 입력 거리 (km)",
    exact: true,
  });
  await input.fill("0");
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(
    page.getByText("1~20km 사이의 숫자를 입력해 주세요.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/explore/);
  await input.fill("7.5");
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(page.getByText("초록 쉼표 코스", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "추천 3", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "추천 3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await expect(page).toHaveURL(/green-ichon-7500-day-2/);
  await page.reload();
  await expect(
    page.getByText("초록 쉼표 코스 · 짧은 루프", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("7.2km", { exact: true })).toBeVisible();
});

test("빈 기록, 없는 코스와 결과 URL, 러닝 직접 진입을 안내한다", async ({
  page,
}) => {
  await page.goto("/records");
  await expect(
    page.getByText("첫 번째 달리기를 기다리고 있어요.", { exact: true }),
  ).toBeVisible();
  await page.goto("/course/missing");
  await expect(
    page.getByText("코스를 찾을 수 없어요", { exact: true }),
  ).toBeVisible();
  await page.goto("/result?id=missing");
  await expect(
    page.getByText("러닝 결과를 찾을 수 없어요", { exact: true }),
  ).toBeVisible();
  await page.goto("/run");
  await expect(
    page.getByText("아직 시작한 러닝이 없어요.", { exact: true }),
  ).toBeVisible();
});

test("Straight 방식 → 출발·목적지 선택과 교환 → 추천 → 완주 결과 저장", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await expect(page).toHaveURL(/\/route-type/);
  await expect(
    page.getByRole("button", { name: "Loop 선택", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-route-type.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Straight 선택", exact: true })
    .click();
  await expect(
    page.getByText("PACE · Straight", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "5km", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "목적지 선택", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이촌 한강공원", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "용산가족공원", exact: true }).click();
  await page
    .getByRole("button", { name: "출발지와 목적지 바꾸기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "출발지 선택", exact: true }),
  ).toContainText("용산가족공원");
  await expect(
    page.getByRole("button", { name: "목적지 선택", exact: true }),
  ).toContainText("이촌 한강공원");
  await page.getByRole("button", { name: "출발지 선택", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이촌 한강공원", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "남산 둘레길", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "출발지 선택", exact: true }),
  ).toContainText("남산 둘레길");
  await expect(
    page.getByRole("button", { name: "목적지 선택", exact: true }),
  ).toContainText("이촌 한강공원");
  await page.screenshot({
    path: `test-results/${test.info().project.name}-straight-settings.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  await expect(
    page.getByText("한강 리듬 코스 · 연결 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "추천 2", exact: true }).click();
  const map = page.getByTestId("kakao-map");
  if (await map.count()) {
    await expect(map).toHaveAttribute("data-map-status", "ready");
    const endpoints = await page.evaluate(() => {
      const state = (window as any).__kakaoTest;
      const active = state.paths.findLast(
        (p: any) => p.map && p.options.strokeWeight === 6,
      ).options.path;
      const destination = state.overlays.findLast(
        (o: any) => o.map && o.options.content.textContent === "● 도착",
      ).options.position;
      return { start: active[0], end: active.at(-1), destination };
    });
    expect(endpoints.start).toEqual({ lat: 37.546, lon: 126.995 });
    expect(endpoints.end).toEqual({ lat: 37.5178, lon: 126.9745 });
    expect(endpoints.destination).toEqual(endpoints.end);
  }
  await page.screenshot({
    path: `test-results/${test.info().project.name}-straight-recommendations.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await expect(page).toHaveURL(/straight-pace-namsan-ichon-day-1/);
  await page.reload();
  await expect(
    page.getByText("한강 리듬 코스 · 연결 2", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("남산 둘레길 → 이촌 한강공원", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "러닝 시작", exact: true }).click();
  await page.getByRole("button", { name: "시연 도구", exact: true }).click();
  await page.getByRole("button", { name: "완주 시연", exact: true }).click();
  await page.getByRole("button", { name: "러닝 종료", exact: true }).click();
  await expect(
    page.getByText("PACE 환경 점수 88점", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("남산 둘레길 → 이촌 한강공원", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(page.getByText("1회", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "한강 리듬 코스 · 연결 2 러닝 결과 보기",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByText("남산 둘레길 → 이촌 한강공원", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "같은 코스 다시 달리기", exact: true })
    .click();
  await expect(page).toHaveURL(/straight-pace-namsan-ichon-day-1/);
  expect(errors).toEqual([]);
});
