import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { RouteMap } from "../src/components/RouteMap";
import { DemoNote, FlowHeader } from "../src/components/Flow";
import { Button, Chip, Screen, Status, T, useWide } from "../src/components/ui";
import { useRecommendations } from "../src/services/queries";
import { usePreferences } from "../src/state/preferences";
import { courseExplanation } from "../src/domain/presentation";
import { colors } from "../src/theme/tokens";

export default function Recommendations() {
  const query = useRecommendations();
  const request = usePreferences((s) => s.request);
  const wide = useWide();
  const [selectedId, setSelectedId] = useState<string>();
  const [width, setWidth] = useState(0);
  const carousel = useRef<ScrollView>(null);
  const courses = query.data?.courses ?? [];
  const selected = courses.find((c) => c.id === selectedId) ?? courses[0];
  const select = (id: string) => {
    setSelectedId(id);
    carousel.current?.scrollTo({
      x: courses.findIndex((c) => c.id === id) * width,
      // 번호/지도 선택은 즉시 맞춘다. 스크롤 애니메이션 도중의 이전
      // 카드 이벤트가 선택을 되돌려 다른 코스로 시작하는 것을 막는다.
      animated: false,
    });
  };
  const onScrolled = (x: number) => {
    const course =
      courses[Math.max(0, Math.min(courses.length - 1, Math.round(x / width)))];
    if (course) setSelectedId(course.id);
  };
  return (
    <Screen>
      <FlowHeader title="추천 코스" step="03 / 04" back="/explore" />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 6 }}>
          <T style={{ fontSize: 25, fontWeight: "800", letterSpacing: -0.8 }}>
            오늘의 {request.purpose} 코스
          </T>
          <T muted style={{ fontSize: 12 }}>
            {request.target_distance_m === null
              ? "거리 자동"
              : `${request.target_distance_m / 1000}km`}{" "}
            · {request.time_of_day === "night" ? "야간" : "주간"} ·{" "}
            {request.route_type === "straight"
              ? "목적지까지 달리기"
              : "출발지로 돌아오기"}
          </T>
        </View>
        <Chip label="조건 변경" onPress={() => router.replace("/explore")} />
      </View>
      {query.isPending ? (
        <View
          style={{
            minHeight: 360,
            gap: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator color={colors.lime} />
          <T muted>목적에 맞는 코스를 찾고 있어요</T>
        </View>
      ) : query.isError ? (
        <Status
          title="코스를 불러오지 못했어요"
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : !selected ? (
        <>
          <Status
            title="조건에 맞는 코스가 없어요"
            message="출발지나 목표 거리를 바꿔 주세요."
          />
          <Button
            label="조건 다시 설정하기"
            onPress={() => router.replace("/explore")}
          />
        </>
      ) : (
        <View style={{ gap: 16 }}>
          <RouteMap
            courses={courses}
            selectedId={selected.id}
            onSelect={select}
            height={wide ? 410 : 300}
          />
          <View
            style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}
          >
            {courses.map((course, index) => (
              <Chip
                key={course.id}
                label={`추천 ${index + 1}`}
                selected={selected.id === course.id}
                onPress={() => select(course.id)}
              />
            ))}
          </View>
          <View
            onLayout={(event) => {
              const nextWidth = event.nativeEvent.layout.width;
              setWidth(nextWidth);
              carousel.current?.scrollTo({
                x: courses.findIndex((c) => c.id === selected.id) * nextWidth,
                animated: false,
              });
            }}
          >
            <ScrollView
              ref={carousel}
              testID="course-carousel"
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) =>
                onScrolled(event.nativeEvent.contentOffset.x)
              }
              onScroll={
                Platform.OS === "web"
                  ? (event) => onScrolled(event.nativeEvent.contentOffset.x)
                  : undefined
              }
              scrollEventThrottle={32}
            >
              {courses.map((course, index) => (
                <View
                  key={course.id}
                  style={{
                    width: width || 1,
                    padding: 20,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.panel,
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <T style={{ fontWeight: "800", fontSize: 22 }}>
                      추천 {index + 1} ·{" "}
                      {(course.summary.distance_m / 1000).toFixed(1)}km
                    </T>
                    <T
                      accent
                      style={{
                        fontWeight: "700",
                        fontSize: 12,
                        alignSelf: "center",
                      }}
                    >
                      {course.purpose}
                    </T>
                  </View>
                  <T style={{ fontSize: 15, fontWeight: "600" }}>
                    {course.name}
                  </T>
                  <T muted style={{ fontSize: 12 }}>
                    약 {Math.round(course.summary.estimated_duration_s / 60)}분
                    ·{" "}
                    {course.summary.avg_slope_pct === null
                      ? "경사 미확인"
                      : `평균 경사 ${course.summary.avg_slope_pct}%`}{" "}
                    ·{" "}
                    {course.summary.signal_count === null
                      ? "신호 미확인"
                      : `신호 ${course.summary.signal_count}개`}
                  </T>
                  <T accent style={{ fontSize: 14, fontWeight: "700" }}>
                    {course.purpose} 환경 점수{" "}
                    {course.summary.environment_score ?? "미확인"}
                  </T>
                  <T muted style={{ fontSize: 13, lineHeight: 21 }}>
                    {courseExplanation(course)}
                  </T>
                </View>
              ))}
            </ScrollView>
          </View>
          <Button
            label="이 코스로 달리기"
            icon="play"
            onPress={() =>
              router.push({
                pathname: "/course/[id]",
                params: { id: selected.id },
              })
            }
          />
          <DemoNote />
        </View>
      )}
    </Screen>
  );
}
