import { router } from "expo-router";
import { Button, Screen, Status } from "../src/components/ui";
export default function NotFound() {
  return (
    <Screen>
      <Status
        title="이 페이지를 찾지 못했어요"
        message="홈에서 다시 코스를 골라 주세요."
      />
      <Button label="홈으로" onPress={() => router.replace("/")} />
    </Screen>
  );
}
