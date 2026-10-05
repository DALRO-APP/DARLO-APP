# DALRO 시연 가이드

1. `npm ci` → `npm run web` 또는 `npm run start:go`. 실제 native 카카오 지도는 [개발 앱 설치 가이드](NATIVE-MAPS.md)를 따른 뒤 `npm run start:dev`로 엽니다. Native 키가 설정된 Expo Go에서는 지도 설치 안내의 `시연 지도 보기`로 더미 시연을 계속할 수 있습니다.
2. 홈의 출발지 변경에서 이촌·남산·용산가족공원을 선택합니다.
3. 3/5/8km, PACE/POWER/NIGHT/GREEN, 주야간을 바꿉니다. 후보·지도·거리가 변경됩니다.
4. 지도/카드에서 코스를 고르고 상세의 환경/이유/구간을 설명합니다. 하트로 저장합니다.
5. `이 코스로 달리기` → 일시정지/계속 → `시연 1분 이동` → `완주 시연` → `러닝 마치기`.
6. 기록 거리·시간·페이스를 보고 하트 평점/후기 태그를 남깁니다. 새로고침 후에도 보관됩니다.
7. 탐색의 저장 목록과 마이 선호 목적을 확인하고 다시 추천받습니다.

같은 세션에서 홈으로 가도 상세의 `진행 중인 시연 이어가기`로 복귀할 수 있습니다. 앱을 완전히 다시 열면 진행 중 주행은 초기화하며 완료 기록·즐겨찾기·조건은 복원합니다.

설명: 지금은 앱 흐름과 서버 연결 구조를 시연하는 단계입니다. 경로/환경 수치는 가상이며 실제 도로 탐색·GPS·전처리 결과가 아닙니다. 기본 배경은 도식 지도이고 웹에서 JavaScript 키를 설정하면 카카오 실제 지도 위에 시연 코스를 표시합니다. 설정은 [카카오 지도 가이드](KAKAO-MAPS.md)를 참고하세요. 실제 자료와 알고리즘을 서버로 연결할 예정입니다.

```sh
npm run export:web
node scripts/serve-demo.mjs
# http://localhost:4173
```

시연 서버는 로컬용입니다. 실제 웹 호스팅은 상세 URL 직접 진입을 위해 SPA fallback이 필요합니다.

## Vercel 시연 배포

루트의 `vercel.json`은 더미 데이터로 웹 빌드하고 `dist/`를 배포합니다. 상세 URL 직접 진입과 새로고침은 SPA rewrite로 처리합니다. [Expo 공식 Vercel 배포 가이드](https://docs.expo.dev/guides/publishing-websites/#vercel)를 따릅니다.

- Vercel에서 저장소를 가져오고 Framework Preset은 `Other`, Root Directory는 저장소 루트(`./`)로 둡니다. 설치·빌드 명령과 출력 폴더는 `vercel.json`에 지정되어 있습니다.
- 현재 `package.json`의 Node.js 범위는 `>=22.14.0`이므로 Vercel에서는 기본 `24.x`를 사용할 수 있습니다. 로컬 웹 검증은 `22.14.0`에서 했습니다. `22.x`로 고정하려면 `package.json`의 engines 범위도 함께 변경해야 합니다. [Vercel Node.js 버전 규칙](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)을 참고하세요.
- 로컬에서 배포하려면 프로젝트 루트에서 `npx vercel`을 실행하고 계정·프로젝트를 연결합니다.
- 키 없이도 도식 지도로 시연할 수 있습니다. 카카오 지도를 쓰려면 Vercel 환경 변수에 `EXPO_PUBLIC_KAKAO_MAP_JS_KEY`를 설정하고 배포 도메인을 카카오에 등록한 뒤 다시 빌드합니다. 자세한 설정은 [카카오 지도 가이드](KAKAO-MAPS.md)를 참고하세요.
- 로컬 빌드: `EXPO_PUBLIC_DATA_SOURCE=mock npm run export:web`. 확인: `node scripts/serve-demo.mjs` → `http://localhost:4173`.

`dist/`는 Git에 넣지 않습니다. 저장소를 통한 배포에서는 Vercel이 다시 빌드합니다.
Git 연동 배포는 원격 저장소의 커밋을 사용하므로 로컬 커밋 후 해당 브랜치에 push해야 변경된 `vercel.json`이 반영됩니다.
