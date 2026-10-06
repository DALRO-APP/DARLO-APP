# DALRO 시연 가이드

1. `npm ci` → `npm run web` 또는 `npm run start:go`. 실제 native 카카오 지도는 [개발 앱 설치 가이드](NATIVE-MAPS.md)를 따른 뒤 `npm run start:dev`로 엽니다. Native 키가 설정된 Expo Go에서는 지도 설치 안내의 `시연 지도 보기`로 더미 시연을 계속할 수 있습니다.
2. 홈에서 PACE / POWER / NIGHT / GREEN 중 오늘의 목적을 고릅니다. NIGHT는 야간이 기본입니다.
3. 별도 러닝 방식 화면에서 `Loop` / `Straight`를 고릅니다. 다음 설정 화면에서 Loop는 출발지와 거리(3/5/7/10km·직접 입력 1~20km), Straight는 출발지와 목적지(이촌·남산·용산가족공원 중 서로 다른 두 장소)를 선택합니다. Straight 거리는 자동이며 두 장소를 교환할 수 있습니다. 주야간을 고르고 `코스 추천받기`를 누릅니다.
4. 큰 지도와 가로 카드에서 추천 1~3을 고릅니다. 선택한 목적에 맞는 더미 후보 세 개이며, 카드·추천 번호·지도 경로를 선택할 수 있습니다.
5. `이 코스로 달리기` → 러닝 준비에서 하트로 코스 저장 → `러닝 시작`.
6. `시연 도구`를 펼쳐 `시연 1분 이동`, `완주 시연`을 사용합니다. `일시정지`하면 `계속하기` / `러닝 종료`가 나타납니다. 완주하면 자동 정지합니다.
7. 종료하면 결과 리포트가 바로 나옵니다. 거리·시간·페이스·지도·목적별 코스 환경 설명을 확인하고 `기록 저장`을 누릅니다. 저장 전 결과와 저장한 기록은 새로고침 후에도 남습니다.
8. 기록을 눌러 결과를 다시 확인하거나 `같은 코스 다시 달리기`를 선택합니다. 마이의 `저장한 코스`에서도 다시 시작할 수 있습니다.

탭은 **기록 / 런닝(홈) / 마이** 3개입니다. 가운데 녹색 런닝 탭은 목적 선택 홈을 엽니다. 홈에는 현재 출발지·거리·시간대, 모의 기록 요약, 기록/저장 코스 바로가기가 있습니다. 목적을 누르면 탭 바깥의 방식 선택으로, 조건 요약은 마지막 방식의 설정으로 바로 이동합니다. 진행 중 세션이 있으면 홈/준비 화면에서 이어갈 수 있습니다. 저장 전 결과가 있으면 새 러닝 전에 저장 또는 버리기를 선택합니다.

앱을 완전히 다시 열면 진행 중 주행은 초기화하며 완료 기록·저장 전 결과·즐겨찾기·조건은 복원합니다. 현재 위치·주소 검색은 연결하지 않으며, 용산구 시연 장소 사이의 Loop와 Straight 더미 코스를 제공합니다. 자세한 변경 사항은 [화면 흐름 결정 문서](2026-10-06-러닝-화면-흐름.md)를 참고하세요.

설명: 지금은 앱 흐름과 서버 연결 구조를 시연하는 단계입니다. 경로/환경 수치는 가상이며 실제 도로 탐색·GPS·전처리 결과가 아닙니다. 기본 배경은 도식 지도이고 웹에서 JavaScript 키를 설정하면 카카오 실제 지도 위에 시연 코스를 표시합니다. 설정은 [카카오 지도 가이드](KAKAO-MAPS.md)를 참고하세요. 실제 자료와 알고리즘을 서버로 연결할 예정입니다.

```sh
npm run export:web
node scripts/serve-demo.mjs
# http://localhost:4173
```

시연 서버는 로컬용입니다. 실제 웹 호스팅은 상세 URL 직접 진입을 위해 SPA fallback이 필요합니다.

## 2026-10-06 검증

- `npm run check`: 타입·lint·단위 테스트 55개·전달 데이터·명령 가드 통과.
- 웹/iOS/Android JS export 통과. Native 마커 변경을 적용하려면 새 개발 앱이 필요합니다. Xcode/iPhoneOS SDK·Android SDK가 없어 APK/IPA 컴파일과 실제 기기 테스트는 수행하지 못했습니다.
- `npx expo install --check`: 로컬 SDK 57 `bundledNativeModules.json` 기준으로 의존성 일치. 오프라인이므로 원격 버전 조회는 하지 못했습니다.
- `PLAYWRIGHT_CHROME=1 npx playwright test`: 모바일/데스크톱 전체 18개 시나리오 검증 완료(전체 실행에서 기존 16개 통과, Straight 테스트의 숨겨진 화면 선택을 수정한 후 해당 2개 재실행 통과). 3탭 순서·가운데 런닝 홈 복귀·방식 선택·Straight 출발/도착·교환·새로고침·결과 저장·조건/기록/저장 코스 바로가기를 포함합니다. 전용 Chromium 실행 파일이 없어 설치된 Chrome을 사용했습니다. 카카오 SDK는 모사하며 실제 키 인증·지도 타일 성공을 검증한 것은 아닙니다.
- 검사에서 발견한 카드 선택 되돌림을 수정했습니다. 추천 번호/지도 선택 시 가로 카드 위치를 즉시 맞추며, 실제 상세 URL과 결과의 거리·점수까지 확인합니다.

웹 export는 `dist/`를 정리하므로 iOS/Android export와 동시에 실행하지 마세요. native export가 필요하면 웹 export가 끝난 후 실행합니다.

## Vercel 시연 배포

루트의 `vercel.json`은 더미 데이터로 웹 빌드하고 `dist/`를 배포합니다. 상세 URL 직접 진입과 새로고침은 SPA rewrite로 처리합니다. [Expo 공식 Vercel 배포 가이드](https://docs.expo.dev/guides/publishing-websites/#vercel)를 따릅니다.

- Vercel에서 저장소를 가져오고 Framework Preset은 `Other`, Root Directory는 저장소 루트(`./`)로 둡니다. 설치·빌드 명령과 출력 폴더는 `vercel.json`에 지정되어 있습니다.
- 현재 `package.json`의 Node.js 범위는 `>=22.14.0`이므로 Vercel에서는 기본 `24.x`를 사용할 수 있습니다. 로컬 웹 검증은 `22.14.0`에서 했습니다. `22.x`로 고정하려면 `package.json`의 engines 범위도 함께 변경해야 합니다. [Vercel Node.js 버전 규칙](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)을 참고하세요.
- 로컬에서 배포하려면 프로젝트 루트에서 `npx vercel`을 실행하고 계정·프로젝트를 연결합니다.
- 키 없이도 도식 지도로 시연할 수 있습니다. 카카오 지도를 쓰려면 Vercel 환경 변수에 `EXPO_PUBLIC_KAKAO_MAP_JS_KEY`를 설정하고 배포 도메인을 카카오에 등록한 뒤 다시 빌드합니다. 자세한 설정은 [카카오 지도 가이드](KAKAO-MAPS.md)를 참고하세요.
- 로컬 빌드: `EXPO_PUBLIC_DATA_SOURCE=mock npm run export:web`. 확인: `node scripts/serve-demo.mjs` → `http://localhost:4173`.

`dist/`는 Git에 넣지 않습니다. 저장소를 통한 배포에서는 Vercel이 다시 빌드합니다.
Git 연동 배포는 원격 저장소의 커밋을 사용하므로 로컬 커밋 후 해당 브랜치에 push해야 변경된 `vercel.json`이 반영됩니다.
