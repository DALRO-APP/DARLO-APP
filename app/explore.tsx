import { router } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Conditions } from "../src/components/Conditions";
import { DemoNote, FlowHeader } from "../src/components/Flow";
import { Chip, Icon, Screen, T } from "../src/components/ui";
import { PURPOSES } from "../src/domain/catalog";
import { usePreferences } from "../src/state/preferences";
import { useLocalDataReady } from "../src/state/hydration";
import { colors } from "../src/theme/tokens";

export default function CourseSettings() {
  const request = usePreferences((s) => s.request);
  const purpose = request.purpose;
  const mode = request.route_type === "straight" ? "Straight" : "Loop";
  const hydrated = useLocalDataReady();
  if (!hydrated)
    return (
      <Screen narrow>
        <ActivityIndicator color={colors.lime} />
      </Screen>
    );
  return (
    <Screen narrow compact>
      <FlowHeader
        title={`${mode} 코스 설정`}
        step="02 / 04"
        back="/route-type"
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Icon
              name={PURPOSES[purpose].icon}
              color={PURPOSES[purpose].color}
              size={26}
            />
            <T style={{ fontSize: 26, fontWeight: "800", letterSpacing: -1 }}>
              {purpose} · {mode}
            </T>
          </View>
          <T muted style={{ fontSize: 13 }}>
            {request.route_type === "straight"
              ? "출발지에서 목적지까지 달리는 편도 코스"
              : "출발지에서 시작해 다시 돌아오는 코스"}
          </T>
        </View>
        <Chip label="방식 변경" onPress={() => router.push("/route-type")} />
      </View>
      <Conditions onRecommend={() => router.push("/recommendations")} />
      <DemoNote />
    </Screen>
  );
}
