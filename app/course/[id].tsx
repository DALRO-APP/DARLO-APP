import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Share, View } from "react-native";
import { RouteMap } from "../../src/components/RouteMap";
import {
  Button,
  Icon,
  Panel,
  Screen,
  SectionTitle,
  Status,
  T,
  useWide,
} from "../../src/components/ui";
import { PURPOSES } from "../../src/domain/catalog";
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
  const activeSession = useRunning((s) => s.session);
  const course = query.data;
  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={{ padding: 8 }}
        >
          <Icon name="arrow-back" />
        </Pressable>
        <T style={{ flex: 1, fontSize: 18, fontWeight: "800" }}>
          추천 코스 상세
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "코스 저장 해제" : "코스 저장"}
          onPress={() => toggle(id)}
          style={{ padding: 7 }}
        >
          <Icon
            name={favorite ? "heart" : "heart-outline"}
            color={favorite ? colors.lime : colors.text}
          />
        </Pressable>
        {course && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="코스 공유"
            onPress={() =>
              void Share.share({
                message: `DALRO · ${course.name}\n${(course.summary.distance_m / 1000).toFixed(1)}km · ${course.region}\n시연용 예시 코스입니다.`,
              }).catch(() => {})
            }
            style={{ padding: 7 }}
          >
            <Icon name="share-outline" />
          </Pressable>
        )}
      </View>
      {query.isPending ? (
        <ActivityIndicator color={colors.lime} />
      ) : query.isError ? (
        <Status
          title="코스를 찾을 수 없어요"
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        course && (
          <>
            <View style={{ flexDirection: wide ? "row" : "column", gap: 26 }}>
              <View style={{ flex: wide ? 1.5 : undefined }}>
                <RouteMap
                  courses={[course]}
                  selectedId={course.id}
                  height={wide ? 400 : 290}
                />
                <T muted style={{ fontSize: 10, marginTop: 10 }}>
                  시연 지도 · 실제 도로 탐색 결과가 아닙니다.
                </T>
              </View>
              <View
                style={{
                  flex: wide ? 1 : undefined,
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                <T
                  style={{
                    fontSize: 11,
                    letterSpacing: 1,
                    color: PURPOSES[course.purpose].color,
                  }}
                >
                  {PURPOSES[course.purpose].short} /{" "}
                  {PURPOSES[course.purpose].label}
                </T>
                <T
                  style={{
                    fontSize: wide ? 36 : 30,
                    fontWeight: "900",
                    letterSpacing: -1,
                  }}
                >
                  {course.name}
                </T>
                <T muted style={{ lineHeight: 23 }}>
                  {course.subtitle}
                  {"\n"}출발지로 다시 돌아오는 나만의 루프 코스예요.
                </T>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 20,
                    flexWrap: "wrap",
                    marginVertical: 6,
                  }}
                >
                  {[
                    {
                      value: `${(course.summary.distance_m / 1000).toFixed(1)}km`,
                      label: "거리",
                    },
                    {
                      value: `${Math.round(course.summary.estimated_duration_s / 60)}분`,
                      label: "예상 시간",
                    },
                    {
                      value:
                        course.summary.elevation_gain_m === null
                          ? "—"
                          : `+${course.summary.elevation_gain_m}m`,
                      label: "누적 고도",
                    },
                  ].map((metric) => (
                    <View key={metric.label} style={{ gap: 5 }}>
                      <T accent style={{ fontSize: 25, fontWeight: "800" }}>
                        {metric.value}
                      </T>
                      <T muted style={{ fontSize: 11 }}>
                        {metric.label}
                      </T>
                    </View>
                  ))}
                </View>
                <Button
                  label={
                    activeSession
                      ? "진행 중인 시연 이어가기"
                      : "이 코스로 달리기"
                  }
                  icon="fitness-outline"
                  onPress={() => {
                    if (!activeSession) begin(course);
                    router.push("/run");
                  }}
                />
                <T muted style={{ fontSize: 10 }}>
                  GPS 대신 모의 주행으로 앱 흐름을 시연합니다.
                </T>
              </View>
            </View>
            <View>
              <SectionTitle
                title="이런 이유로 추천해요"
                caption="도로 환경을 읽고, 목적에 맞춰 추천해요"
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {course.reasons.map((reason) => (
                  <Panel
                    key={reason.code}
                    style={{
                      width: wide ? "23.5%" : "48%",
                      padding: 17,
                      gap: 11,
                    }}
                  >
                    <Icon
                      name={
                        reason.code === "flat"
                          ? "leaf-outline"
                          : reason.code === "hill"
                            ? "trending-up"
                            : reason.code === "lighting"
                              ? "bulb-outline"
                              : reason.code === "green"
                                ? "flower-outline"
                                : reason.code === "loop"
                                  ? "sync-outline"
                                  : "options-outline"
                      }
                      color={colors.lime}
                      size={26}
                    />
                    <T style={{ fontSize: 14, fontWeight: "800" }}>
                      {reason.title}
                    </T>
                    <T muted style={{ fontSize: 11, lineHeight: 18 }}>
                      {reason.description}
                    </T>
                  </Panel>
                ))}
              </View>
            </View>
            <Panel style={{ padding: 22, gap: 12 }}>
              <SectionTitle title="코스 환경 한눈에" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
                {[
                  {
                    label: "평균 경사도",
                    value:
                      course.summary.avg_slope_pct === null
                        ? "미확인"
                        : `${course.summary.avg_slope_pct}%`,
                  },
                  {
                    label: "신호 시설",
                    value:
                      course.summary.signal_count === null
                        ? "미확인"
                        : `${course.summary.signal_count}개`,
                  },
                  {
                    label: "횡단보도",
                    value:
                      course.summary.crossing_count === null
                        ? "미확인"
                        : `${course.summary.crossing_count}개`,
                  },
                  {
                    label: "가로등",
                    value:
                      course.summary.light_count === null
                        ? "미확인"
                        : `${course.summary.light_count}개`,
                  },
                  {
                    label: "녹지 비율",
                    value:
                      course.summary.green_ratio === null
                        ? "미확인"
                        : `${Math.round(course.summary.green_ratio * 100)}%`,
                  },
                ].map((m) => (
                  <View key={m.label} style={{ gap: 7 }}>
                    <T muted style={{ fontSize: 11 }}>
                      {m.label}
                    </T>
                    <T style={{ fontWeight: "700", fontSize: 19 }}>{m.value}</T>
                  </View>
                ))}
              </View>
              <T muted style={{ fontSize: 10, lineHeight: 18, marginTop: 8 }}>
                현재 수치는 가상 예시입니다. 조명과 환경 지표는 실제 안전을
                보장하는 점수가 아닙니다.
              </T>
            </Panel>
            <Panel style={{ padding: 22 }}>
              <SectionTitle
                title="코스 구성"
                caption={`전체 ${(course.summary.distance_m / 1000).toFixed(1)}km · 출발지 회귀`}
              />
              {course.segments.map((segment, index) => (
                <View
                  key={segment.id}
                  style={{
                    flexDirection: "row",
                    gap: 14,
                    paddingVertical: 15,
                    borderBottomWidth:
                      index < course.segments.length - 1 ? 1 : 0,
                    borderColor: colors.line,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      height: 28,
                      width: 28,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#304326",
                    }}
                  >
                    <T accent style={{ fontSize: 12, fontWeight: "800" }}>
                      {index === 0
                        ? "S"
                        : index === course.segments.length - 1
                          ? "F"
                          : index}
                    </T>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <T style={{ fontWeight: "700", fontSize: 14 }}>
                      {segment.name}
                    </T>
                    <T muted style={{ fontSize: 11 }}>
                      {segment.description}
                    </T>
                  </View>
                  <T muted style={{ fontSize: 12 }}>
                    {(segment.distance_from_start_m / 1000).toFixed(1)}km
                  </T>
                </View>
              ))}
            </Panel>
          </>
        )
      )}
    </Screen>
  );
}
