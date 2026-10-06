import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Mascot } from "../../src/components/Mascot";
import {
  Button,
  Icon,
  Panel,
  Screen,
  T,
  useWide,
} from "../../src/components/ui";
import { PURPOSES, STARTS, formatDistance } from "../../src/domain/catalog";
import type { Purpose } from "../../src/domain/contracts";
import { usePreferences } from "../../src/state/preferences";
import { useRunning } from "../../src/state/running";
import { colors } from "../../src/theme/tokens";
import { isDemo } from "../../src/services/repository";

const prompts: Record<Purpose, string> = {
  PACE: "일정한 페이스로\n달리고 싶어요",
  POWER: "운동 강도를\n높이고 싶어요",
  NIGHT: "밝은 길에서\n밤에 달리고 싶어요",
  GREEN: "공원·녹지가 많은\n길을 달리고 싶어요",
};
export default function Home() {
  const wide = useWide();
  const update = usePreferences((s) => s.update);
  const request = usePreferences((s) => s.request);
  const favorites = usePreferences((s) => s.favorites);
  const records = useRunning((s) => s.records);
  const recent = records[0];
  const destination =
    request.route_type === "straight"
      ? STARTS.find(
          (s) =>
            s.coordinate[0] === request.end[0] &&
            s.coordinate[1] === request.end[1],
        )
      : undefined;
  const start = STARTS.find(
    (s) =>
      s.coordinate[0] === request.start[0] &&
      s.coordinate[1] === request.start[1],
  );
  const session = useRunning((s) => s.session);
  const draft = useRunning((s) => s.draft);
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <T
          accent
          style={{ fontSize: 28, fontWeight: "900", letterSpacing: -1.5 }}
        >
          DALRO.
        </T>
        <T muted style={{ fontSize: 11 }}>
          {isDemo ? "용산구 DEMO" : "용산구 PILOT"}
        </T>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: wide ? 24 : 10,
        }}
      >
        <View style={{ flex: 1, gap: 12 }}>
          <T
            style={{
              fontSize: wide ? 44 : 31,
              lineHeight: wide ? 55 : 41,
              fontWeight: "800",
              letterSpacing: -1.3,
            }}
          >
            오늘은 어떻게{"\n"}달려볼까요?
          </T>
          <T muted style={{ fontSize: 13 }}>
            목적을 고르면, 나에게 맞는 길을 찾아요.
          </T>
        </View>
        <Mascot size={wide ? 125 : 72} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="오늘의 러닝 조건 변경"
        onPress={() => router.push("/explore")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 16,
          backgroundColor: pressed ? colors.elevated : colors.panel,
          borderWidth: 1,
          borderColor: colors.line,
        })}
      >
        <Icon name="location-outline" color={colors.lime} size={20} />
        <View style={{ flex: 1, gap: 4 }}>
          <T style={{ fontSize: 13, fontWeight: "600" }}>
            {start?.label ?? "선택한 출발지"}
            {request.route_type === "straight"
              ? ` → ${destination?.label ?? "선택한 목적지"}`
              : ""}
          </T>
          <T muted style={{ fontSize: 11 }}>
            {request.target_distance_m === null
              ? "거리 자동"
              : `${request.target_distance_m / 1000}km`}{" "}
            · {request.time_of_day === "night" ? "야간" : "주간"} ·{" "}
            {request.route_type === "straight"
              ? "목적지까지 달리기"
              : "출발지로 돌아오기"}
          </T>
        </View>
        <T muted style={{ fontSize: 11 }}>
          변경
        </T>
        <Icon name="chevron-forward" color={colors.muted} size={15} />
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {(Object.keys(PURPOSES) as Purpose[]).map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityLabel={`${p} 목적 선택`}
            onPress={() => {
              update({
                purpose: p,
                time_of_day: p === "NIGHT" ? "night" : "day",
              });
              router.push("/route-type");
            }}
            style={({ pressed }) => ({
              width: wide ? "48.9%" : "48%",
              flexGrow: 1,
              padding: wide ? 26 : 16,
              minHeight: wide ? 180 : 148,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: pressed ? colors.elevated : colors.panel,
              gap: 10,
            })}
          >
            <Icon name={PURPOSES[p].icon} color={PURPOSES[p].color} size={27} />
            <T
              style={{
                fontWeight: "800",
                fontSize: 21,
                color: PURPOSES[p].color,
              }}
            >
              {p}
            </T>
            <T muted style={{ fontSize: 12, lineHeight: 19 }}>
              {prompts[p]}
            </T>
          </Pressable>
        ))}
      </View>
      {session && (
        <Button
          label="진행 중인 러닝 이어가기"
          icon="play"
          onPress={() => router.push("/run")}
        />
      )}
      {draft && (
        <Button
          label="지난 러닝 결과 확인"
          secondary
          onPress={() =>
            router.push({ pathname: "/result", params: { id: draft.id } })
          }
        />
      )}
      <Panel style={{ padding: 20, gap: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <T style={{ fontSize: 16, fontWeight: "700" }}>나의 러닝</T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="러닝 기록 보기"
            onPress={() => router.push("/records")}
            style={{ paddingVertical: 6 }}
          >
            <T muted style={{ fontSize: 12 }}>
              기록 보기 →
            </T>
          </Pressable>
        </View>
        {records.length ? (
          <View style={{ flexDirection: "row", gap: 24 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <T accent style={{ fontSize: 28, fontWeight: "800" }}>
                {records.length}회
              </T>
              <T muted style={{ fontSize: 11 }}>
                저장한 모의 러닝
              </T>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T
                style={{ fontSize: 28, fontWeight: "800", letterSpacing: -0.8 }}
              >
                {formatDistance(
                  records.reduce((sum, record) => sum + record.distance_m, 0),
                )}{" "}
                km
              </T>
              <T muted style={{ fontSize: 11 }}>
                누적 거리
              </T>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Icon name="footsteps-outline" color={colors.lime} size={29} />
            <View style={{ flex: 1, gap: 6 }}>
              <T style={{ fontSize: 14, fontWeight: "600" }}>
                첫 발걸음부터 함께해요
              </T>
              <T muted style={{ fontSize: 12, lineHeight: 19 }}>
                오늘의 목적을 고르고 나만의 러닝을 시작해 보세요.
              </T>
            </View>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`저장한 코스 ${favorites.length}개 보기`}
          onPress={() => router.push("/saved")}
          style={{
            borderTopWidth: 1,
            borderColor: colors.line,
            paddingTop: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon name="heart-outline" color={colors.muted} size={18} />
          <T style={{ flex: 1, fontSize: 13 }}>저장한 코스</T>
          <T accent style={{ fontSize: 13 }}>
            {favorites.length}개
          </T>
          <Icon name="chevron-forward" color={colors.muted} size={16} />
        </Pressable>
      </Panel>
      {recent && (
        <Panel style={{ padding: 18, gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <T muted style={{ fontSize: 12 }}>
              최근 러닝 · 모의 기록
            </T>
            <T accent style={{ fontSize: 12 }}>
              {formatDistance(recent.distance_m)} km
            </T>
          </View>
          <T style={{ fontWeight: "700" }}>{recent.course.name}</T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지난번 코스 다시 달리기"
            onPress={() =>
              router.push({
                pathname: "/course/[id]",
                params: { id: recent.course.id },
              })
            }
            style={{ paddingVertical: 6 }}
          >
            <T accent style={{ fontSize: 13 }}>
              지난번 코스 다시 달리기 →
            </T>
          </Pressable>
        </Panel>
      )}
    </Screen>
  );
}
