import { router } from "expo-router";
import { View } from "react-native";
import { Mascot } from "../../src/components/Mascot";
import {
  Button,
  Chip,
  Glow,
  Panel,
  Screen,
  SectionTitle,
  T,
} from "../../src/components/ui";
import { PURPOSES } from "../../src/domain/catalog";
import type { Purpose } from "../../src/domain/contracts";
import { usePreferences } from "../../src/state/preferences";
import { useRunning } from "../../src/state/running";
import { isDemo } from "../../src/services/repository";
export default function Profile() {
  const preferences = usePreferences();
  const records = useRunning((s) => s.records);
  return (
    <Screen>
      <T accent style={{ fontSize: 11, letterSpacing: 2 }}>
        MY RUNNING SPACE
      </T>
      <Glow
        style={{
          padding: 24,
          flexDirection: "row",
          alignItems: "center",
          gap: 18,
        }}
      >
        <Mascot size={94} />
        <View style={{ flex: 1, gap: 9 }}>
          <T style={{ fontSize: 25, fontWeight: "900", letterSpacing: -1 }}>
            반가워요, 달로 러너!
          </T>
          <T muted style={{ fontSize: 12 }}>
            오늘도 한 걸음 더, 나를 위한 달리기.
          </T>
          <T accent style={{ fontSize: 11 }}>
            로그인 없이 체험하는 데모 프로필
          </T>
        </View>
      </Glow>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          { value: records.length, label: "완료한 러닝" },
          { value: preferences.favorites.length, label: "저장한 코스" },
        ].map((m) => (
          <Panel key={m.label} style={{ flex: 1, padding: 24, gap: 9 }}>
            <T accent style={{ fontSize: 34, fontWeight: "900" }}>
              {m.value}
            </T>
            <T muted style={{ fontSize: 12 }}>
              {m.label}
            </T>
          </Panel>
        ))}
      </View>
      <Panel style={{ padding: 24 }}>
        <SectionTitle
          title="내가 좋아하는 달리기"
          caption="선택하면 다음 추천에 바로 반영돼요"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {(Object.keys(PURPOSES) as Purpose[]).map((p) => (
            <Chip
              key={p}
              label={PURPOSES[p].label}
              icon={PURPOSES[p].icon}
              selected={preferences.request.purpose === p}
              onPress={() => preferences.update({ purpose: p })}
            />
          ))}
        </View>
      </Panel>
      <Button
        label="저장한 코스 보기"
        secondary
        icon="heart-outline"
        onPress={() =>
          router.push({ pathname: "/explore", params: { saved: "1" } })
        }
      />
      <Panel style={{ padding: 24, gap: 15 }}>
        <T style={{ fontSize: 18, fontWeight: "800" }}>
          DALRO, 오늘도 더 좋은 길로
        </T>
        <T muted style={{ fontSize: 12, lineHeight: 22 }}>
          도시 공간정보로 나에게 맞는 러닝 코스를 찾습니다.{"\n"}용산구에서
          시작해 더 많은 길로 넓혀갈 거예요.
        </T>
        <T muted style={{ fontSize: 11, lineHeight: 20 }}>
          v0.1.0 · {isDemo ? "더미 데이터 모드" : "서버 연결 모드"}
          {"\n"}코스 저장과 시연 기록은 이 기기에 보관됩니다.{"\n"}실제 GPS
          측정·인증·서버 동기화는 추후 연결 예정입니다.
        </T>
      </Panel>
    </Screen>
  );
}
