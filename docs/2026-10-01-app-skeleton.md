# 2026-10-01 DALRO 앱 스켈레톤

## 근거와 목적

발표 대본 p7~p14의 목적별 코스·복수 후보·환경 설명·앱/서버 분리, 발표 PDF p7과 제공 이미지의 검정/라임/마스코트, 최신 카톡의 용산구 파일럿을 기준으로 10월 7일 시연 준비용 프론트엔드를 만들었다. 노션은 연결이 없어 실제 파일 내용을 확인하지 않았다.

## 선택과 결과

사용자 지정 스택 Expo SDK 57(57.0.26), 공식 호환 React 19.2.3/RN 0.86.3, TypeScript, Zustand, TanStack Query, Expo Router를 사용했다. 입력/즐겨찾기/시연 기록은 AsyncStorage로 보관하고 코스는 Query 캐시에서 조회한다.

홈 조건 선택 → 후보 비교 → 상세/저장/공유 → 모의 주행(일시정지·1분 진행·완주) → 기록/후기 → 재추천을 연결했다. 이름 검색/저장 탐색, 빈 결과·오류/재시도·없는 코스·직접 URL 진입도 처리한다.

`CourseRepository`의 mock/http를 동일 Zod 계약으로 분리했다. HTTP 엔드포인트는 제안이고 실제 서버를 생성하지 않는다. 지도는 네트워크/키 없이 시연할 수 있도록 react-native-svg 도식 지도로 만들었다. `RouteMapProps`를 유지해 발표에서 계획한 카카오 지도 공급자로 교체한다. 마스코트/삽화도 SVG 코드이며 제공 래스터의 원본 파일을 복제한 자산은 아니다.

mock 모양을 목표 거리로 변환하는 코드는 실제 도로 알고리즘이 아니다. 시작/끝을 맞추고 측지 길이를 계산한다. 모의 주행은 시간 비율로 geometry 점을 따라 이동하고 실제 GPS/운동량을 측정하지 않는다. 완료 기록만 생성하며 후기/조건/하트를 기기에 저장한다. 예시 도로망과 코스는 별도 가상 자료이고 edge 연결을 가장하지 않는다.

팀원용 전달 문서, 예시 4종, JSON Schema, 실행 검사기로 edge_id·좌표계·null/0·단위·노드 위치·방향별 상승량을 명시했다. 작업 하네스는 운영 DB 규칙을 그대로 복제하지 않고 이 레포에 맞춘 로컬 규칙/가드/검증으로 구성했다.

## 후속 작업과 한계

SDK 구성은 [Expo SDK 57 릴리스](https://expo.dev/changelog/sdk-57)와 설치한 Expo의 `bundledNativeModules.json`을 기준으로 확인했다. Router 자동 peer가 더 높은 native 버전을 선택한 문제를 찾아 reanimated 4.5.1, worklets 0.10.1, gesture-handler ~2.32.0으로 명시했다. package-lock.json을 포함한다.

서버·DB를 생성/변경하지 않았다. 실제 전처리·cost/회귀 탐색·지도·GPS 권한/측정·인증·기록 동기화를 이후 연결한다. 데이터 보관 정책과 Zustand 저장 버전 마이그레이션도 후속 과제다. API를 바꿔도 모의 러닝은 그대로이고 GPS는 별도 구현해야 한다.

`EXPO_PUBLIC_DATA_SOURCE=http`와 URL로 저장소를 바꿀 수 있으나 실제 서버가 필요하다. native JS export는 APK/IPA 빌드나 실기 테스트를 대신하지 않는다. 실기 위치/백그라운드 러닝은 검증하지 않았다.

## 검증 결과

- `npm run check`: 타입·lint, 단위/계약 테스트 13개, 전달 예시·명령 훅 검사 통과.
- `npx expo export --platform all`: 최종 웹·iOS·Android JS/Hermes 번들 생성 통과.
- `PLAYWRIGHT_CHROME=1 npx playwright test`: Chrome에서 모바일/데스크톱 조건 변경→저장→상세→일시정지→완주→기록→평점/후기→새로고침 복원, 빈 기록/없는 코스까지 4개 검사 통과. 브라우저 pageerror 없음.
- `npx expo install --check`: 네트워크 제한으로 공식 로컬 패키지 맵 기준 검증 통과. native peer 트리는 `npm ls`로 일치 확인.
- `git diff --check`: 통과. APK/IPA·실기·실제 서버/노션 파일·자동 훅 활성화는 미검증.
