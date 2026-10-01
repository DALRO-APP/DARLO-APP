import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { Conditions } from "../../src/components/Conditions";
import { CourseCard } from "../../src/components/CourseCard";
import {
  Chip,
  Icon,
  Screen,
  Status,
  T,
  useWide,
} from "../../src/components/ui";
import { useRecommendations, useCourse } from "../../src/services/queries";
import { usePreferences } from "../../src/state/preferences";
import { colors } from "../../src/theme/tokens";
function SavedCourse({ id, search }: { id: string; search: string }) {
  const query = useCourse(id);
  return query.data && query.data.name.includes(search) ? (
    <CourseCard course={query.data} />
  ) : query.isError ? (
    <Status
      title="저장 코스를 불러오지 못했어요"
      message={query.error.message}
      onRetry={() => void query.refetch()}
    />
  ) : query.isPending ? (
    <ActivityIndicator color={colors.lime} />
  ) : null;
}
export default function Explore() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const onlySaved = saved === "1";
  const setOnlySaved = (value: boolean) =>
    router.setParams({ saved: value ? "1" : "0" });
  const [search, setSearch] = useState("");
  const query = useRecommendations();
  const favorites = usePreferences((s) => s.favorites);
  const wide = useWide();
  const courses =
    query.data?.courses.filter((c) =>
      `${c.name} ${c.subtitle}`.includes(search),
    ) ?? [];
  return (
    <Screen>
      <View>
        <T accent style={{ fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
          EXPLORE YOUR NEXT
        </T>
        <T style={{ fontSize: 32, fontWeight: "900", letterSpacing: -1 }}>
          새로운 길을 만나봐요.
        </T>
        <T muted style={{ marginTop: 10, fontSize: 12 }}>
          오늘의 조건을 바꿔 나에게 맞는 코스를 찾아보세요.
        </T>
      </View>
      <Conditions />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderRadius: 14,
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.line,
          paddingHorizontal: 15,
        }}
      >
        <Icon name="search-outline" color={colors.muted} size={19} />
        <TextInput
          accessibilityLabel="코스 검색"
          placeholder="코스 이름으로 검색"
          placeholderTextColor={colors.faint}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, color: colors.text, height: 48, fontSize: 13 }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip
          label="추천 코스"
          selected={!onlySaved}
          onPress={() => setOnlySaved(false)}
        />
        <Chip
          label={`저장한 코스 ${favorites.length}`}
          icon="heart-outline"
          selected={onlySaved}
          onPress={() => setOnlySaved(true)}
        />
      </View>
      {onlySaved ? (
        favorites.length ? (
          <View style={{ gap: 18 }}>
            {favorites.map((id) => (
              <SavedCourse key={id} id={id} search={search} />
            ))}
          </View>
        ) : (
          <Status
            title="마음에 드는 길을 모아보세요"
            message="코스의 하트를 누르면 여기에 저장돼요."
          />
        )
      ) : query.isPending ? (
        <ActivityIndicator color={colors.lime} />
      ) : query.isError ? (
        <Status
          title="코스를 불러오지 못했어요"
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : courses.length ? (
        <View style={{ flexDirection: wide ? "row" : "column", gap: 18 }}>
          {courses.map((course) => (
            <View key={course.id} style={{ flex: wide ? 1 : undefined }}>
              <CourseCard course={course} />
            </View>
          ))}
        </View>
      ) : (
        <Status
          title="검색 결과가 없어요"
          message="검색어나 추천 조건을 바꿔 주세요."
        />
      )}
    </Screen>
  );
}
