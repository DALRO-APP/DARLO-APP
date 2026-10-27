# DALRO API — 용산구 실데이터 PACE 추천

FastAPI · SQLAlchemy 2 · SQLite. 노션 '데이터 저장소'의 팀 전처리 자료로 PACE 목적의 Loop/Straight 코스를 추천한다. 앱 계약은 [src/domain/contracts.ts](../src/domain/contracts.ts)와 [docs/TEAM-DATA-HANDOFF.md](../docs/TEAM-DATA-HANDOFF.md)를 따른다. POWER·NIGHT·GREEN은 아직 구현하지 않았고 `501`을 반환한다.

## 준비

```sh
cd server
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

노션 첨부를 아래 이름으로 `server/data/raw/`에 받는다. 원본과 DB는 git에 올리지 않는다.

| 노션 첨부                        | 저장 이름                            | 쓰는 내용                                  |
| -------------------------------- | ------------------------------------ | ------------------------------------------ |
| 검증된\_용산구\_도로망.zip       | `verified_yongsan_roads.zip`         | 도로 4,426개 · 경사 · 신호/횡단보도 수     |
| 종설\_기본망신호.zip (338MB)     | `base_network_signal.zip`            | A057_L 부착대 · A004_A 횡단보도 원본 위치  |
| 가로등공원\_데이터\_전처리.zip   | `streetlight_park_preprocessing.zip` | 용산구 가로등 1,511개                      |
| cost.zip (선택)                  | `cost.zip`                           | 팀 `stop_norm`과 대조                      |

```sh
.venv/bin/python -m dalro_api.importer --raw data/raw   # data/dalro.sqlite3 생성
.venv/bin/uvicorn dalro_api.main:app --reload            # http://localhost:8000/docs
.venv/bin/python -m pytest                               # 합성 격자 테스트(원본 불필요)
```

휴대폰 Expo Go에서 접속하려면 `--host 0.0.0.0`으로 띄우고 앱 `.env.local`에 `EXPO_PUBLIC_API_URL=http://<맥 IP>:8000`을 지정한다.

## API

| 요청                               | 응답                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| `POST /v1/courses/recommendations` | 0~3개 코스. 조건 오류·출발지 50m 밖 `422`, PACE 외 목적 `501`        |
| `GET /v1/courses/{id}`             | 추천했던 같은 Course. 서버 재시작 후에도 SQLite에서 조회. 없으면 `404` |
| `GET /health`                      | 도로망 버전·구간 수·용산구 평균 지표                                 |

## 처리 방식

**임포트** (`importer.py`)

- 검증된 GeoPackage(EPSG:5186)의 OSM 선형을 공유 꼭짓점에서 나눠 탐색 구간 9,276개, 노드 6,906개를 만든다. 꼭짓점을 공유하지 않는 고가·지하 도로는 연결하지 않는다.
- `edge_id`는 `{팀 fid}-{순번}`으로, 같은 원본에서 다시 임포트해도 같다. `data_version`은 GeoPackage 해시(`yongsan-verified-xxxxxxxx`)다.
- 좌표는 EPSG:4326 `[경도, 위도]`로 변환한다. 노드 좌표와 구간 끝점은 정확히 같게 맞춘다.
- `slope_mean`의 단위는 도(°)다. `경사.tif`를 DEM으로 다시 계산해 확인했다(중앙 오차 0.000005°). 앱에는 `tan(°)×100`으로 바꾼 %를 보낸다. 도로 구역의 **지형** 경사 평균이라 산비탈 도로에서는 노면 경사보다 크게 나온다.
- 신호 부착대·횡단보도·가로등 원본 위치를 함께 저장한다. 구간과 코스의 시설 수는 팀과 같은 10m 버퍼로 다시 센다. 코스 단위로는 교차로 시설을 한 번만 센다.
- 버스 전용 도로는 통행 불가로 둔다. 용산 미군기지 내부로 추정되는 도로 646개(약 1.3km², OSM 영문 도로명 구간의 concave hull)는 출입 제한으로 `walkable=false` 처리한다. SHP 변환에서 OSM access 태그가 빠져 생긴 문제를 막는 휴리스틱이다.

**PACE 비용** (`pace.py`, 노션 '중간 발표 전 결과물' 김시원)

```text
stop_norm = minmax(min((signal_cnt + cross_cnt) / length_m, 0.275))
C(e) = length_m · [1 + 3 · (0.83·stop_norm + 0.17·slope_norm)]
```

팀 cost.zip의 `stop_norm` 4,426개와 최대 0.0023 차이로 일치한다(팀 dbf의 소수 셋째 자리 반올림 수준). 첫 행의 `cost_a3`도 일치한다. PACE에서는 계단을 제외한다. 경사가 미측정이면 평지로 보지 않고 최대값을 적용한다.

**경로** (`routing.py`)

- 출발지·목적지를 50m 안의 가장 가까운 도로 위 점에 붙인다. 구간 중간이면 임시 노드를 만든다.
- Loop: 방위 12개마다 S→A→B→S 삼각 경유로를 PACE 비용 A\*로 잇는다. 앞에서 지난 도로는 비용을 4배로 올려 다른 길로 돌아오게 한다. 반경은 실제 길이에 맞춰 최대 4번 보정한다. 거리 오차가 허용 범위 안이고 반복 구간이 30% 이하인 후보 중에서 고른다. 정렬 기준은 `길이당 C(e) + 반복 비율 + 0.5·거리 오차`이고, 도로 공유 50% 이하로 서로 다른 후보 3개까지 반환한다.
- Straight: PACE 최소 비용 경로와, 앞 경로 도로 비용을 올린 대안 경로(최단 대비 1.5배 이내)를 반환한다.
- 용산구 실데이터에서 요청 하나는 0.06~0.3초 걸린다.

**응답** (`courses.py`)

| 항목 | 내용 |
| --- | --- |
| `environment_score` | `100 × (1 − 길이 가중 평균 페널티)`. 팀 PACE 페널티를 읽은 값이며 안전 점수가 아니다. |
| `reasons` | 용산구 도로망 평균과 비교한 km당 멈춤 요인·지형 경사를 담는다. 야간에는 가로등 수를 더한다. |
| 미산출 값 | 고도 상승량, 녹지 비율(`park_cnt`는 개수라 비율이 아님)은 `null`이다. |
| 예상 시간 | 6′12″/km 가정이다. |

## 계약 검사

```sh
.venv/bin/python -m dalro_api.export data/export
cd .. && node --import tsx scripts/validate-data.ts server/data/export
# PASS · 도로 9276개, 추천 6개
```

## 한계

- 추천 가중치 0.83/0.17, α=3, 상한 0.275는 팀 실험값이다. 상한이 m당 0.275곳이라 페널티가 대부분 작고, 환경 점수가 89~98에 몰린다. 신호 하나가 약 9m 우회 비용에 해당해서, 큰길 회피 효과도 약하다.
- 가로등은 서울시 관리분(2023-12-22)만 있다. CCTV·생활인구·교통량은 아직 결합하지 않았다.
- 기지 내부 판정은 휴리스틱이다. 실제 현장 출입 가능 여부, 공사 중 구간, 보도 유무는 검증하지 않았다.
