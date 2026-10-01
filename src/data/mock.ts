import {
  courseSchema,
  lineDistance,
  type Course,
  type Position,
  type Purpose,
  type RecommendationRequest,
} from "../domain/contracts";
import { STARTS } from "../domain/catalog";

const descriptions: Record<
  Purpose,
  {
    name: string;
    subtitle: string;
    gain: number;
    score: number;
    slope: number;
    signals: number;
    lights: number;
    green: number;
  }
> = {
  PACE: {
    name: "한강 리듬 코스",
    subtitle: "강바람과 함께, 끊김 없이 달려요.",
    gain: 12,
    score: 91,
    slope: 0.7,
    signals: 2,
    lights: 38,
    green: 0.53,
  },
  POWER: {
    name: "남산 챌린지 코스",
    subtitle: "조금 더 높이, 어제보다 단단하게.",
    gain: 108,
    score: 78,
    slope: 5.2,
    signals: 4,
    lights: 24,
    green: 0.69,
  },
  NIGHT: {
    name: "빛을 따라 달로",
    subtitle: "밝은 산책로를 따라 즐기는 저녁 러닝.",
    gain: 24,
    score: 94,
    slope: 1.2,
    signals: 3,
    lights: 62,
    green: 0.46,
  },
  GREEN: {
    name: "초록 쉼표 코스",
    subtitle: "나무 그늘과 한강 사이에서 숨을 고르세요.",
    gain: 28,
    score: 87,
    slope: 1.4,
    signals: 3,
    lights: 31,
    green: 0.88,
  },
};
const shapes: Record<Purpose, Position[]> = {
  PACE: [
    [0, 0],
    [0.4, 0.12],
    [1, 0.25],
    [1.7, 0.18],
    [2.1, 0.4],
    [2.35, 0.65],
    [2, 0.85],
    [1.4, 0.73],
    [0.8, 0.64],
    [0.3, 0.5],
    [-0.12, 0.23],
    [0, 0],
  ],
  POWER: [
    [0, 0],
    [0.18, 0.4],
    [0.52, 0.5],
    [0.45, 0.9],
    [0.82, 1.3],
    [1.15, 1.12],
    [1.5, 1.5],
    [1.82, 1.18],
    [1.6, 0.6],
    [1.2, 0.4],
    [0.7, 0.08],
    [0, 0],
  ],
  NIGHT: [
    [0, 0],
    [0.3, 0.1],
    [0.72, -0.1],
    [1.22, 0.05],
    [1.5, 0.4],
    [1.7, 0.9],
    [1.4, 1.15],
    [0.95, 1.25],
    [0.7, 0.9],
    [0.32, 0.8],
    [-0.15, 0.35],
    [0, 0],
  ],
  GREEN: [
    [0, 0],
    [-0.1, 0.35],
    [0.12, 0.75],
    [0.65, 0.95],
    [0.8, 1.38],
    [1.2, 1.3],
    [1.5, 0.92],
    [1.35, 0.4],
    [0.9, 0.55],
    [0.62, 0.3],
    [0.22, 0.2],
    [0, 0],
  ],
};

// 데모 모양을 목표 거리로 확대/축소합니다. 실제 도로 탐색 알고리즘이 아닙니다.
export function makeMockCourse(
  request: RecommendationRequest,
  purpose: Purpose,
  rank = 0,
): Course {
  const d = descriptions[purpose];
  const base = shapes[purpose];
  const deviation = Math.min(0.04, request.distance_tolerance_ratio);
  const target =
    request.target_distance_m *
    (rank === 1 ? 1 + deviation : rank === 2 ? 1 - deviation : 1);
  const toCoords = (scale: number): Position[] =>
    base.map(([x, y]) => [
      request.start[0] +
        (x * scale) / (111320 * Math.cos((request.start[1] * Math.PI) / 180)),
      request.start[1] + (y * scale) / 111320,
    ]);
  const coordinates = toCoords(target / lineDistance(toCoords(1)));
  const distance = Math.round(lineDistance(coordinates));
  const start = STARTS.find(
    (s) =>
      s.coordinate[0] === request.start[0] &&
      s.coordinate[1] === request.start[1],
  );
  const startLabel = start?.label ?? "선택한 출발지";
  return courseSchema.parse({
    id: `${purpose.toLowerCase()}-${start?.id ?? "custom"}-${request.target_distance_m}-${request.time_of_day}-${rank}`,
    name: d.name,
    subtitle: d.subtitle,
    purpose,
    region: "서울 용산구",
    start_label: startLabel,
    geometry: { type: "LineString", coordinates },
    summary: {
      distance_m: distance,
      estimated_duration_s: Math.round(
        (distance / 1000) * (purpose === "POWER" ? 420 : 372),
      ),
      elevation_gain_m: Math.round((d.gain * distance) / 5000),
      avg_slope_pct: d.slope,
      signal_count: d.signals,
      crossing_count: d.signals + 1,
      light_count: d.lights,
      green_ratio: d.green,
      environment_score: d.score,
    },
    reasons: [
      purpose === "POWER"
        ? {
            code: "hill",
            title: "적당한 오르막",
            description: "경사 구간으로 지구력을 길러요",
          }
        : {
            code: "flat",
            title: "평탄한 길 위주",
            description: "큰 오르막 없이 편안하게",
          },
      purpose === "GREEN"
        ? {
            code: "green",
            title: "풍부한 녹지",
            description: "공원과 강변을 곁에 두고 달려요",
          }
        : {
            code: "signals",
            title: "신호가 적은 길",
            description: "멈춤을 줄여 리듬을 이어가요",
          },
      {
        code: "loop",
        title: "출발지로 돌아오기",
        description: "달리기를 마치면 다시 제자리로",
      },
      {
        code: "lighting",
        title: "조명 정보 반영",
        description:
          request.time_of_day === "night"
            ? "야간 조건의 예시 코스예요"
            : "가로등 분포를 함께 살펴봐요",
      },
    ],
    segments: [
      {
        id: "start",
        name: startLabel,
        description: "가볍게 몸을 풀고 출발해요",
        distance_from_start_m: 0,
      },
      {
        id: "one",
        name: purpose === "POWER" ? "오르막 구간" : "강변 산책로",
        description: "나만의 속도로 리듬을 찾아요",
        distance_from_start_m: Math.round(distance * 0.25),
      },
      {
        id: "two",
        name: purpose === "GREEN" ? "초록 산책길" : "전망 쉼터",
        description: "호흡을 고르고 풍경을 즐겨요",
        distance_from_start_m: Math.round(distance * 0.55),
      },
      {
        id: "three",
        name: "돌아오는 길",
        description: "출발지를 향해 마지막 한 걸음",
        distance_from_start_m: Math.round(distance * 0.8),
      },
      {
        id: "finish",
        name: startLabel,
        description: "오늘의 달리기를 마쳤어요",
        distance_from_start_m: distance,
      },
    ],
    edge_ids: [],
    data_version: "yongsan-demo-2026-10-01",
    algorithm_version: "mock-preset-v1",
    is_mock: true,
  });
}
