# Vercel에 프론트와 SQLite 백엔드를 함께 배포

2026-10-28. 시연에서는 생성 코스·추천 로그의 서버 영속성이 필요 없다는 요청에 따라 외부 DB 없이 Vercel 한 프로젝트로 구성한다. 고정 공간자료는 배포에 포함하고, 각 Python Function 인스턴스는 이 자료로 자신의 임시 SQLite를 만든다. 원본 zip·로컬 SQLite·WAL·환경 파일은 업로드하지 않는다.

## 실행 구조

- `/`: Expo 웹 export를 Vercel CDN에서 제공한다. `/course/{id}` 등 직접 진입은 SPA로 연결한다.
- `/api/*`: `api/index.py`의 FastAPI가 처리한다. API rewrite를 SPA보다 먼저 적용하고 검색 query를 보존한다. 없는 API는 JSON 404를 반환한다.
- `server/seed/yongsan-network.sql.gz`: 고정 공간자료만 포함한 약 1.6MB 파생 배포 자료다. 도로 9,276개·노드 6,906개·시설 6,353개·검색 장소 15,682개와 자료 버전을 포함한다. 압축 SQL로 관리하며 원본 SQLite 파일을 커밋하지 않는다.
- 인스턴스 시작 시 `/tmp/dalro-demo-*/dalro.sqlite3`로 복원한다. 이 파일에는 자유롭게 추천 코스·로그를 쓸 수 있지만 인스턴스 교체 시 초기화될 수 있다. 새 인스턴스도 같은 공간자료를 다시 복원하므로 도로망·경사·시설은 유지된다.
- `/api/health`의 `storage: temporary-demo`가 이 모드를 나타낸다. 로컬 `uvicorn dalro_api.main:app`은 기존 영속 SQLite 사용을 유지한다.

현재 로컬 DB를 SQLite backup API로 읽고 복사본에서만 `courses`, `recommendation_logs`를 비운다. 실행 중인 원본 DB나 보조 파일은 이동·삭제하지 않는다. 허용한 테이블 외 새 테이블이 있거나 무결성에 문제가 있으면 배포 자료 생성을 중단한다.

## 코스 상세와 브라우저 저장

서로 다른 Vercel 인스턴스 사이에는 생성 코스가 공유되지 않는다. 추천 직후 다른 인스턴스가 상세 요청을 받는 상황을 처리하기 위해 `HttpCourseRepository`가 검증한 서버 코스를 기기에 최근 24개까지 보관한다. 동일 브라우저에서 상세 진입·새로고침·즐겨찾기 조회에 이 원본을 재사용한다. Zustand에 서버 원본을 새 전역 상태로 복제하지 않는다.

캐시는 API 주소별로 분리하고 읽을 때 Zod로 검증한다. 잘못된 저장 데이터는 사용하지 않으며, 캐시에 없는 코스만 서버에서 조회한다. 저장소 접근이 막혀 있어도 정상 추천 응답을 버리지 않는다. 새 코스를 더미로 만들어 대체하지 않는다. 캐시를 비우거나 다른 브라우저에서 이전 상세 URL을 열면 서버 저장이 사라져 404일 수 있으며 이때 다시 추천받는다. 사용자의 모의 러닝 기록은 기존 기기 저장을 유지한다.

## 자료 갱신·실행·배포

```sh
# 팀 자료를 다시 임포트한 뒤, 고정 배포 자료를 갱신
cd server
.venv/bin/python -m dalro_api.demo_seed
.venv/bin/python -m pytest
cd ..
npm run check
node scripts/build-vercel.mjs

# 기존 프로젝트 연결과 Preview 검증
vercel link --yes --project darlo-app --scope snackers-projects
vercel deploy --dry --json
vercel deploy --yes
# 검증 후 운영 배포
vercel deploy --prod --yes
```

배포 자료를 갱신하면 압축 파일도 함께 커밋한다. 원본 zip과 SQLite는 계속 `server/data/`에서 Git 제외한다. `requirements.txt`는 Vercel Python 런타임 의존성이고 `server/requirements.txt`는 로컬 개발·자료 처리·테스트 용도다. `.python-version`은 3.13이다.

`scripts/build-vercel.mjs`는 웹을 `hybrid`, API 주소 `/api`, PACE 서버 추천, 공간정보 지도 모드로 빌드한다. 공개 환경 변수 변경이 Metro 캐시에 남지 않게 `--clear`를 사용한다. 카카오 REST 키가 없으면 기존 로컬 장소 색인을 사용한다. 서버 키를 `EXPO_PUBLIC_*`에 넣지 않는다.

## 휴대폰 브라우저 시연

웹에서만 `WebViewport`가 viewport를 `user-scalable=no`로 고정하고 `body`를 화면에 붙인다. 페이지 전체 핀치·더블탭 확대와 바깥 바운스 스크롤을 막고, 세로 이동은 각 화면의 `ScrollView`에서만 일어난다. iOS Safari는 viewport 설정을 무시할 수 있어 `gesturestart`와 두 손가락 `touchmove`도 막는다.

공간정보 지도 위에서는 `MapGestureSurface.web`이 Pointer Events로 한 손가락 이동, 두 손가락 확대·축소, 데스크톱 휠 확대를 처리한다. 손가락 중심의 지도 좌표를 고정하는 계산은 `transformTerrain`이다. native는 기존 PanResponder 이동과 확대 버튼을 유지한다. 카카오 지도 모드는 SDK 제스처를 그대로 쓴다.

## 확인 기준

서버 테스트는 고정 자료 복원, 원본 보존, 생성 데이터 제외, 인스턴스 교체 후 공간자료 유지·생성 코스 소실, API rewrite와 검색 query를 검사한다. 앱 테스트는 서버 인스턴스가 바뀐 뒤의 코스 복원, API 주소별 캐시 분리, 손상 캐시 배제, 24개 제한과 저장 실패를 검사한다.

배포 전 `vercel deploy --dry --json`에서 고정 자료 포함 및 `.env*`, `server/data/`, `.venv`, 원본 PDF·zip 제외를 확인한다. 실제 배포에서는 `/api/health`, 장소 검색, 실데이터 추천, 코스 선택·상세·새로고침·모의 러닝과 API 오류를 확인한다. Python/JS export나 Preview 빌드만으로 native APK/IPA·실기 검증을 보고하지 않는다.

근거: [Vercel Python Functions](https://vercel.com/docs/functions/runtimes/python), [Vercel SQLite 영속성 제약](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [배포 제외 설정](https://vercel.com/docs/deployments/vercel-ignore).

## 검증 결과

- 앱 검사 74개, 서버 테스트 28개, 실제 Vercel Linux의 `npm ci`·웹/Python 빌드 통과.
- Linux 빌드에서 누락됐던 `@emnapi/core`·`@emnapi/runtime` 1.11.3 lockfile 항목을 기존 검증 버전으로 복원했다. 앱 의존성 선언이나 실행 중인 node_modules는 변경하지 않았다.
- Preview `/api/health`: `temporary-demo`, 도로 9,276개·노드 6,906개·실제 자료 버전 정상.
- 보호된 Preview의 Chrome 모바일·데스크톱에서 Straight 6.7km, Loop 5,112/4,699/4,658m, 신호등 묶음 3/2/0곳, 코스 선택·상세·새로고침·모의 러닝을 확인했다. 상세/새로고침이 서버 코스 저장 조회 없이 기기 캐시로 이어졌다. responder 경고 및 페이지 오류 0건.
- Vercel의 Preview 보호 설정은 해제하지 않았다. CLI의 인증 기능을 사용해 검증했다. 실제 기기 검증은 수행하지 않았다.
- 모바일 웹 고정: Chrome 모바일 에뮬레이션에서 지도 두 손가락 확대 시 지도 viewBox만 바뀌고 페이지 배율 1·문서 스크롤 0을 유지함을 E2E로 확인했다. 실제 iPhone Safari·Android Chrome 확인은 아래 운영 배포 후 사용자 기기에서 필요하다.
