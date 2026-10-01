import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PURPOSES, STARTS } from "../domain/catalog";
import type { Purpose } from "../domain/contracts";
import { usePreferences } from "../state/preferences";
import { colors } from "../theme/tokens";
import { Button, Chip, Icon, T, useWide } from "./ui";
export function Conditions() {
  const wide = useWide();
  const request = usePreferences((s) => s.request);
  const update = usePreferences((s) => s.update);
  const [selecting, setSelecting] = useState(false);
  const start = STARTS.find(
    (s) =>
      s.coordinate[0] === request.start[0] &&
      s.coordinate[1] === request.start[1],
  );
  return (
    <View style={{ gap: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="출발지 선택"
        onPress={() => setSelecting(true)}
        style={conditionStyles.location}
      >
        <View style={conditionStyles.locationIcon}>
          <Icon name="location" color={colors.lime} size={21} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T muted style={{ fontSize: 10, letterSpacing: 1 }}>
            START FROM
          </T>
          <T style={{ fontWeight: "700", fontSize: 14 }}>
            {start?.label ?? "선택한 출발지"}
          </T>
        </View>
        <T muted style={{ fontSize: 11 }}>
          변경
        </T>
        <Icon name="chevron-down" color={colors.muted} size={16} />
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {wide && (
          <T muted style={{ fontSize: 12, marginRight: 4 }}>
            목표 거리
          </T>
        )}
        {[3000, 5000, 8000].map((distance) => (
          <Chip
            key={distance}
            label={`${distance / 1000}km`}
            selected={request.target_distance_m === distance}
            onPress={() => update({ target_distance_m: distance })}
          />
        ))}
        <View style={{ flex: 1 }} />
        <Chip
          label={request.time_of_day === "day" ? "주간" : "야간"}
          icon={
            request.time_of_day === "day" ? "sunny-outline" : "moon-outline"
          }
          selected={false}
          onPress={() =>
            update({
              time_of_day: request.time_of_day === "day" ? "night" : "day",
            })
          }
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {(Object.keys(PURPOSES) as Purpose[]).map((purpose) => (
          <Chip
            key={purpose}
            label={PURPOSES[purpose].label}
            icon={PURPOSES[purpose].icon}
            selected={request.purpose === purpose}
            onPress={() => update({ purpose })}
          />
        ))}
      </ScrollView>
      <Modal
        visible={selecting}
        transparent
        animationType="fade"
        onRequestClose={() => setSelecting(false)}
      >
        <View style={conditionStyles.overlay}>
          <View style={conditionStyles.modal}>
            <T style={{ fontSize: 23, fontWeight: "800" }}>
              어디서 출발할까요?
            </T>
            <T muted style={{ lineHeight: 21 }}>
              시연 출발지를 선택해 주세요.{"\n"}현재 위치 연결은 다음 단계에서
              추가합니다.
            </T>
            {STARTS.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                onPress={() => {
                  update({ start: s.coordinate });
                  setSelecting(false);
                }}
                style={[
                  conditionStyles.location,
                  start?.id === s.id && { borderColor: colors.lime },
                ]}
              >
                <Icon name="location-outline" color={colors.lime} />
                <View style={{ gap: 5 }}>
                  <T style={{ fontWeight: "700" }}>{s.label}</T>
                  <T muted style={{ fontSize: 11 }}>
                    {s.detail}
                  </T>
                </View>
              </Pressable>
            ))}
            <Button
              label="닫기"
              secondary
              icon="close"
              onPress={() => setSelecting(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const conditionStyles = StyleSheet.create({
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  locationIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#283720",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#000000B8",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modal: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 26,
    padding: 24,
    gap: 18,
  },
});
