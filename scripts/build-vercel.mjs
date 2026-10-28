import { spawnSync } from "node:child_process";

// 브라우저는 동일 배포의 /api를 사용한다. 서버 비밀값을 앱 번들에 넣지 않는다.
const result = spawnSync(
  "npx",
  ["expo", "export", "--platform", "web", "--clear"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_DATA_SOURCE: "hybrid",
      EXPO_PUBLIC_API_URL: "/api",
      EXPO_PUBLIC_SERVER_PURPOSES: "PACE",
      EXPO_PUBLIC_MAP_STYLE: "terrain",
    },
  },
);
process.exit(result.status ?? 1);
