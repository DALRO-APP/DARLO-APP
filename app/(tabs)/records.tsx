import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
  Button,
  Icon,
  Panel,
  Screen,
  Status,
  T,
} from "../../src/components/ui";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "../../src/domain/catalog";
import { useRunning } from "../../src/state/running";
import { useLocalDataReady } from "../../src/state/hydration";
import { colors } from "../../src/theme/tokens";

export default function Records() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useRunning((s) => s.records);
  const draft = useRunning((s) => s.draft);
  const hydrated = useLocalDataReady();
  useEffect(() => {
    if (id) router.replace({ pathname: "/result", params: { id } });
  }, [id]);
  return (
    <Screen narrow>
      <View style={{ gap: 8 }}>
        <T style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1 }}>
          러닝 기록
        </T>
        <T muted style={{ fontSize: 12 }}>
          이 기기에 저장한 모의 러닝을 확인해요.
        </T>
      </View>
      {!hydrated ? (
        <ActivityIndicator color={colors.lime} />
      ) : (
        <>
          {draft && (
            <Panel style={{ padding: 18, gap: 12 }}>
              <T style={{ fontSize: 14 }}>
                아직 저장하지 않은 러닝 결과가 있어요.
              </T>
              <Button
                label="지난 러닝 결과 확인"
                secondary
                onPress={() =>
                  router.push({ pathname: "/result", params: { id: draft.id } })
                }
              />
            </Panel>
          )}
          {!records.length ? (
            <>
              <Status
                title="첫 번째 달리기를 기다리고 있어요."
                message="목적을 고르고 러닝을 시작해 보세요."
              />
              <Button
                label="첫 러닝 시작하기"
                icon="play"
                onPress={() => router.push("/")}
              />
            </>
          ) : (
            <>
              <View
                style={{ flexDirection: "row", gap: 24, paddingVertical: 8 }}
              >
                <View style={{ gap: 6 }}>
                  <T accent style={{ fontSize: 27, fontWeight: "800" }}>
                    {records.length}회
                  </T>
                  <T muted style={{ fontSize: 12 }}>
                    저장한 러닝
                  </T>
                </View>
                <View style={{ gap: 6 }}>
                  <T style={{ fontSize: 27, fontWeight: "800" }}>
                    {formatDistance(
                      records.reduce((sum, r) => sum + r.distance_m, 0),
                    )}{" "}
                    km
                  </T>
                  <T muted style={{ fontSize: 12 }}>
                    누적 거리
                  </T>
                </View>
              </View>
              <View style={{ gap: 12 }}>
                {records.map((record) => (
                  <Pressable
                    key={record.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${record.course.name} 러닝 결과 보기`}
                    onPress={() =>
                      router.push({
                        pathname: "/result",
                        params: { id: record.id },
                      })
                    }
                    style={{
                      padding: 20,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.line,
                      backgroundColor: colors.panel,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <T accent style={{ fontSize: 12 }}>
                        {record.course.purpose}
                      </T>
                      <T muted style={{ fontSize: 11 }}>
                        {new Date(record.started_at).toLocaleDateString(
                          "ko-KR",
                          { timeZone: "Asia/Seoul" },
                        )}
                      </T>
                    </View>
                    <T style={{ fontSize: 16, fontWeight: "700" }}>
                      {record.course.name}
                    </T>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <T style={{ fontWeight: "700", fontSize: 18 }}>
                        {formatDistance(record.distance_m)} km
                      </T>
                      <T muted style={{ flex: 1, fontSize: 12 }}>
                        {formatDuration(record.elapsed_s)} ·{" "}
                        {formatPace(record.elapsed_s, record.distance_m)}/km
                      </T>
                      <Icon
                        name="chevron-forward"
                        color={colors.muted}
                        size={17}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
