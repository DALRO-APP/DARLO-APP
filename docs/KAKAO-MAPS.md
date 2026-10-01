# 카카오 지도: 로컬 확인과 웹 배포

웹은 Kakao Maps JavaScript SDK를 사용한다. `RouteMap.web.tsx`가 웹에서만 로드되며 iOS/Android의 `RouteMap.tsx`는 기존 도식 지도를 사용한다. native SDK 연결은 후속 작업이다. 두 공급자는 동일 `RouteMapProps`를 받으므로 서버의 GeoJSON 계약을 바꾸지 않는다.

## 로컬 설정

1. Kakao Developers에서 해당 앱의 **JavaScript 키**를 확인한다.
2. 앱 → 앱 설정 → 플랫폼 키 → 해당 JavaScript 키의 JavaScript SDK 도메인에 실행 주소를 등록한다. `localhost`와 `127.0.0.1`, 포트가 다른 주소는 각각 등록한다.

   ```text
   http://localhost:8081
   http://localhost:4173
   ```

   시연 기본 주소는 `localhost`다. `http://127.0.0.1:4173`으로도 접속하려면 그 주소를 추가 등록한다. 같은 컴퓨터를 가리켜도 카카오는 다른 origin으로 판정한다.

3. 앱의 카카오맵 → 사용 설정도 확인한다.
4. git에서 제외된 `.env.local`에 다음 변수를 넣는다. 실제 키를 README나 소스에 넣지 않는다.

   ```dotenv
   EXPO_PUBLIC_KAKAO_MAP_JS_KEY=YOUR_JAVASCRIPT_KEY
   ```

5. `npm run web`을 실행한다. 이미 실행 중인 Expo가 환경 변경을 반영하지 않으면 개발 서버를 다시 시작한다. 정적 빌드는 `npm run export:web` → `node scripts/serve-demo.mjs` → `http://localhost:4173`이다.

키가 비어 있으면 기존 도식 지도로 실행된다. 설정된 키의 SDK 요청이 실패하면 오류·현재 origin·재시도·사용자가 선택하는 도식 지도 버튼이 표시된다. 이를 실제 지도 성공으로 표시하지 않는다.

## 지도와 데이터의 구분

카카오가 제공하는 배경 위에 앱의 `LineString`을 Polyline으로 표시한다. 코스 선 클릭, 선택 코스 강조, 출발/도착 마커, 전체/선택 코스 범위 맞춤, 모의 러닝 위치를 지원한다. SDK 저작권 표시 영역 위에 앱 컨트롤을 덮지 않도록 안내 영역을 지도 밖에 둔다.

GeoJSON `[경도, 위도]`를 Kakao `LatLng(위도, 경도)`로 변환한다. **카카오 지도를 연결해도 현재 더미 코스가 도로 기반 추천 결과로 바뀌지는 않는다.** 강·건물 위를 지나는 가상 경로가 있을 수 있다. 실제 경로는 후속 서버/알고리즘이 동일 계약의 geometry로 반환해야 한다. 러너 마커는 모의 진행률이며 GPS가 아니다.

## 배포

웹 호스팅의 빌드 환경에 동일 변수를 설정하고 실제 서비스 origin(예: `https://dalro.example.com`)을 JavaScript SDK 도메인에 추가한다. Expo의 `EXPO_PUBLIC_*`는 빌드에 포함되므로 런타임 환경만 바꾸면 이미 배포된 파일의 키가 변경되지 않는다. 환경 변경 후 다시 빌드한다. 상세 URL 직접 진입에는 SPA fallback이 필요하다.

JavaScript 키는 브라우저가 사용하는 공개 앱 식별자다. 서버 비밀키·관리자 키를 넣지 않는다. 웹 키를 native SDK 키로 재사용하지 않는다.

## 확인 결과와 테스트 범위

2026-10-01 도메인 등록 전 공식 SDK 요청은 HTTP 401 `AccessDeniedError: domain mismatched`로 실패했다. 사용자가 `localhost:8081`, `localhost:4173`을 등록한 뒤 두 주소에서 SDK HTTP 200, 앱 지도 상태 `ready`, 실제 타일 이미지 로드와 Polyline 표시를 Chrome 모바일 크기에서 확인했다. `127.0.0.1:4173`은 별도 등록되지 않아 여전히 같은 401로 실패하므로 기본 시연 주소를 `localhost`로 통일했다.

실제 키는 문서·테스트·커밋에 포함하지 않았다. 브라우저의 `ERR_BLOCKED_BY_ORB`는 초기 실패 요청에서 관측되었으며 앱의 TypeScript 오류로 판정하지 않았다. 실제 확인과 아래 SDK 모사 테스트 결과는 구분한다.

Playwright는 공식 SDK 요청을 테스트용 응답으로 대체해 좌표 순서·경로 갱신·SDK 실패 후 재시도·도식 지도 전환을 검사한다. 이 자동 검사는 실제 키의 권한·카카오 타일 서버 정상 여부를 증명하지 않는다. CI 웹 export에는 테스트용 문자열 키를 사용하며 외부 카카오 호출이 발생하지 않도록 요청을 가로챈다.

검증: `npm run check` 통과(단위 테스트 13개 포함), 웹·iOS·Android export 통과, 기존 시연 E2E 4개와 지도 공급자 E2E 6개 통과. native export는 JS 번들 생성만 검사하며 실기 검증이 아니다. 각 플랫폼 출력은 `dist/`, `dist/ios/`, `dist/android/`로 나눠 native export가 웹 시연 파일을 덮어쓰지 않는다.

- [공식 Web API 가이드](https://apis.map.kakao.com/web/guide/)
- [공식 SDK 문서](https://apis.map.kakao.com/web/documentation/)
- [카카오맵 공통 안내](https://developers.kakao.com/docs/ko/kakaomap/common)
