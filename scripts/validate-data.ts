import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  haversine,
  recommendationRequestSchema,
  parseRecommendations,
  roadNetworkSchema,
} from "../src/domain/contracts";
const dir = resolve(process.argv[2] ?? "examples/data");
const read = (file: string) =>
  JSON.parse(readFileSync(resolve(dir, file), "utf8"));
try {
  const manifest = z
    .object({
      schema_version: z.literal("1.0"),
      data_version: z.string(),
      geometry_crs: z.literal("EPSG:4326"),
      network_version: z.string(),
      edge_count: z.number().int().nonnegative(),
      is_mock: z.boolean(),
      sources: z
        .array(
          z.object({
            layer: z.string(),
            source: z.string(),
            license: z.string(),
          }),
        )
        .min(1),
    })
    .parse(read("manifest.json"));
  const network = roadNetworkSchema.parse(read("roads.geojson"));
  if (manifest.edge_count !== network.features.length)
    throw new Error("manifest.edge_count가 실제 행 수와 다릅니다.");
  if (
    network.features.some(
      (f) => f.properties.data_version !== manifest.data_version,
    )
  )
    throw new Error("도로 data_version이 manifest와 다릅니다.");
  const pairs = [["request.json", "recommendations.json"]];
  if (
    existsSync(resolve(dir, "request-straight.json")) ||
    existsSync(resolve(dir, "recommendations-straight.json"))
  )
    pairs.push(["request-straight.json", "recommendations-straight.json"]);
  let courseCount = 0;
  for (const [requestFile, responseFile] of pairs) {
    const request = recommendationRequestSchema.parse(read(requestFile!));
    const response = parseRecommendations(read(responseFile!), request);
    courseCount += response.courses.length;
    const ids = new Set<string>();
    const edgeIds = new Set(network.features.map((f) => f.properties.edge_id));
    for (const course of response.courses) {
      if (ids.has(course.id)) throw new Error(`중복 코스 ID: ${course.id}`);
      ids.add(course.id);
      if (haversine(request.start, course.geometry.coordinates[0]!) > 50)
        throw new Error(
          `${course.id}: 요청 출발지에서 50m 이상 떨어져 있습니다.`,
        );
      if (
        request.route_type === "loop" &&
        Math.abs(course.summary.distance_m - request.target_distance_m) >
          request.target_distance_m * request.distance_tolerance_ratio + 10
      )
        throw new Error(`${course.id}: 요청 거리 허용 범위를 벗어납니다.`);
      if (course.edge_ids.some((id) => !edgeIds.has(id)))
        throw new Error(`${course.id}: 존재하지 않는 도로 ID입니다.`);
      if (
        !course.is_mock &&
        (!course.edge_ids.length ||
          course.data_version !== manifest.data_version)
      )
        throw new Error(
          `${course.id}: 실제 코스에는 도로 ID와 일치하는 data_version이 필요합니다.`,
        );
    }
  }
  console.log(
    `PASS · 도로 ${network.features.length}개, 추천 ${courseCount}개 · 좌표/단위/ID/회귀/거리/메타데이터 검사`,
  );
} catch (error) {
  console.error(
    "데이터 검증 실패:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
