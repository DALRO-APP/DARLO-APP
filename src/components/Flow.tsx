import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Icon, T } from "./ui";
import { colors } from "../theme/tokens";
import { isDemo } from "../services/repository";

export function FlowHeader({
  title,
  step,
  back = "/",
}: {
  title: string;
  step?: string;
  back?: "/" | "/explore" | "/recommendations" | "/records" | "/route-type";
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace(back)
        }
        style={{ padding: 8 }}
      >
        <Icon name="arrow-back" size={22} />
      </Pressable>
      <T style={{ flex: 1, fontSize: 18, fontWeight: "700" }}>{title}</T>
      {step && (
        <T muted style={{ fontSize: 12 }}>
          {step}
        </T>
      )}
    </View>
  );
}

export function DemoNote({ running = false }: { running?: boolean }) {
  return (
    <T muted style={{ fontSize: 11, lineHeight: 18 }}>
      {running
        ? "모의 러닝 · GPS와 운동 데이터를 측정하지 않아요."
        : isDemo
          ? "용산구 더미 코스 · 경로와 환경 수치는 시연용이에요."
          : "환경 지표는 실제 안전을 보장하지 않아요."}
    </T>
  );
}

export function Metric({
  value,
  label,
  large = false,
}: {
  value: string;
  label: string;
  large?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T
        style={{
          fontSize: large ? 38 : 27,
          fontWeight: "800",
          letterSpacing: -1,
          color: colors.text,
        }}
      >
        {value}
      </T>
      <T muted style={{ fontSize: 12 }}>
        {label}
      </T>
    </View>
  );
}
