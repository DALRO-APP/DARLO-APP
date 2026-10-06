import { router } from "expo-router";
import { View } from "react-native";
import { Mascot } from "../../src/components/Mascot";
import { Button, Panel, Screen, T } from "../../src/components/ui";
import { usePreferences } from "../../src/state/preferences";
import { useRunning } from "../../src/state/running";
import { formatDistance, PURPOSES } from "../../src/domain/catalog";
import { isDemo } from "../../src/services/repository";

export default function Profile() {
  const favorites = usePreferences((s) => s.favorites);
  const purpose = usePreferences((s) => s.request.purpose);
  const records = useRunning((s) => s.records);
  return (
    <Screen narrow>
      <T style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1 }}>마이</T>
      <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
        <Mascot size={82} />
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 23, fontWeight: "800" }}>달로 러너</T>
          <T muted style={{ fontSize: 12 }}>
            로그인 없이 체험하는 데모 프로필
          </T>
        </View>
      </View>
      <Panel style={{ padding: 22, flexDirection: "row", gap: 20 }}>
        {[
          { value: `${records.length}회`, label: "저장한 러닝" },
          {
            value: `${formatDistance(records.reduce((sum, r) => sum + r.distance_m, 0))} km`,
            label: "누적 거리",
          },
        ].map((metric) => (
          <View key={metric.label} style={{ flex: 1, gap: 8 }}>
            <T accent style={{ fontSize: 24, fontWeight: "800" }}>
              {metric.value}
            </T>
            <T muted style={{ fontSize: 12 }}>
              {metric.label}
            </T>
          </View>
        ))}
      </Panel>
      <Button
        label={`저장한 코스 ${favorites.length}`}
        secondary
        icon="heart-outline"
        onPress={() => router.push("/saved")}
      />
      <Panel style={{ padding: 22, gap: 12 }}>
        <T muted style={{ fontSize: 12 }}>
          최근 선택한 러닝 목적
        </T>
        <T style={{ fontSize: 18, fontWeight: "700" }}>
          {purpose} · {PURPOSES[purpose].label}
        </T>
        <T muted style={{ fontSize: 12 }}>
          홈에서 오늘의 목적을 새로 고를 수 있어요.
        </T>
      </Panel>
      <T muted style={{ fontSize: 11, lineHeight: 20 }}>
        DALRO v0.1.0 · {isDemo ? "더미 데이터 모드" : "서버 연결 모드"}
        {"\n"}코스와 모의 기록은 이 기기에 보관돼요.{"\n"}GPS 측정·인증·서버
        동기화는 준비 중이에요.
      </T>
    </Screen>
  );
}
