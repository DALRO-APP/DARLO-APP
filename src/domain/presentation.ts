import type { Course } from "./contracts";

// 코스 환경 설명이며 주행 분석 또는 안전 판정이 아닙니다.
export function courseExplanation(course: Course): string {
  switch (course.purpose) {
    case "PACE":
      return "경사가 완만하고 신호가 적어 리듬을 유지하기 좋아요.";
    case "POWER":
      return "오르막 구간을 포함해 운동 강도를 높이는 코스예요.";
    case "NIGHT":
      return "조명 정보가 많은 구간을 중심으로 구성한 코스예요.";
    case "GREEN":
      return course.summary.green_ratio === null
        ? "공원과 녹지 주변을 달리는 코스예요."
        : `코스의 ${Math.round(course.summary.green_ratio * 100)}%가 녹지 인접 구간이에요.`;
  }
}

export function parseDistanceKm(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(value)) return null;
  const metres = Math.round(Number(value) * 1000);
  return metres >= 1000 && metres <= 20000 ? metres : null;
}
