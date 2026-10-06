import { router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { DemoNote, FlowHeader } from "../src/components/Flow";
import { Icon, Screen, T } from "../src/components/ui";
import { PURPOSES, STARTS } from "../src/domain/catalog";
import { usePreferences } from "../src/state/preferences";
import { useLocalDataReady } from "../src/state/hydration";
import { colors } from "../src/theme/tokens";

export default function RouteType() {
  const request = usePreferences((s) => s.request);
  const update = usePreferences((s) => s.update);
  const hydrated = useLocalDataReady();
  if (!hydrated)
    return (
      <Screen narrow>
        <ActivityIndicator color={colors.lime} />
      </Screen>
    );
  const choose = (mode: "loop" | "straight") => {
    if (mode === "loop")
      update({
        route_type: "loop",
        target_distance_m: request.target_distance_m ?? 5000,
      });
    else
      update({
        route_type: "straight",
        target_distance_m: null,
        end:
          request.route_type === "straight"
            ? request.end
            : STARTS.find(
                (s) =>
                  s.coordinate[0] !== request.start[0] ||
                  s.coordinate[1] !== request.start[1],
              )!.coordinate,
      });
    router.push("/explore");
  };
  return (
    <Screen narrow>
      <FlowHeader title="러닝 방식" step="01 / 04" />
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon
            name={PURPOSES[request.purpose].icon}
            color={PURPOSES[request.purpose].color}
          />
          <T
            style={{
              color: PURPOSES[request.purpose].color,
              fontWeight: "700",
            }}
          >
            {request.purpose}
          </T>
        </View>
        <T
          style={{
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: -1,
            lineHeight: 40,
          }}
        >
          어떤 코스로{"\n"}달려볼까요?
        </T>
        <T muted style={{ fontSize: 13 }}>
          돌아올지, 목적지까지 갈지 골라 주세요.
        </T>
      </View>
      {(
        [
          {
            mode: "loop",
            title: "Loop",
            label: "출발지로 돌아오기",
            description: "출발지와 달릴 거리를 정해요.",
            icon: "sync-outline",
          },
          {
            mode: "straight",
            title: "Straight",
            label: "목적지까지 달리기",
            description: "출발지와 목적지를 각각 정해요.",
            icon: "arrow-forward",
          },
        ] as const
      ).map((option) => (
        <Pressable
          key={option.mode}
          accessibilityRole="button"
          accessibilityLabel={`${option.title} 선택`}
          onPress={() => choose(option.mode)}
          style={({ pressed }) => ({
            padding: 24,
            borderRadius: 22,
            backgroundColor: pressed ? colors.elevated : colors.panel,
            borderWidth: 1,
            borderColor: colors.line,
            gap: 18,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                height: 48,
                width: 48,
                borderRadius: 16,
                backgroundColor: colors.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={option.icon} color={colors.lime} size={27} />
            </View>
            <T style={{ flex: 1, fontWeight: "800", fontSize: 24 }}>
              {option.title}
            </T>
            <Icon name="chevron-forward" color={colors.muted} size={20} />
          </View>
          <View style={{ gap: 7 }}>
            <T style={{ fontSize: 17, fontWeight: "700" }}>{option.label}</T>
            <T muted style={{ fontSize: 13 }}>
              {option.description}
            </T>
          </View>
        </Pressable>
      ))}
      <DemoNote />
    </Screen>
  );
}
