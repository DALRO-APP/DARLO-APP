import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const platform = process.argv[2] ?? "ios";
if (!["ios", "android"].includes(platform))
  throw new Error("사용법: node scripts/native-preflight.mjs ios|android");
const config = JSON.parse(readFileSync("app.json", "utf8")).expo;
const local = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
  : "";
const key =
  process.env.EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY ??
  local.match(/^EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY=(.*)$/m)?.[1]?.trim();
let ready = true;
function check(ok, text) {
  console.log(`${ok ? "PASS" : "NEEDS SETUP"} · ${text}`);
  if (!ok) ready = false;
}
check(
  !!key && /^[a-f\d]{32}$/i.test(key),
  "Native 지도 키 설정 확인 (값은 출력하지 않음)",
);
console.log(
  `카카오 등록 식별자: ${platform === "ios" ? config.ios.bundleIdentifier : config.android.package}`,
);
if (platform === "ios") {
  const sdk = spawnSync("xcrun", ["--sdk", "iphoneos", "--show-sdk-path"], {
    encoding: "utf8",
  });
  check(sdk.status === 0 && !!sdk.stdout.trim(), "Xcode 및 iPhoneOS SDK");
  check(
    spawnSync("pod", ["--version"], { encoding: "utf8" }).status === 0,
    "CocoaPods",
  );
  console.log(
    "카카오 iOS 번들 ID 등록 및 Apple 서명/실기 연결 여부는 빌드·실행 단계에서 확인합니다.",
  );
} else {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  check(!!sdk && existsSync(sdk), "Android SDK 경로");
  check(
    spawnSync("java", ["-version"], { encoding: "utf8" }).status === 0,
    "Java",
  );
  const keystore = resolve("android/app/debug.keystore");
  if (existsSync(keystore)) {
    const certificate = spawnSync("keytool", [
      "-exportcert",
      "-alias",
      "androiddebugkey",
      "-keystore",
      keystore,
      "-storepass",
      "android",
      "-keypass",
      "android",
    ]);
    if (certificate.status === 0)
      console.log(
        `로컬 debug 인증서 키 해시: ${createHash("sha1").update(certificate.stdout).digest("base64")}`,
      );
    else check(false, "debug 인증서 키 해시 생성");
  } else
    console.log(
      "debug 키 해시는 npx expo prebuild --platform android --no-install 후 확인할 수 있습니다.",
    );
  console.log(
    "EAS/배포 인증서는 로컬 debug 인증서와 다를 수 있으므로 실제 빌드 서명의 키 해시를 등록합니다.",
  );
}
console.log(
  "이 검사는 native 컴파일·카카오 인증 성공·지도 렌더링을 증명하지 않습니다.",
);
process.exitCode = ready ? 0 : 1;
