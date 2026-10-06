import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { RouteMap } from "../src/components/RouteMap";
import { DemoNote, FlowHeader, Metric } from "../src/components/Flow";
import { Button, Panel, Screen, Status, T } from "../src/components/ui";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "../src/domain/catalog";
import { courseExplanation } from "../src/domain/presentation";
import { useRunning } from "../src/state/running";
import { useLocalDataReady } from "../src/state/hydration";

export default function Result() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const draft = useRunning((s) => s.draft);
  const records = useRunning((s) => s.records);
  const save = useRunning((s) => s.save);
  const discard = useRunning((s) => s.discard);
  const hydrated = useLocalDataReady();
  const record = id
    ? (records.find((r) => r.id === id) ??
      (draft?.id === id ? draft : undefined))
    : draft;
  const saved = !!record && records.some((r) => r.id === record.id);
  if (!hydrated)
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  if (!record)
    return (
      <Screen narrow>
        <FlowHeader title="러닝 결과" back="/records" />
        <Status
          title="러닝 결과를 찾을 수 없어요"
          message="이 기기에 저장된 기록을 확인해 주세요."
        />
        <Button label="기록 보기" onPress={() => router.replace("/records")} />
      </Screen>
    );
  const course = record.course;
  const progress = record.distance_m / course.summary.distance_m;
  return (
    <Screen narrow>
      <FlowHeader title="러닝 결과" back="/records" />
      <View style={{ gap: 10 }}>
        <T muted style={{ fontSize: 12 }}>
          {new Date(record.started_at).toLocaleDateString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "long",
            day: "numeric",
          })}{" "}
          · 모의 기록
        </T>
        <T style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1 }}>
          오늘의 러닝
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 20 }}>
        <Metric
          value={`${formatDistance(record.distance_m)} km`}
          label="달린 거리"
        />
        <Metric value={formatDuration(record.elapsed_s)} label="러닝 시간" />
      </View>
      <Metric
        value={formatPace(record.elapsed_s, record.distance_m)}
        label="평균 페이스 /km"
      />
      <RouteMap
        courses={[course]}
        selectedId={course.id}
        progress={Math.min(1, progress)}
        showLabels={false}
        height={270}
      />
      <T muted style={{ fontSize: 12 }}>
        {course.start_label} →{" "}
        {course.route_type === "straight" ? course.end_label : "출발지"}
      </T>
      <Panel style={{ padding: 22, gap: 12 }}>
        <T style={{ fontSize: 15, fontWeight: "700" }}>코스 리포트</T>
        <T accent style={{ fontSize: 25, fontWeight: "800" }}>
          {course.purpose} 환경 점수{" "}
          {course.summary.environment_score === null
            ? "미확인"
            : `${course.summary.environment_score}점`}
        </T>
        <T muted style={{ fontSize: 13, lineHeight: 21 }}>
          {courseExplanation(course)}
        </T>
        <T muted style={{ fontSize: 11, lineHeight: 18 }}>
          선택한 전체 코스의 환경 정보예요.{" "}
          {progress < 0.99 ? "일부 구간만 모의로 달렸어요. " : ""}실제 주행
          분석이나 안전 점수가 아니에요.
        </T>
      </Panel>
      <DemoNote running />
      <Button
        label={saved ? "저장한 기록 보기" : "기록 저장"}
        icon={saved ? "checkmark-circle" : "download-outline"}
        onPress={() => {
          if (saved || save(record.id)) router.replace("/records");
        }}
      />
      <Button
        label="같은 코스 다시 달리기"
        secondary
        icon="refresh"
        onPress={() => {
          if (!saved && !save(record.id)) return;
          router.replace({
            pathname: "/course/[id]",
            params: { id: course.id },
          });
        }}
      />
      {!saved && (
        <Button
          label="저장하지 않고 홈으로"
          secondary
          icon="home-outline"
          onPress={() => {
            discard(record.id);
            router.replace("/");
          }}
        />
      )}
      {!saved && (
        <T muted style={{ fontSize: 11 }}>
          다시 달리기를 누르면 이번 결과를 저장하고 이동해요.
        </T>
      )}
    </Screen>
  );
}
