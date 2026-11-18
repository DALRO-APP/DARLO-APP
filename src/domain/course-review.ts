import review from "../../server/seed/yongsan-quality-review.json";
import type { Course } from "./contracts";

// 서버와 같은 공개 검토표를 사용한다. 원본 DB나 비밀값은 앱에 포함하지 않는다.
export function courseReviewIssue(course: Course): string | null {
  if (
    course.is_mock ||
    ![review.base_network_version, review.effective_network_version].includes(
      course.data_version,
    )
  )
    return null;
  const blocked = new Set(review.blocked_edges.map((edge) => edge.edge_id));
  if (course.edge_ids.some((id) => blocked.has(id)))
    return "보행 불가로 검토된 구간이 포함된 이전 코스예요. 서버 업데이트 후 다시 추천받아 주세요.";
  const affected = new Set(
    review.missing_slope_features.map((feature) => String(feature.source_fid)),
  );
  if (
    course.data_version === review.base_network_version &&
    course.edge_ids.some((id) => affected.has(id.split("-")[0]!))
  )
    return "경사 미측정 구간의 패널티가 보정된 코스예요. 서버 업데이트 후 다시 추천받아 주세요.";
  return null;
}
