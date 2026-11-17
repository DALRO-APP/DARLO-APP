import { View } from "react-native";
import { T } from "./ui";
import { formatEnvironmentPenalty } from "../domain/presentation";

export function EnvironmentPenalty({ value }: { value: number | null }) {
  return (
    <View style={{ gap: 4 }}>
      <T accent style={{ fontSize: 14, fontWeight: "700" }}>
        환경 패널티 {formatEnvironmentPenalty(value)}
      </T>
      <T muted style={{ fontSize: 11, lineHeight: 17 }}>
        0~1 · 낮을수록 멈춤 요인·경사 부담이 적어요
      </T>
    </View>
  );
}
