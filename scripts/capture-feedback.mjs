// HTTP 모드 웹 export와 고정 seed의 임시 FastAPI 서버로 실제 앱 화면을 캡처한다.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const output = resolve(
  process.argv[2] ?? "artifacts/DALRO-feedback-2026-11-17",
);
const root = resolve(output, "web");
const shots = resolve(output, "source/shots");
await mkdir(shots, { recursive: true });
const api = spawn(
  "server/.venv/bin/python",
  [
    "-c",
    "import uvicorn; from dalro_api.main import create_app; from dalro_api.demo_seed import SEED_PATH; uvicorn.run(create_app(seed_path=SEED_PATH), host='127.0.0.1', port=18787, log_level='warning')",
  ],
  {
    env: { ...process.env, PYTHONPATH: resolve("server") },
    stdio: ["ignore", "ignore", "pipe"],
  },
);
api.stderr.on("data", (data) => process.stderr.write(data));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ttf": "font/ttf",
};
const server = createServer(async (req, res) => {
  let path = resolve(root, `.${new URL(req.url, "http://localhost").pathname}`);
  if (!path.startsWith(`${root}${sep}`) && path !== root) {
    res.writeHead(403).end();
    return;
  }
  if (!extname(path)) path = resolve(root, "index.html");
  try {
    const body = await readFile(path);
    res.setHeader(
      "Content-Type",
      types[extname(path)] ?? "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
let browser;
try {
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(4174, "127.0.0.1", done);
  });
  await expect
    .poll(
      async () => {
        try {
          return (
            await (
              await fetch("http://127.0.0.1:18787/health", {
                signal: AbortSignal.timeout(1500),
              })
            ).json()
          ).status;
        } catch {
          return null;
        }
      },
      { timeout: 30000 },
    )
    .toBe("ok");
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 390, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shot = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: resolve(shots, `${name}.png`),
      fullPage: true,
    });
  };
  await page.goto("http://127.0.0.1:4174");
  await expect(
    page.getByRole("button", { name: "PACE 목적 선택", exact: true }),
  ).toBeVisible();
  await shot("01-home");
  await page
    .getByRole("button", { name: "PACE 목적 선택", exact: true })
    .click();
  await page.getByRole("button", { name: "Loop 선택", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "코스 추천받기", exact: true }),
  ).toBeVisible();
  await shot("02-condition");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/courses/recommendations") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "코스 추천받기", exact: true })
    .click();
  const body = await (await response).json();
  expect(body.courses.length).toBeGreaterThan(0);
  expect(
    body.courses.every(
      (c) => !c.is_mock && typeof c.summary.environment_penalty === "number",
    ),
  ).toBe(true);
  await expect(
    page
      .getByText("환경 패널티", { exact: false })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await shot("03-recommend-1");
  await page
    .getByRole("button", { name: "이 코스로 달리기", exact: true })
    .click();
  await expect(page.getByText("러닝 준비", { exact: true })).toBeVisible();
  await shot("06-ready");
  await page.getByRole("button", { name: "러닝 시작", exact: true }).click();
  await page.getByRole("button", { name: "시연 도구", exact: true }).click();
  await page
    .getByRole("button", { name: "시연 1분 이동", exact: true })
    .click();
  await shot("07-running");
  await page.getByRole("button", { name: "완주 시연", exact: true }).click();
  await page.getByRole("button", { name: "러닝 종료", exact: true }).click();
  await expect(page.getByTestId("course-report")).toContainText("환경 패널티");
  await shot("08-result");
  expect(errors).toEqual([]);
  console.log(
    `실제 HTTP 추천 ${body.courses.length}개 · 앱 캡처 6개 · 브라우저 오류 0`,
  );
} finally {
  await browser?.close();
  server.close();
  api.kill("SIGTERM");
}
