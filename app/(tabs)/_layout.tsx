import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, T } from "../../src/components/ui";
import { colors } from "../../src/theme/tokens";
const tabs = [
  { name: "index", label: "홈", icon: "home-outline" as const },
  { name: "explore", label: "탐색", icon: "search-outline" as const },
  { name: "records", label: "기록", icon: "stats-chart-outline" as const },
  { name: "profile", label: "마이", icon: "person-outline" as const },
];
type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: "#10140F",
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          maxWidth: 680,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {tabs.map((tab) => {
          const index = state.routes.findIndex((r) => r.name === tab.name);
          const active = index === state.index;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() => {
                const route = state.routes[index];
                if (!route) return;
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) navigation.navigate(tab.name);
              }}
              style={{
                flex: 1,
                minHeight: 49,
                gap: 5,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon
                name={tab.icon}
                color={active ? colors.lime : colors.muted}
                size={23}
              />
              <T
                style={{
                  fontSize: 10,
                  fontWeight: active ? "800" : "500",
                  color: active ? colors.lime : colors.muted,
                }}
              >
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: `${tab.label} · DALRO` }}
        />
      ))}
    </Tabs>
  );
}
