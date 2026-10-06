import { z } from "zod";

export const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export type Position = z.infer<typeof positionSchema>;
export const purposeSchema = z.enum(["PACE", "POWER", "NIGHT", "GREEN"]);
export type Purpose = z.infer<typeof purposeSchema>;
const requestBase = {
  schema_version: z.literal("1.0"),
  start: positionSchema,
  purpose: purposeSchema,
  time_of_day: z.enum(["day", "night"]),
  distance_tolerance_ratio: z.number().min(0).max(0.3),
};
export const recommendationRequestSchema = z.discriminatedUnion("route_type", [
  z.object({
    ...requestBase,
    route_type: z.literal("loop"),
    target_distance_m: z.number().int().min(1000).max(20000),
  }),
  z
    .object({
      ...requestBase,
      route_type: z.literal("straight"),
      end: positionSchema,
      target_distance_m: z.null(),
    })
    .refine((request) => haversine(request.start, request.end) >= 50, {
      path: ["end"],
      message: "출발지와 목적지는 50m 이상 떨어져 있어야 합니다.",
    }),
]);
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
export const courseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    subtitle: z.string(),
    purpose: purposeSchema,
    region: z.string(),
    start_label: z.string(),
    route_type: z.enum(["loop", "straight"]).default("loop"),
    end: positionSchema.optional(),
    end_label: z.string().min(1).optional(),
    geometry: z.object({
      type: z.literal("LineString"),
      coordinates: z.array(positionSchema).min(4),
    }),
    summary: z.object({
      distance_m: z.number().positive(),
      estimated_duration_s: z.number().positive(),
      elevation_gain_m: z.number().nonnegative().nullable(),
      avg_slope_pct: z.number().nonnegative().nullable(),
      signal_count: z.number().int().nonnegative().nullable(),
      crossing_count: z.number().int().nonnegative().nullable(),
      light_count: z.number().int().nonnegative().nullable(),
      green_ratio: z.number().min(0).max(1).nullable(),
      environment_score: z.number().min(0).max(100).nullable(),
    }),
    reasons: z.array(
      z.object({
        code: z.enum([
          "flat",
          "hill",
          "lighting",
          "green",
          "signals",
          "loop",
          "destination",
        ]),
        title: z.string(),
        description: z.string(),
      }),
    ),
    segments: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          distance_from_start_m: z.number().nonnegative(),
        }),
      )
      .min(2),
    edge_ids: z.array(z.string()),
    data_version: z.string(),
    algorithm_version: z.string(),
    is_mock: z.boolean(),
  })
  .superRefine((course, ctx) => {
    const start = course.geometry.coordinates[0]!;
    const end = course.geometry.coordinates.at(-1)!;
    if (course.route_type === "loop" && haversine(start, end) > 20)
      ctx.addIssue({
        code: "custom",
        path: ["geometry"],
        message: "회귀 코스의 시작과 끝은 20m 이내여야 합니다.",
      });
    if (
      course.route_type === "straight" &&
      (!course.end ||
        !course.end_label ||
        haversine(start, end) < 50 ||
        (course.end && haversine(end, course.end) > 20))
    )
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message:
          "Straight 코스는 출발지와 다른 목적지·이름이 필요하며 경로 끝점은 목적지 20m 이내여야 합니다.",
      });
    let previous = -1;
    for (const segment of course.segments) {
      if (
        segment.distance_from_start_m < previous ||
        segment.distance_from_start_m > course.summary.distance_m
      )
        ctx.addIssue({
          code: "custom",
          path: ["segments"],
          message: "구간 누적 거리는 오름차순이며 총 거리 이하여야 합니다.",
        });
      previous = segment.distance_from_start_m;
    }
    if (
      Math.abs(
        lineDistance(course.geometry.coordinates) - course.summary.distance_m,
      ) /
        course.summary.distance_m >
      0.15
    )
      ctx.addIssue({
        code: "custom",
        path: ["summary", "distance_m"],
        message: "지오메트리 길이와 표시 거리의 차이가 15%를 넘습니다.",
      });
  });
export type Course = z.infer<typeof courseSchema>;
export const recommendationResponseSchema = z.object({
  schema_version: z.literal("1.0"),
  request_id: z.string(),
  courses: z.array(courseSchema).max(3),
});
export type RecommendationResponse = z.infer<
  typeof recommendationResponseSchema
>;

export function parseRecommendations(
  value: unknown,
  request: RecommendationRequest,
): RecommendationResponse {
  const response = recommendationResponseSchema.parse(value);
  for (const course of response.courses) {
    if (
      course.route_type !== request.route_type ||
      haversine(course.geometry.coordinates[0]!, request.start) > 50
    )
      throw new Error("요청한 러닝 방식 또는 출발지와 다른 코스가 도착했어요.");
    if (
      request.route_type === "straight" &&
      haversine(course.geometry.coordinates.at(-1)!, request.end) > 50
    )
      throw new Error("요청한 목적지와 다른 코스가 도착했어요.");
  }
  return response;
}

export const edgePropertiesSchema = z.object({
  edge_id: z.string().min(1),
  from_node: z.string().min(1),
  to_node: z.string().min(1),
  length_m: z.number().positive(),
  walkable: z.boolean(),
  bidirectional: z.boolean(),
  slope_pct: z.number().nonnegative().nullable(),
  elevation_gain_forward_m: z.number().nonnegative().nullable(),
  elevation_gain_reverse_m: z.number().nonnegative().nullable(),
  signal_cnt: z.number().int().nonnegative().nullable(),
  cross_cnt: z.number().int().nonnegative().nullable(),
  light_cnt: z.number().int().nonnegative().nullable(),
  park_dist_m: z.number().nonnegative().nullable(),
  green_ratio: z.number().min(0).max(1).nullable(),
  data_version: z.string().min(1),
});
export const roadNetworkSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z
      .array(
        z.object({
          type: z.literal("Feature"),
          geometry: z.object({
            type: z.literal("LineString"),
            coordinates: z.array(positionSchema).min(2),
          }),
          properties: edgePropertiesSchema,
        }),
      )
      .min(1),
  })
  .superRefine((network, ctx) => {
    const ids = new Set<string>();
    const nodes = new Map<string, Position>();
    network.features.forEach((feature, index) => {
      const props = feature.properties;
      if (ids.has(props.edge_id))
        ctx.addIssue({
          code: "custom",
          path: ["features", index],
          message: `중복 edge_id: ${props.edge_id}`,
        });
      ids.add(props.edge_id);
      if (
        Math.abs(lineDistance(feature.geometry.coordinates) - props.length_m) /
          props.length_m >
        0.15
      )
        ctx.addIssue({
          code: "custom",
          path: ["features", index],
          message: "도로 길이와 geometry 길이가 불일치합니다.",
        });
      for (const [node, point] of [
        [props.from_node, feature.geometry.coordinates[0]!],
        [props.to_node, feature.geometry.coordinates.at(-1)!],
      ] as const) {
        const previous = nodes.get(node);
        if (previous && haversine(previous, point) > 2)
          ctx.addIssue({
            code: "custom",
            path: ["features", index],
            message: `동일 node의 좌표 불일치: ${node}`,
          });
        nodes.set(node, point);
      }
    });
  });

export function haversine(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function lineDistance(points: Position[]): number {
  return points
    .slice(1)
    .reduce((sum, point, index) => sum + haversine(points[index]!, point), 0);
}
