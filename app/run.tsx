import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteMap } from "../src/components/RouteMap";
import { DemoNote, Metric } from "../src/components/Flow";
import { Button, Chip, Screen, T } from "../src/components/ui";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "../src/domain/catalog";
import { useRunning } from "../src/state/running";
import { colors } from "../src/theme/tokens";

export default function Run() {
  const session = useRunning((s) => s.session);
  const draft = useRunning((s) => s.draft);
  const tick = useRunning((s) => s.tick);
  const pause = useRunning((s) => s.togglePause);
  const finish = useRunning((s) => s.finish);
  const [controls, setControls] = useState(false);
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const timer = setInterval(() => tick(1), 1000);
    return () => clearInterval(timer);
  }, [tick]);
  if (!session)
    return (
      <Screen narrow>
        <T style={{ fontSize: 24, fontWeight: "700" }}>
          아직 시작한 러닝이 없어요.
        </T>
        <Button
          label={draft ? "지난 러닝 결과 확인" : "코스 고르러 가기"}
          onPress={() =>
            draft
              ? router.replace({
                  pathname: "/result",
                  params: { id: draft.id },
                })
              : router.replace("/")
          }
        />
      </Screen>
    );
  const progress =
    session.elapsed / session.course.summary.estimated_duration_s;
  const distance = session.course.summary.distance_m * progress;
  const complete = progress >= 1;
  const end = () => {
    const id = finish();
    if (id) router.replace({ pathname: "/result", params: { id } });
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: Math.max(insets.bottom, 16),
        gap: 16,
        maxWidth: 1000,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <T style={{ fontWeight: "700", fontSize: 16 }}>
          {session.course.purpose} ·{" "}
          {(session.course.summary.distance_m / 1000).toFixed(1)}km
        </T>
        <T accent style={{ fontSize: 12 }}>
          {complete
            ? "완주했어요"
            : session.running
              ? "모의 러닝 중"
              : "일시정지"}
        </T>
      </View>
      <RouteMap
        courses={[session.course]}
        selectedId={session.course.id}
        progress={progress}
        showLabels={false}
        height={Math.max(
          260,
          Math.min(600, height - insets.top - insets.bottom - 335),
        )}
      />
      <View style={{ gap: 14, paddingHorizontal: 6 }}>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Metric
            value={formatDuration(session.elapsed)}
            label="시간"
            large={width >= 360}
          />
          <Metric
            value={`${formatDistance(distance)} km`}
            label="거리"
            large={width >= 360}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Metric
            value={formatPace(session.elapsed, distance)}
            label="현재 페이스 /km"
          />
          <Metric
            value={formatPace(session.elapsed, distance)}
            label="평균 페이스 /km"
          />
        </View>
      </View>
      {session.running ? (
        <Button label="일시정지" icon="pause" secondary onPress={pause} />
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!complete && (
            <Button
              style={{ flex: 1 }}
              label="계속하기"
              secondary
              icon="play"
              onPress={pause}
            />
          )}
          <Button
            style={{ flex: 1 }}
            label="러닝 종료"
            icon="checkmark"
            disabled={session.elapsed <= 0}
            onPress={end}
          />
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <T muted style={{ fontSize: 10 }}>
          GPS 미수집 · 일정한 속도로 모의 이동
        </T>
        <Chip
          label={controls ? "시연 도구 닫기" : "시연 도구"}
          onPress={() => setControls(!controls)}
        />
      </View>
      {controls && (
        <View style={{ gap: 12 }}>
          <DemoNote running />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              style={{ flex: 1 }}
              label="시연 1분 이동"
              secondary
              icon="play-forward"
              disabled={!session.running || complete}
              onPress={() => tick(60)}
            />
            <Button
              style={{ flex: 1 }}
              label="완주 시연"
              secondary
              icon="flag-outline"
              disabled={!session.running || complete}
              onPress={() =>
                tick(
                  session.course.summary.estimated_duration_s - session.elapsed,
                )
              }
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
