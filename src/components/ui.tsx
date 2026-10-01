import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ScrollView,
  Text,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type TextProps,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "../theme/tokens";

export function T({
  style,
  muted,
  accent,
  ...props
}: TextProps & { muted?: boolean; accent?: boolean }) {
  return (
    <Text
      {...props}
      style={[
        styles.text,
        muted && { color: colors.muted },
        accent && { color: colors.lime },
        style,
      ]}
    />
  );
}
export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Panel({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.panel, style]} />;
}
export function Button({
  label,
  onPress,
  icon = "arrow-forward",
  secondary,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  secondary?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <T
        style={{
          fontSize: 15,
          fontWeight: "800",
          color: secondary ? colors.text : colors.background,
        }}
      >
        {label}
      </T>
      <Icon
        name={icon}
        size={20}
        color={secondary ? colors.text : colors.background}
      />
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      aria-pressed={!!selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={17}
          color={selected ? colors.background : colors.muted}
        />
      )}
      <T
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: selected ? colors.background : colors.muted,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>{children}</View>
    </ScrollView>
  );
}
export function SectionTitle({
  title,
  caption,
  action,
  onPress,
}: {
  title: string;
  caption?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.8 }}>
          {title}
        </T>
        {caption && (
          <T muted style={{ fontSize: 12, marginTop: 5 }}>
            {caption}
          </T>
        )}
      </View>
      {action && (
        <Pressable onPress={onPress} accessibilityRole="button">
          <T muted style={{ fontSize: 12 }}>
            {action} ↗
          </T>
        </Pressable>
      )}
    </View>
  );
}
export function Status({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Panel style={{ padding: 28, gap: 12, alignItems: "center" }}>
      <Icon
        name={onRetry ? "cloud-offline-outline" : "trail-sign-outline"}
        color={colors.lime}
        size={32}
      />
      <T style={{ fontSize: 17, fontWeight: "700" }}>{title}</T>
      {message && (
        <T muted style={{ textAlign: "center", lineHeight: 22 }}>
          {message}
        </T>
      )}
      {onRetry && <Button label="다시 시도" onPress={onRetry} icon="refresh" />}
    </Panel>
  );
}
export function useWide() {
  return useWindowDimensions().width >= 850;
}
export function Glow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={["#25371D", "#171B17"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.panel, style]}
    >
      {children}
    </LinearGradient>
  );
}
export const styles = StyleSheet.create({
  text: { color: colors.text },
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
  },
  button: {
    minHeight: 52,
    backgroundColor: colors.lime,
    borderRadius: 16,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  secondary: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chip: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.elevated,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  chipSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
  screen: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 36 },
  container: { width: "100%", maxWidth: 1180, alignSelf: "center", gap: 26 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
});
