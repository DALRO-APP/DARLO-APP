import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { Mascot } from "../../src/components/Mascot";
import { RouteMap } from "../../src/components/RouteMap";
import {
  Button,
  Chip,
  Glow,
  Icon,
  Panel,
  Screen,
  SectionTitle,
  T,
  useWide,
} from "../../src/components/ui";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "../../src/domain/catalog";
import { useRunning } from "../../src/state/running";
import { colors } from "../../src/theme/tokens";
const reviewTags = ["풍경이 멋져요", "달리기 좋은 길", "또 달리고 싶어요"];
export default function Records() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useRunning((s) => s.records);
  const review = useRunning((s) => s.review);
  const wide = useWide();
  const record = records.find((r) => r.id === id) ?? records[0];
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <T
            accent
            style={{ fontSize: 11, letterSpacing: 2, marginBottom: 12 }}
          >
            EVERY RUN COUNTS
          </T>
          <T style={{ fontSize: 34, fontWeight: "900", letterSpacing: -1 }}>
            오늘의<T accent>{"\n"}러닝 기록.</T>
          </T>
        </View>
        <Mascot size={115} celebrate />
      </View>
      {!record ? (
        <Glow style={{ padding: 28, gap: 18 }}>
          <T style={{ fontSize: 20, fontWeight: "800" }}>
            첫 번째 달리기를 기다리고 있어요.
          </T>
          <T muted style={{ lineHeight: 23 }}>
            코스를 고르고 모의 러닝을 시작해 보세요.{"\n"}달린 거리와 시간, 코스
            후기가 여기에 쌓여요.
          </T>
          <Button label="첫 러닝 시작하기" onPress={() => router.push("/")} />
        </Glow>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Icon name="checkmark-circle" color={colors.lime} size={18} />
            <T muted style={{ fontSize: 12 }}>
              {new Date(record.started_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · 시연 기록
            </T>
          </View>
          <Glow
            style={{
              padding: 22,
              flexDirection: "row",
              gap: 20,
              justifyContent: "space-around",
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "총 거리",
                value: `${formatDistance(record.distance_m)} km`,
              },
              { label: "총 시간", value: formatDuration(record.elapsed_s) },
              {
                label: "평균 페이스",
                value: formatPace(record.elapsed_s, record.distance_m),
              },
            ].map((metric) => (
              <View key={metric.label} style={{ gap: 9 }}>
                <T muted style={{ fontSize: 11 }}>
                  {metric.label}
                </T>
                <T
                  accent
                  style={{ fontWeight: "900", fontSize: wide ? 37 : 26 }}
                >
                  {metric.value}
                </T>
              </View>
            ))}
          </Glow>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 22 }}>
            <View style={{ flex: wide ? 1.4 : undefined, gap: 12 }}>
              <SectionTitle
                title={record.course.name}
                caption={`${record.course.start_label}에서 시작한 달리기`}
              />
              <RouteMap
                courses={[record.course]}
                selectedId={record.course.id}
                progress={record.distance_m / record.course.summary.distance_m}
                height={320}
              />
              <T muted style={{ fontSize: 10 }}>
                모의 주행 기록 · 실제 GPS나 운동 측정 데이터가 아닙니다.
              </T>
            </View>
            <Panel style={{ flex: wide ? 1 : undefined, padding: 24, gap: 18 }}>
              <T style={{ fontSize: 21, fontWeight: "800" }}>
                이번 코스는 어땠나요?
              </T>
              <T muted style={{ fontSize: 12 }}>
                당신의 한마디가 다음 달리기에 도움이 돼요.
              </T>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="코스 만족도"
                style={{ flexDirection: "row", gap: 10 }}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Pressable
                    key={rating}
                    accessibilityRole="radio"
                    accessibilityLabel={`평점 ${rating}점`}
                    accessibilityState={{ checked: record.rating === rating }}
                    aria-checked={record.rating === rating}
                    onPress={() => review(record.id, rating, record.tags)}
                  >
                    <Icon
                      name={rating <= record.rating ? "heart" : "heart-outline"}
                      color={
                        rating <= record.rating ? colors.lime : colors.faint
                      }
                      size={29}
                    />
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {reviewTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={record.tags.includes(tag)}
                    onPress={() =>
                      review(
                        record.id,
                        record.rating,
                        record.tags.includes(tag)
                          ? record.tags.filter((t) => t !== tag)
                          : [...record.tags, tag],
                      )
                    }
                  />
                ))}
              </View>
              <View style={{ flex: 1 }} />
              <T muted style={{ fontSize: 10 }}>
                {record.rating
                  ? "후기는 이 기기에 저장되었어요."
                  : "하트를 눌러 만족도를 남겨주세요."}
              </T>
              <Button
                label="다시 추천받기"
                icon="refresh"
                onPress={() => router.push("/")}
              />
            </Panel>
          </View>
          <View>
            <SectionTitle
              title="차곡차곡 쌓인 달리기"
              caption={`${records.length}회 · 누적 ${formatDistance(records.reduce((sum, r) => sum + r.distance_m, 0))}km`}
            />
            <View style={{ gap: 12 }}>
              {records.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.course.name} 러닝 기록 보기`}
                  onPress={() => router.setParams({ id: r.id })}
                >
                  <Panel
                    style={{
                      padding: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      borderColor: r.id === record.id ? "#637F3E" : colors.line,
                    }}
                  >
                    <Icon
                      name="footsteps-outline"
                      color={colors.lime}
                      size={24}
                    />
                    <View style={{ flex: 1, gap: 5 }}>
                      <T style={{ fontWeight: "700" }}>{r.course.name}</T>
                      <T muted style={{ fontSize: 11 }}>
                        {formatDistance(r.distance_m)}km ·{" "}
                        {formatDuration(r.elapsed_s)} · 시연
                      </T>
                    </View>
                    <Icon
                      name="chevron-forward"
                      color={colors.muted}
                      size={18}
                    />
                  </Panel>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}
