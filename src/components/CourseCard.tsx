import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { Course } from "../domain/contracts";
import { usePreferences } from "../state/preferences";
import { colors } from "../theme/tokens";
import { Icon, Panel, T } from "./ui";

export function CourseCard({ course }: { course: Course }) {
  const favorite = usePreferences((s) => s.favorites.includes(course.id));
  const toggle = usePreferences((s) => s.toggleFavorite);
  return (
    <Panel style={{ padding: 18, gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <T accent style={{ fontSize: 12 }}>
          {course.purpose} · {course.is_mock ? "더미 코스" : course.region}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${course.name} ${favorite ? "저장 해제" : "저장"}`}
          onPress={() => toggle(course.id)}
          style={{ padding: 8 }}
        >
          <Icon
            name={favorite ? "heart" : "heart-outline"}
            color={colors.lime}
            size={20}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${course.name} 상세 보기`}
        onPress={() =>
          router.push({ pathname: "/course/[id]", params: { id: course.id } })
        }
        style={{ gap: 10, paddingVertical: 4 }}
      >
        <T style={{ fontSize: 18, fontWeight: "700" }}>{course.name}</T>
        <T muted style={{ fontSize: 12 }}>
          {course.route_type === "straight"
            ? `${course.start_label} → ${course.end_label}`
            : course.start_label}{" "}
          · {(course.summary.distance_m / 1000).toFixed(1)}
          km · 약 {Math.round(course.summary.estimated_duration_s / 60)}분
        </T>
      </Pressable>
    </Panel>
  );
}
