import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { Mascot } from "../src/components/Mascot";
import { RouteMap } from "../src/components/RouteMap";
import { Button, Panel, Screen, T, useWide } from "../src/components/ui";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "../src/domain/catalog";
import { useRunning } from "../src/state/running";
import { colors } from "../src/theme/tokens";
export default function Run() {
  const session = useRunning((s) => s.session);
  const tick = useRunning((s) => s.tick);
  const pause = useRunning((s) => s.togglePause);
  const finish = useRunning((s) => s.finish);
  const wide = useWide();
  useEffect(() => {
    const timer = setInterval(() => tick(1), 1000);
    return () => clearInterval(timer);
  }, [tick]);
  if (!session)
    return (
      <Screen>
        <Mascot size={120} />
        <T style={{ fontSize: 24, fontWeight: "800" }}>
          아직 시작한 러닝이 없어요.
        </T>
        <Button label="코스 고르러 가기" onPress={() => router.replace("/")} />
      </Screen>
    );
  const progress =
    session.elapsed / session.course.summary.estimated_duration_s;
  const distance = session.course.summary.distance_m * progress;
  const complete = progress >= 1;
  const end = () => {
    const id = finish();
    if (id) router.replace({ pathname: "/records", params: { id } });
  };
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ gap: 8 }}>
          <T accent style={{ fontSize: 11, letterSpacing: 2 }}>
            RUNNING WITH DALRO
          </T>
          <T style={{ fontSize: 30, fontWeight: "900", letterSpacing: -1 }}>
            {complete
              ? "잘 달렸어요!"
              : session.running
                ? "지금, 나의 속도로."
                : "잠깐 숨을 고르세요."}
          </T>
        </View>
        <Mascot size={80} celebrate={complete} />
      </View>
      <T muted style={{ fontSize: 12 }}>
        {session.course.name} · 모의 러닝
      </T>
      <RouteMap
        courses={[session.course]}
        selectedId={session.course.id}
        progress={progress}
        height={wide ? 400 : 320}
      />
      <Panel style={{ padding: 24, gap: 23 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            gap: 12,
          }}
        >
          {[
            { value: formatDistance(distance), unit: "km", label: "달린 거리" },
            {
              value: formatDuration(session.elapsed),
              unit: "",
              label: "러닝 시간",
            },
            {
              value: formatPace(session.elapsed, distance),
              unit: "",
              label: "평균 페이스",
            },
          ].map((m) => (
            <View key={m.label} style={{ alignItems: "center", gap: 9 }}>
              <T accent style={{ fontSize: wide ? 36 : 27, fontWeight: "800" }}>
                {m.value}
                <T accent style={{ fontSize: 12 }}>
                  {" "}
                  {m.unit}
                </T>
              </T>
              <T muted style={{ fontSize: 11 }}>
                {m.label}
              </T>
            </View>
          ))}
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 10,
            backgroundColor: colors.line,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 6,
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: colors.lime,
            }}
          />
        </View>
        <T muted style={{ fontSize: 11, textAlign: "center" }}>
          목표 {(session.course.summary.distance_m / 1000).toFixed(1)}km 중{" "}
          {Math.round(progress * 100)}% 달성
        </T>
      </Panel>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button
          style={{ flex: 1 }}
          label={session.running ? "일시정지" : "계속 달리기"}
          secondary
          icon={session.running ? "pause" : "play"}
          onPress={pause}
          disabled={complete}
        />
        <Button
          style={{ flex: 1 }}
          label="러닝 마치기"
          icon="checkmark"
          disabled={session.elapsed <= 0}
          onPress={end}
        />
      </View>
      <Panel style={{ padding: 18, gap: 13 }}>
        <T style={{ fontSize: 13, fontWeight: "700" }}>발표용 시연 컨트롤</T>
        <T muted style={{ fontSize: 11, lineHeight: 19 }}>
          GPS를 수집하지 않습니다. 시간과 위치는 코스를 따라 모의로 이동하며,
          아래 버튼으로 빠르게 진행할 수 있어요.
        </T>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            style={{ flex: 1 }}
            label="시연 1분 이동"
            secondary
            icon="play-forward"
            onPress={() => tick(60)}
            disabled={!session.running || complete}
          />
          <Button
            style={{ flex: 1 }}
            label="완주 시연"
            secondary
            icon="flag-outline"
            onPress={() =>
              tick(
                session.course.summary.estimated_duration_s - session.elapsed,
              )
            }
            disabled={!session.running || complete}
          />
        </View>
      </Panel>
      <Button
        label="홈으로 돌아가기"
        secondary
        icon="home-outline"
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}
