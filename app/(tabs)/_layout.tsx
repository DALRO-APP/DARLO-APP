import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, T } from "../../src/components/ui";
import { colors } from "../../src/theme/tokens";
const tabs = [
  { name: "records", label: "기록", icon: "stats-chart-outline" as const },
  { name: "index", label: "런닝", icon: "play" as const },
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
              <View
                style={
                  tab.name === "index"
                    ? {
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: colors.lime,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: -22,
                        borderWidth: 5,
                        borderColor: colors.background,
                      }
                    : undefined
                }
              >
                <Icon
                  name={tab.icon}
                  color={
                    tab.name === "index"
                      ? colors.background
                      : active
                        ? colors.lime
                        : colors.muted
                  }
                  size={tab.name === "index" ? 20 : 23}
                />
              </View>
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
      initialRouteName="index"
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
