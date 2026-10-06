import { ActivityIndicator, View } from "react-native";
import { CourseCard } from "../src/components/CourseCard";
import { FlowHeader } from "../src/components/Flow";
import { Screen, Status } from "../src/components/ui";
import { useCourse } from "../src/services/queries";
import { usePreferences } from "../src/state/preferences";
import { useLocalDataReady } from "../src/state/hydration";
import { colors } from "../src/theme/tokens";

function SavedCourse({ id }: { id: string }) {
  const query = useCourse(id);
  return query.isPending ? (
    <ActivityIndicator color={colors.lime} />
  ) : query.isError ? (
    <Status
      title="저장 코스를 불러오지 못했어요"
      message={query.error.message}
      onRetry={() => void query.refetch()}
    />
  ) : query.data ? (
    <CourseCard course={query.data} />
  ) : null;
}
export default function Saved() {
  const favorites = usePreferences((s) => s.favorites);
  const hydrated = useLocalDataReady();
  return (
    <Screen narrow>
      <FlowHeader title="저장한 코스" />
      {!hydrated ? (
        <ActivityIndicator color={colors.lime} />
      ) : favorites.length ? (
        <View style={{ gap: 12 }}>
          {favorites.map((id) => (
            <SavedCourse key={id} id={id} />
          ))}
        </View>
      ) : (
        <Status
          title="마음에 드는 길을 모아보세요"
          message="러닝 준비 화면에서 하트를 누르면 여기에 저장돼요."
        />
      )}
    </Screen>
  );
}
