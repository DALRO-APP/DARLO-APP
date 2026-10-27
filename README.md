# DALRO

오늘도, 더 좋은 길로. 용산구 공간정보 기반 맞춤 러닝 코스 앱입니다. 기본은 **더미 데이터 시연 프론트엔드**이고, **PACE 목적은 팀 전처리 실데이터로 추천하는 FastAPI 서버**([server/](server/README.md))와 연결할 수 있습니다.

Expo SDK 57 · React Native · TypeScript · Expo Router · Zustand · TanStack Query

```sh
npm ci
npm run web     # 브라우저에서 바로 시연
npm run start:go # SDK 57 호환 Expo Go에서 더미 흐름 시연
npm run start:dev # 설치된 DALRO 개발 앱 연결
```

Node 22.14 이상을 사용하세요. 지도 키·서버·로그인이 필요하지 않습니다. 목적 선택 → Loop / Straight 방식 선택 → 코스 설정(Loop: 출발지·거리 / Straight: 출발지·목적지, 공통: 주야간) → 지도에서 추천 선택 → 러닝 준비 → 모의 러닝 → 결과 → 기록 저장 흐름을 시연합니다. 조건·저장 코스·저장 전 결과·완료 기록은 기기에 보관합니다.

- [발표 시연 순서](docs/DEMO.md)
- [카카오 지도 로컬 확인·웹 배포 설정](docs/KAKAO-MAPS.md)
- [아이폰·Android 네이티브 지도 설치](docs/NATIVE-MAPS.md)
- [팀원 데이터 전달 규격](docs/TEAM-DATA-HANDOFF.md)
- [자료 예시](examples/data/) · [JSON Schema](docs/contracts/)
- [설계 결정과 후속 작업](docs/2026-10-01-app-skeleton.md)
- [목적 중심 화면 흐름](docs/2026-10-06-러닝-화면-흐름.md)
- [PACE 실데이터 서버 결정과 검증](docs/2026-10-27-pace-실데이터-서버.md) · [서버 실행](server/README.md)
- [작업 규칙](AGENTS.md) · [훅 활성화/한계](docs/harness.md)

mock 모드의 지도/경로/환경 수치는 가상입니다. GPS 측정은 아직 연결하지 않았습니다. 웹에서 JavaScript 키를 설정하면 배경은 카카오 실제 지도입니다. 검정/라임과 마스코트를 SVG 코드로 구성했습니다. PostGIS·인증은 포함하지 않습니다.

## PACE 실데이터 서버

```sh
cd server && python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m dalro_api.importer --raw data/raw   # 노션 zip → SQLite (server/README.md)
.venv/bin/uvicorn dalro_api.main:app --host 0.0.0.0
# 다른 터미널, 저장소 루트
EXPO_PUBLIC_DATA_SOURCE=hybrid EXPO_PUBLIC_API_URL=http://localhost:8000 npm run web -- --clear
```

데이터 모드를 바꿀 때는 `--clear`로 Metro 캐시를 비워야 이전 `EXPO_PUBLIC_*` 값이 번들에 남지 않습니다.

`hybrid`는 PACE만 서버로 보내고 POWER·NIGHT·GREEN은 더미로 시연합니다. 코스의 `is_mock`으로 화면 안내 문구를 구분합니다. `http`는 모든 목적을 서버로 보냅니다. repository가 `POST /v1/courses/recommendations`, `GET /v1/courses/{id}`를 호출하고 Zod 계약으로 응답을 검증합니다. 서버 장애 시 더미로 몰래 전환하지 않습니다. 웹·native 지도는 동일한 `RouteMapProps`를 사용합니다. Native 키 설정 시 카카오 지도는 **별도 개발 빌드**에서 사용하며 Expo Go에서는 설치 안내가 표시됩니다. 네이티브 컴파일·실기 렌더링 검증은 빌드 환경 준비 후 필요합니다.

```sh
npm run check
npx expo install --check
npm run export:web
npm run export:ios
npm run export:android
npx playwright install chromium
npx playwright test
```

Playwright는 웹 export 후 실행합니다. macOS에 설치된 Chrome을 쓰려면 `PLAYWRIGHT_CHROME=1 npx playwright test`를 실행할 수 있습니다. native export는 JS 번들 검사이며 APK/IPA 빌드·실기 테스트와 다릅니다. GitHub Actions에서도 위 검사를 실행합니다.
