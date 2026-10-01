# DALRO 데이터 전달 규격 — 팀원 공유용

> 2026-10-01 · 초안 v1.0 · 1차 지역: 서울 용산구
>
> 서버와 추천 코스를 앱에 연결하기 위한 공통 규격 제안입니다. 현재 앱은 더미로 동작합니다. 아래 컬럼과 단위는 **새로 제안하는 계약**이며 노션 실제 파일을 검사한 결과가 아닙니다. 카톡에서 `seoul_running_roads_ready.shp`, `signal_cnt`, `cross_cnt`를 확인했습니다.

## 팀원들에게 먼저 부탁할 것

1. **같은 도로망을 사용하고 `edge_id`를 고정해 주세요.** 기본망 담당이 ID·노드·망 버전을 정한 뒤 다른 담당자는 속성만 붙여주세요. QGIS FID/행 번호를 각자 다시 만들어 합치면 안 됩니다.
2. 최신 카톡의 분담: 기본망·신호·횡단보도 김리우(김유진), DEM 경사 김시원, 가로등·공원 유경수. 기본망 담당이 통합하는 안입니다.
3. **원자료 값과 추천 점수는 따로 보내주세요.** 경사 %, 시설 개수, 공원까지 m를 보존하고 점수화·가중치는 별도 버전으로 전달합니다. POWER에서 경사가 무조건 감점되는 식으로 의미를 섞지 않습니다.
4. 분석 도로망은 서버/알고리즘 팀에, **앱에는 추천 코스 JSON**을 전달합니다. SHP나 QGIS 프로젝트를 앱에서 직접 처리하지 않습니다. 서버가 없어도 JSON 파일로 먼저 화면 연결을 확인할 수 있습니다.
5. 카톡의 다음 주 수요일까지 개발/목요일 미팅 계획은 **10월 7일(수) 시연 준비, 10월 8일(목) 미팅**으로 이해했습니다. 이후 일정 변경은 팀에서 확정합니다.

## 전달 묶음

```text
yongsan-running-v1/
├── manifest.json          버전·좌표계·출처·처리 기준·행 수
├── roads.geojson          통합 도로와 원자료 속성
├── request.json           아래 코스를 만들 때 쓴 조건
├── recommendations.json  추천 2~3개, 없으면 courses: []
├── quality-report.md      결측·연결성·통행 가능성 검증
└── scoring.md             정규화·가중치·회귀/거리 허용오차
```

[예시 폴더](../examples/data/)는 실행 검사 가능합니다. 예시 도로와 코스는 별도의 규격 설명용 가상 자료입니다. 예시의 `is_mock: true`, `edge_ids: []`는 데모에서만 허용합니다. 실제 코스는 전달한 도로망의 ID를 반드시 참조합니다.

분석 원본은 GPKG를 권장합니다. SHP는 `.shp/.shx/.dbf/.prj`와 인코딩 정보를 함께 압축해 주세요. 컬럼 길이 제약이 있으므로 SHP→GeoJSON 매핑표를 함께 제공합니다. QGIS 프로젝트만 보내면 원본 경로가 깨질 수 있습니다.

## 좌표계·ID·그래프 공통 규칙

| 항목                | 약속                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| 지도/API 지오메트리 | **WGS84 EPSG:4326**, GeoJSON, UTF-8                                        |
| 좌표 순서           | **[경도, 위도]**. 이촌 예시 `[126.9745, 37.5178]`                          |
| 분석 좌표계         | 미터 투영좌표계. EPSG:5186 등 실제 선택한 CRS를 manifest에 기록            |
| 변환                | CRS를 지정만 하지 말고 목적 CRS로 **재투영**                               |
| geometry            | 구간별 LineString. MultiLineString은 연결 구간으로 분해·ID 매핑 보존       |
| edge_id             | 문자열, 유일·고정. 망 변경 시 network_version 및 old→new 매핑 제공         |
| from_node / to_node | 문자열 ID. geometry의 첫/마지막 좌표와 방향 일치                           |
| 방향                | 한 구간 한 행. bidirectional=true면 양방향 아크 생성. 중복 역방향 행 금지  |
| 단위                | 거리·고도 m, 시간 s, 경사 %, 시설 수 정수, 비율 0~1                        |
| 미측정              | **null**. 측정한 시설 없음은 **0**. -9999/빈 문자열/NaN 금지               |
| 연결                | 동일 node의 위치는 2m 이내. 고가/지하/다리를 평면 교차만으로 연결하지 않기 |

경사 2.1%는 `slope_pct: 2.1`입니다. 2.1°와 다르며 각도는 tan(각도)×100으로 변환해야 합니다. 미터 투영값은 앱 전달 전에 WGS84로 재투영합니다.

용산구 경계로 도로를 자르면 한강 루프가 끊길 수 있습니다. 용산구 출발점 + 합의한 경계 버퍼를 제안하며, 구 밖 도로 허용 여부와 버퍼 폭을 manifest에 명시합니다. 앱의 도식 지도가 이 정책을 결정하지 않습니다.

## roads.geojson 필수 속성

| 컬럼                     | 타입 / 결측       | 의미                                                           |
| ------------------------ | ----------------- | -------------------------------------------------------------- |
| edge_id                  | string / 불가     | 기준 도로 ID                                                   |
| from_node, to_node       | string / 불가     | 탐색 그래프 양 끝 노드                                         |
| length_m                 | number >0 / 불가  | 투영 또는 측지 거리로 계산한 geometry 길이                     |
| walkable                 | boolean / 불가    | 자동차 전용/출입금지 등을 제외한 보행 가능성                   |
| bidirectional            | boolean / 불가    | false면 geometry 방향만 통행                                   |
| slope_pct                | number ≥0 / null  | 길이 가중 평균 절대 경사. 계산·샘플 방법 설명                  |
| elevation_gain_forward_m | number ≥0 / null  | geometry 방향 누적 상승량. 양 끝 고도 차와 구분                |
| elevation_gain_reverse_m | number ≥0 / null  | 역방향 누적 상승량                                             |
| signal_cnt               | integer ≥0 / null | 부착대/실제 보행신호인지 정의·출처 명시. 대기 횟수로 단정 금지 |
| cross_cnt                | integer ≥0 / null | 연결된 횡단보도 수                                             |
| light_cnt                | integer ≥0 / null | 도로 버퍼 안 가로등 수. 실제 밝기/안전과 구분                  |
| park_dist_m              | number ≥0 / null  | 공원 접근 거리. 외곽/출입구/도로 경로 기준 명시                |
| green_ratio              | number 0~1 / null | 도로 버퍼 녹지 면적 비율                                       |
| data_version             | string / 불가     | manifest의 통합 자료 버전                                      |

핵심은 도로·경사·가로등·신호·횡단보도·공원입니다. 미완성 속성은 null로 보내고 품질 보고서에 결측률을 기록해 주세요. null 경사를 평지/POWER 추천 근거로 쓰면 안 됩니다. CCTV·생활인구·교통량·편의시설·수변거리 등은 이후 optional 속성으로 확장합니다.

담당별 `edge_id,<속성...>` UTF-8 CSV도 가능합니다. 동일 망 버전, 한 ID 한 행, 중복/누락 ID 목록을 함께 보냅니다. 통합 담당이 left join 후 결측률을 확인해 GeoJSON으로 내보냅니다.

공간 결합 방법에는 **버퍼 폭, 시설 중복 제거, 교차로 시설을 여러 edge에 붙이는 방식, 최근접/주변 전체 결합 여부, 공원 출입구/담장, DEM 해상도·샘플 간격·NoData·다리 고도 처리**를 기록합니다. 도로 길이가 다르므로 점수 계산에서 가로등 수/km 등 길이 보정 여부도 적습니다.

## 앱 → 알고리즘 요청

제안: `POST /v1/courses/recommendations`

```json
{
  "schema_version": "1.0",
  "start": [126.9745, 37.5178],
  "target_distance_m": 5000,
  "purpose": "PACE",
  "time_of_day": "night",
  "route_type": "loop",
  "distance_tolerance_ratio": 0.1
}
```

UI는 3/5/8km를 제공합니다. 계약은 1~20km이고 실제 알고리즘 지원 범위는 서버에서 검증합니다. 목적은 PACE/POWER/NIGHT/GREEN, 시간 조건은 day/night입니다. 야간 PACE면 평탄함과 조명을 함께 반영하므로 목적과 시간 조건을 구분합니다.

출발점을 보행 도로/노드로 스냅하되 원래 위치에서 50m 이내를 기본값으로 제안합니다. 불가능하면 임의로 먼 곳으로 이동하지 말고 오류나 대안 출발점을 반환합니다.

## 알고리즘 → 앱 추천 결과

전체 예시: [recommendations.json](../examples/data/recommendations.json). 형식: [응답 JSON Schema](contracts/recommendation-response.schema.json). 앱/검사기의 실행 규칙은 [contracts.ts](../src/domain/contracts.ts)가 기준입니다.

| 항목         | 필수 내용                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 최상위       | schema_version="1.0", request_id, courses(0~3개, 추천 순서)                                                                                  |
| 기본         | id, name, subtitle, purpose, region, start_label                                                                                             |
| geometry     | LineString, [lon,lat] 최소 4점. 실제 도로 순서대로 이어진 경로                                                                               |
| summary      | distance_m, estimated_duration_s, elevation_gain_m, avg_slope_pct, signal_count, crossing_count, light_count, green_ratio, environment_score |
| summary 결측 | 거리/시간 필수 양수. 나머지는 null 가능. environment_score는 0~100 환경 지표이며 안전 보장 아님                                              |
| reasons      | code, title, description. code=flat/hill/lighting/green/signals/loop                                                                         |
| segments     | id, name, description, distance_from_start_m. 시작·주요 구간·도착 누적 거리 오름차순                                                         |
| edge_ids     | 실제 방문 순서. 왕복/반복 ID 허용, 서버가 방향을 추적                                                                                        |
| 출처         | data_version, algorithm_version, is_mock                                                                                                     |

거리 오차는 입력 ±10%를 초기 제안으로 둡니다. geometry 길이와 summary도 일치해야 합니다. 검사기의 15% 길이 임계값은 잘못된 파일을 찾는 임시 허용치이며 실제 목표 품질은 2% 이내입니다. 출발/도착 20m 이내 회귀, 요청 위치에서 50m 이내 출발을 검사합니다.

상세는 `GET /v1/courses/{id}`가 같은 Course 객체를 반환하는 안입니다. ID는 앱 새로고침/서버 재시작에도 조회 가능하게 하고 발급·보관 기간을 결정해 주세요. 서버는 아직 구현하지 않았습니다.

결과 없음은 `courses: []`, 잘못된 조건 422, 서버 오류 5xx를 제안합니다. 오류 본문 code/사용자 메시지/request_id는 추후 합의하며 현재 앱은 HTTP 상태 기반 안내를 사용합니다. 장애에서 실제처럼 가짜 코스를 반환하지 않습니다.

## 점수화·회귀 경로는 알고리즘 팀에서

- PACE: 작은 경사 변화와 적은 중단 지표를 선호.
- POWER: 적당한 경사·상승량을 목표로 하되 보행 가능성과 과도한 경사 제약 유지.
- NIGHT: 조명 분포·보행 가능성 우선. 가로등 수만으로 안전을 판단하지 않기.
- GREEN: 녹지·공원 접근성·수변 환경 반영.
- 정규화 범위, clipping, 결측 처리, 길이 보정, 목적/주야간 가중치와 산정 버전을 기록.
- Dijkstra/A*의 edge cost는 음수가 되지 않게 설계. 길이 비용과 선호 점수를 분리하고 같은 길 반복으로 거리만 채우지 않기.
- A→B 최단경로만으로 5km 루프가 생기지 않습니다. 중간점 후보/반환 경로 결합, 루프 연결, 거리 오차, 중복 도로 비율, 후보 다양성을 별도로 설계합니다.
- 교수님 피드백 전 가중치는 실험값으로 표시합니다. 앱 데모는 알고리즘 성능을 검증한 결과가 아닙니다.

## 전달 전 실행 검사

```sh
npm ci
node --import tsx scripts/validate-data.ts /전달폴더/경로
# 이 레포의 예시는 npm run check:data
```

4개 자료의 필수 필드·단위·버전·행 수, 중복 edge/node 좌표, 도로/코스 길이, 코스 ID, 출발·회귀·거리 허용오차와 edge 참조를 검사합니다. JSON Schema만으로 연결/회귀 같은 교차 필드 규칙을 검사할 수 없으므로 실행 검사도 필요합니다.

`quality-report.md`에는 추가로 아래를 기록합니다. 자동 검사 통과만으로 실제로 뛸 수 있는 코스라고 판단하지 않습니다.

- 도로 수·유일 ID 수·보행 가능 수, 속성별 결측률·제외 사유.
- 망 버전·좌표계 변환 전후 기준점·연결 성분 수·고립 구간.
- 고가/다리/지하/횡단 연결과 보행 불가·출입금지 제외 방식.
- 추천 geometry가 edge 순서/방향과 연결되는지, edge length 합계와 코스 거리 일치 여부.
- 후보별 거리/회귀 오차·중복 도로 비율·목적별 경사/조명/중단/녹지 지표.
- QGIS에서 용산구 망과 추천 경로를 겹쳐 본 화면, 현장 확인 여부.
- 자료 취득일·관측일·라이선스·재배포 범위.

먼저 **고정 출발점 하나 + 5km + PACE 후보 2~3개**를 보내 주시면 화면 연결부터 확인할 수 있습니다. 이후 거리·목적·출발점 범위를 늘리는 순서로 제안합니다.
