import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { queryClient } from "../src/services/queries";
import { colors } from "../src/theme/tokens";
import { Status } from "../src/components/ui";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.background }}
          edges={["top", "left", "right"]}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="course/[id]" />
            <Stack.Screen name="run" />
          </Stack>
        </SafeAreaView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 24,
        justifyContent: "center",
      }}
    >
      <Status
        title="화면을 불러오지 못했어요"
        message="잠시 후 다시 시도해 주세요."
        onRetry={retry}
      />
    </SafeAreaView>
  );
}
