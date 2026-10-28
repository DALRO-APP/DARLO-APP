# DALRO 앱 작업 하네스

## 프로젝트와 현재 단계

DALRO는 도시 공간정보를 이용한 개인 맞춤 러닝 코스 추천 앱이다. 이 저장소는 Expo SDK 57 + React Native + TypeScript 프론트엔드다. 파일 라우팅은 Expo Router, 앱 상태는 Zustand, 서버 조회는 TanStack Query를 사용한다.

현재 목표는 **용산구 데이터로 교수님께 앱 흐름을 시연**하는 것이다. 베타에서는 PACE만 선택할 수 있고 POWER·NIGHT·GREEN은 준비 중으로 잠근다. 출발지, 거리, 주야간 조건과 Loop/Straight 코스를 다룬다. PACE는 `server/`(FastAPI·SQLAlchemy·SQLite)가 팀 전처리 실데이터로 추천한다. 나머지 목적의 알고리즘·PostGIS·인증·GPS 수집은 후속 작업이다.

## 작업 원칙

- 한국어로 간결하게 설명한다. 요청에 포함된 로컬 구현·설치·검증은 바로 진행한다. 이미 허용한 작업에 반복 승인이나 계획 승인을 요구하지 않는다.
- 작업 전 `git status --short`, 관련 화면 → Zustand/Query → repository → domain 계약 흐름을 확인한다. 기존 사용자 변경과 `pdf/` 원본을 보존한다.
- 운영 서비스 규칙을 이 데모에 무조건 적용하지 않는다. 커밋·push·배포·외부 문서 변경은 요청한 경우에만 한다. 팀원에게 메시지나 메일을 보내지 않는다.
- `.env` 비밀값을 출력하지 않는다. `EXPO_PUBLIC_*`는 공개 앱 번들에 포함되므로 토큰·DB 비밀번호를 넣지 않는다.
- 의존성은 SDK 57의 `node_modules/expo/bundledNativeModules.json`과 `npx expo install --check`로 맞춘다. lockfile도 함께 관리한다.
- 조회되지 않은 자료를 확인했다고 보고하지 않는다. 노션 '데이터 저장소'는 Notion MCP로 조회·첨부 다운로드할 수 있다(2026-10-27). 확인한 첨부와 사실은 `docs/2026-10-27-pace-실데이터-서버.md`에 있다. 원본 zip·SQLite는 `server/data/`에 두고 커밋하지 않는다.

## 구조와 탐색

```text
app/                       Expo Router 화면·레이아웃
  (tabs)/                  홈·탐색·기록·마이
  course/[id].tsx           상세
  run.tsx                  모의 러닝
src/components/            공통 UI·마스코트·지도 공급자 경계
src/maps/                  카카오 웹 SDK 로더·native 전달 데이터
modules/dalro-kakao-map/    공식 Kakao SDK를 연결하는 로컬 Expo 모듈
src/domain/                API/GeoJSON 계약, 지리 계산, 목적·출발지 목록
src/services/              mock/http repository, TanStack Query
src/state/                 Zustand 입력·즐겨찾기·기록
src/data/                  명시적인 더미 코스
src/theme/                 색상 토큰
examples/data/             실행 검사 가능한 전달 예시 4종
server/                    PACE 추천 FastAPI 서버(임포트·그래프·라우팅·pytest)
scripts/                   자료 검사·예시 생성·웹 시연 서버
 tests/                    모바일/데스크톱 웹 시연 E2E
 docs/                     데이터 전달·시연·의사결정·JSON Schema
.codex/                    훅·명령 정책
pdf/                       원본 제안 발표와 대본 (수정 금지)
```

## 앱·데이터 경계

- 화면에서 직접 fetch/공간 분석을 하지 않는다. 서버 데이터는 `CourseRepository`와 Query를 경유한다.
- 입력과 로컬 즐겨찾기·시연 기록은 Zustand에 둔다. 서버 코스 원본을 별도 전역 상태에 복제하지 않는다.
- mock/http는 동일 계약을 사용하며 HTTP 응답은 Zod로 검증한다. 서버 장애에서 몰래 mock으로 전환하지 않는다.
- 지도 교체 시 `RouteMapProps`를 보존한다. 기본은 번들한 팀 DEM·등고선·도로망·공원을 표시하는 SVG 공간정보 지도다. `EXPO_PUBLIC_MAP_STYLE=kakao`에서는 웹 JavaScript SDK, native 개발 빌드 로컬 Expo 모듈을 사용한다. 더미 경로·모의 주행을 실제 추천/GPS로 표현하지 않는다. 카카오 모드에서 키가 없으면 도식 지도, Native 키를 설정한 Expo Go는 설치 안내와 사용자가 선택하는 도식 지도를 제공한다.
- native 코드 변경은 JS export 외에 플랫폼 컴파일·실기 검증이 필요하다. Xcode/Android SDK/서명 정보가 없으면 그 한계를 명시한다. generated `/ios`, `/android`는 커밋하지 않고 `modules/.../ios`, `modules/.../android` 소스를 관리한다.
- GeoJSON은 EPSG:4326, 좌표는 `[경도, 위도]`, 거리는 m, 시간은 s, 경사는 %이다.
- 도로 통합은 고정 `edge_id`와 원본 `network_version`으로 한다. 미측정은 null, 측정된 0은 0이다.
- 환경 지표를 실제 안전 보장으로 표시하지 않는다. 더미 코스·모의 기록은 화면에 표시한다.
- loading, 빈 결과, 오류/재시도, 없는 코스 URL, 직접 진입을 처리한다.
- 구조·계약 변경 시 문서를 함께 갱신한다. 주요 의사결정은 `docs/YYYY-MM-DD-주제.md`에 기록한다.

## 검증과 완료 보고

```sh
npm run check
npm run export:web
npm run export:ios
npm run export:android
npx expo install --check
npx playwright test       # web export 후, Chromium 설치 필요
cd server && .venv/bin/python -m pytest   # 서버 변경 시
```

계약·상태 변경에 의미 있는 경계·회귀 테스트를 갱신한다. 사소한 스타일 변경에 구현을 반복하는 테스트를 만들지 않는다. 검증 실패를 테스트 삭제나 assertion 완화로 숨기지 않는다. 변경 범위 검증부터 실행하고 이유 없이 반복하지 않는다.

완료 보고는 구현된 흐름, 검증 결과, 실행 방법, 전달 문서, 실제 기기 검증 여부를 포함한다. native JS export는 APK/IPA 빌드·실기 테스트가 아니다. mock 어댑터를 실제 서버/추천 알고리즘 완성으로 보고하지 않는다.

`.codex/hooks.json`은 로컬 Codex 명령 가드다. 프로젝트 및 훅 신뢰가 필요하며 CLI `/hooks`에서 검토한다. 파일을 만들었다고 현재 세션에 자동 활성화되었다고 보고하지 않는다. 사용자 전역 설정·시스템 sandbox를 변경하지 않는다. 구성과 한계는 `docs/harness.md`를 참고한다.
