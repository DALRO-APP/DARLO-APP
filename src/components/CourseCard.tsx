import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import type { Course } from "../domain/contracts";
import { PURPOSES } from "../domain/catalog";
import { usePreferences } from "../state/preferences";
import { colors } from "../theme/tokens";
import { Icon, T } from "./ui";
import { Scenery } from "./Scenery";
export function CourseCard({
  course,
  rank,
  selected,
  onSelect,
  compact,
}: {
  course: Course;
  rank?: number;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const favorite = usePreferences((s) => s.favorites.includes(course.id));
  const toggle = usePreferences((s) => s.toggleFavorite);
  const purpose = PURPOSES[course.purpose];
  return (
    <View style={[cardStyles.card, selected && { borderColor: "#637F3E" }]}>
      {!compact && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${course.name} 이미지에서 상세 보기`}
          onPress={() =>
            router.push({ pathname: "/course/[id]", params: { id: course.id } })
          }
        >
          <Scenery purpose={course.purpose} height={140} />
        </Pressable>
      )}
      <View style={{ padding: 17, gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${course.name} 지도 선택`}
            onPress={onSelect}
            style={{
              flex: 1,
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
            }}
          >
            {rank && (
              <View style={cardStyles.rank}>
                <T
                  style={{
                    fontWeight: "900",
                    color: colors.background,
                    fontSize: 11,
                  }}
                >
                  {rank}
                </T>
              </View>
            )}
            <T
              style={{
                color: purpose.color,
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 1.3,
              }}
            >
              {purpose.short} · {purpose.label}
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${course.name} ${favorite ? "저장 해제" : "저장"}`}
            accessibilityState={{ selected: favorite }}
            onPress={() => toggle(course.id)}
            hitSlop={10}
          >
            <Icon
              name={favorite ? "heart" : "heart-outline"}
              size={22}
              color={favorite ? colors.lime : colors.muted}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${course.name} 상세 보기`}
          onPress={() =>
            router.push({ pathname: "/course/[id]", params: { id: course.id } })
          }
          style={{ gap: 8 }}
        >
          <T style={{ fontSize: 19, letterSpacing: -0.7, fontWeight: "800" }}>
            {course.name}
          </T>
          <T muted style={{ fontSize: 12 }}>
            {course.subtitle}
          </T>
          <View style={{ flexDirection: "row", gap: 17, marginTop: 4 }}>
            <T style={{ fontSize: 13, fontWeight: "600" }}>
              {(course.summary.distance_m / 1000).toFixed(1)}{" "}
              <T muted style={{ fontSize: 11 }}>
                km
              </T>
            </T>
            <T style={{ fontSize: 13 }}>
              {Math.round(course.summary.estimated_duration_s / 60)}{" "}
              <T muted style={{ fontSize: 11 }}>
                분
              </T>
            </T>
            <T muted style={{ fontSize: 13 }}>
              {course.summary.elevation_gain_m === null
                ? "고도 미확인"
                : `↗ ${course.summary.elevation_gain_m}m`}
            </T>
            <View style={{ flex: 1 }} />
            <Icon name="arrow-forward" size={18} color={colors.lime} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    overflow: "hidden",
  },
  rank: {
    backgroundColor: colors.lime,
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
});
