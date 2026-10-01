import type { Position, Purpose } from "./contracts";

export const PURPOSES: Record<
  Purpose,
  {
    label: string;
    short: string;
    description: string;
    icon:
      | "timer-outline"
      | "trending-up"
      | "shield-checkmark-outline"
      | "leaf-outline";
    color: string;
  }
> = {
  PACE: {
    label: "페이스 유지",
    short: "PACE",
    description: "평탄한 길에서 나만의 리듬으로",
    icon: "timer-outline",
    color: "#AAFF5A",
  },
  POWER: {
    label: "체력 강화",
    short: "POWER",
    description: "오르막을 넘어 한 단계 더",
    icon: "trending-up",
    color: "#FFBE7D",
  },
  NIGHT: {
    label: "야간 러닝",
    short: "NIGHT",
    description: "밝은 길을 따라 저녁에도 편안하게",
    icon: "shield-checkmark-outline",
    color: "#B7ADFF",
  },
  GREEN: {
    label: "쾌적 러닝",
    short: "GREEN",
    description: "녹음과 강바람 사이, 기분 좋은 달리기",
    icon: "leaf-outline",
    color: "#7EE5C3",
  },
};
export const STARTS: {
  id: string;
  label: string;
  detail: string;
  coordinate: Position;
}[] = [
  {
    id: "ichon",
    label: "이촌 한강공원",
    detail: "용산구 · 한강 산책로 입구",
    coordinate: [126.9745, 37.5178],
  },
  {
    id: "namsan",
    label: "남산 둘레길",
    detail: "용산구 · 국립극장 방면",
    coordinate: [126.995, 37.546],
  },
  {
    id: "yongsan",
    label: "용산가족공원",
    detail: "용산구 · 공원 정문",
    coordinate: [126.9845, 37.5223],
  },
];
export const formatDistance = (m: number) => (m / 1000).toFixed(2);
export const formatDuration = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
export const formatPace = (seconds: number, distanceM: number) =>
  distanceM > 0
    ? `${Math.floor(seconds / (distanceM / 1000) / 60)}′${Math.floor(
        (seconds / (distanceM / 1000)) % 60,
      )
        .toString()
        .padStart(2, "0")}″`
    : "—";
