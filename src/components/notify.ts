import { Alert, Platform } from "react-native";

// react-native-web의 Alert.alert는 아무것도 표시하지 않아 웹에서는 브라우저 alert를 쓴다.
export function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
