import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { RouteMap } from "../../src/components/RouteMap";
import { DemoNote, FlowHeader, Metric } from "../../src/components/Flow";
import {
  Button,
  Icon,
  Screen,
  Status,
  T,
  useWide,
} from "../../src/components/ui";
import { courseExplanation } from "../../src/domain/presentation";
import { useCourse } from "../../src/services/queries";
import { usePreferences } from "../../src/state/preferences";
import { useRunning } from "../../src/state/running";
import { colors } from "../../src/theme/tokens";

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCourse(id ?? "");
  const wide = useWide();
  const favorite = usePreferences((s) => s.favorites.includes(id));
  const toggle = usePreferences((s) => s.toggleFavorite);
  const begin = useRunning((s) => s.begin);
  const session = useRunning((s) => s.session);
  const draft = useRunning((s) => s.draft);
  const course = query.data;
  return (
    <Screen>
      <FlowHeader title="러닝 준비" step="04 / 04" back="/recommendations" />
      {query.isPending ? (
        <ActivityIndicator color={colors.lime} />
      ) : query.isError || !course ? (
        <>
          <Status
            title="코스를 찾을 수 없어요"
            message={query.error?.message}
            onRetry={() => void query.refetch()}
          />
          <Button
            label="코스 다시 고르기"
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 7 }}>
              <T accent style={{ fontSize: 13 }}>
                {course.purpose} ·{" "}
                {(course.summary.distance_m / 1000).toFixed(1)}km
              </T>
              <T
                style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8 }}
              >
                {course.name}
              </T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={favorite ? "코스 저장 해제" : "코스 저장"}
              onPress={() => toggle(id)}
              style={{ padding: 12 }}
            >
              <Icon
                name={favorite ? "heart" : "heart-outline"}
                color={favorite ? colors.lime : colors.text}
              />
            </Pressable>
          </View>
          <RouteMap
            courses={[course]}
            selectedId={course.id}
            height={wide ? 440 : 340}
          />
          <View style={{ flexDirection: "row", gap: 20 }}>
            <Metric
              value={`${(course.summary.distance_m / 1000).toFixed(1)}km`}
              label="예상 거리"
            />
            <Metric
              value={`${Math.round(course.summary.estimated_duration_s / 60)}분`}
              label="예상 시간"
            />
          </View>
          <View style={{ gap: 8 }}>
            <T style={{ fontSize: 14 }}>
              {course.start_label} →{" "}
              {course.route_type === "straight" ? course.end_label : "출발지"}
            </T>
            <T muted style={{ fontSize: 12, lineHeight: 20 }}>
              {courseExplanation(course)}
            </T>
          </View>
          {draft && !session ? (
            <>
              <T muted style={{ fontSize: 12 }}>
                지난 러닝의 결과를 먼저 확인해 주세요.
              </T>
              <Button
                label="지난 러닝 결과 확인"
                onPress={() =>
                  router.push({ pathname: "/result", params: { id: draft.id } })
                }
              />
            </>
          ) : (
            <Button
              label={session ? "진행 중인 러닝 이어가기" : "러닝 시작"}
              icon="play"
              onPress={() => {
                if (!session) begin(course);
                router.push("/run");
              }}
            />
          )}
          <DemoNote running />
        </>
      )}
    </Screen>
  );
}
