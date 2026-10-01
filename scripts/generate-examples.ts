import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import {
  lineDistance,
  recommendationRequestSchema,
  recommendationResponseSchema,
  roadNetworkSchema,
  type Position,
} from "../src/domain/contracts";
import { makeMockCourse } from "../src/data/mock";
const dir = "examples/data";
mkdirSync(dir, { recursive: true });
const write = (name: string, value: unknown) =>
  writeFileSync(`${dir}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
const request = recommendationRequestSchema.parse({
  schema_version: "1.0",
  start: [126.9745, 37.5178],
  target_distance_m: 5000,
  purpose: "PACE",
  time_of_day: "day",
  route_type: "loop",
  distance_tolerance_ratio: 0.1,
});
const response = recommendationResponseSchema.parse({
  schema_version: "1.0",
  request_id: "example-request",
  courses: ["PACE", "GREEN", "NIGHT"].map((purpose, i) =>
    makeMockCourse(request, purpose as "PACE" | "GREEN" | "NIGHT", i),
  ),
});
const nodes: Position[] = [
  [126.9745, 37.5178],
  [126.977, 37.5184],
  [126.9775, 37.5202],
  [126.9745, 37.5178],
];
const roads = roadNetworkSchema.parse({
  type: "FeatureCollection",
  features: nodes
    .slice(0, -1)
    .map((point, i) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [point, nodes[i + 1]] },
      properties: {
        edge_id: `ys-demo-${i + 1}`,
        from_node: `n${i}`,
        to_node: `n${(i + 1) % 3}`,
        length_m: Math.round(lineDistance([point, nodes[i + 1]!])),
        walkable: true,
        bidirectional: true,
        slope_pct: [0.8, 1.6, 2.1][i],
        elevation_gain_forward_m: i * 2,
        elevation_gain_reverse_m: i,
        signal_cnt: i === 1 ? 1 : 0,
        cross_cnt: i === 1 ? 1 : 0,
        light_cnt: i === 2 ? null : 4 + i,
        park_dist_m: 35 + i * 20,
        green_ratio: 0.65,
        data_version: "example-only-v1",
      },
    })),
});
write("request.json", request);
write("recommendations.json", response);
write("roads.geojson", roads);
write("manifest.json", {
  schema_version: "1.0",
  data_version: "example-only-v1",
  region: "서울 용산구",
  geometry_crs: "EPSG:4326",
  analysis_crs: "EPSG:5186",
  network_version: "example-base-v1",
  edge_count: roads.features.length,
  is_mock: true,
  created_at: "2026-10-01T12:00:00Z",
  contributors: ["DALRO 예시"],
  sources: [
    {
      layer: "roads",
      source: "synthetic-example",
      license: "예시 데이터",
      observed_at: null,
    },
  ],
  processing: {
    signal_buffer_m: 15,
    light_buffer_m: 20,
    green_buffer_m: 30,
    dem_resolution_m: null,
    notes:
      "모든 수치와 geometry는 규격 설명용 예시. 실제 용산구 도로 자료가 아닙니다.",
  },
});
mkdirSync("docs/contracts", { recursive: true });
for (const [name, schema] of [
  ["recommendation-request", recommendationRequestSchema],
  ["recommendation-response", recommendationResponseSchema],
  ["road-network", roadNetworkSchema],
] as const)
  writeFileSync(
    `docs/contracts/${name}.schema.json`,
    `${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`,
  );
console.log("예시 자료와 JSON Schema 생성 완료");
