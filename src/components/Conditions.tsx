import { useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { Button, Chip, Icon, Panel, T } from "./ui";
import { STARTS } from "../domain/catalog";
import { parseDistanceKm } from "../domain/presentation";
import { usePreferences } from "../state/preferences";
import { colors } from "../theme/tokens";
import { haversine, type Position } from "../domain/contracts";

const distances = [3000, 5000, 7000, 10000];
const placeName = (coordinate: Position) =>
  STARTS.find(
    (s) =>
      s.coordinate[0] === coordinate[0] && s.coordinate[1] === coordinate[1],
  )?.label ?? "선택한 장소";
export function Conditions({ onRecommend }: { onRecommend: () => void }) {
  const request = usePreferences((s) => s.request);
  const update = usePreferences((s) => s.update);
  const [selecting, setSelecting] = useState<"start" | "end" | null>(null);
  const initialDistance = request.target_distance_m ?? 5000;
  const [custom, setCustom] = useState(!distances.includes(initialDistance));
  const [input, setInput] = useState(String(initialDistance / 1000));
  const [attempted, setAttempted] = useState(false);
  const parsed = custom ? parseDistanceKm(input) : request.target_distance_m;
  const other =
    selecting === "end"
      ? request.start
      : request.route_type === "straight"
        ? request.end
        : undefined;
  const location = (field: "start" | "end", coordinate: Position) => (
    <View style={{ gap: 10 }}>
      <T style={{ fontSize: 14, fontWeight: "700" }}>
        {field === "start" ? "출발지" : "목적지"}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={field === "start" ? "출발지 선택" : "목적지 선택"}
        onPress={() => setSelecting(field)}
        style={{
          padding: 17,
          borderRadius: 16,
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.line,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Icon
          name={field === "start" ? "location-outline" : "flag-outline"}
          color={colors.lime}
        />
        <T style={{ flex: 1, fontSize: 14 }}>{placeName(coordinate)}</T>
        <Icon name="chevron-down" size={18} />
      </Pressable>
    </View>
  );
  return (
    <View style={{ gap: 22 }}>
      {location("start", request.start)}
      {request.route_type === "straight" ? (
        <>
          {location("end", request.end)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="출발지와 목적지 바꾸기"
            onPress={() => update({ start: request.end, end: request.start })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 42,
            }}
          >
            <Icon name="swap-vertical" size={18} color={colors.muted} />
            <T muted style={{ fontSize: 12 }}>
              출발지와 목적지 바꾸기
            </T>
          </Pressable>
          <Panel style={{ padding: 17, gap: 7 }}>
            <T style={{ fontWeight: "700", fontSize: 14 }}>
              거리는 자동으로 정해져요
            </T>
            <T muted style={{ fontSize: 12, lineHeight: 19 }}>
              선택한 출발지와 목적지를 잇는 코스를 추천해요.
            </T>
          </Panel>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <T style={{ fontSize: 14, fontWeight: "700" }}>얼마나 달릴까요?</T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="직접 입력"
              accessibilityState={{ selected: custom }}
              aria-pressed={custom}
              onPress={() => {
                setInput(String((request.target_distance_m ?? 5000) / 1000));
                setCustom(true);
              }}
              style={{ paddingVertical: 8, paddingHorizontal: 4 }}
            >
              <T
                style={{
                  fontSize: 12,
                  color: custom ? colors.lime : colors.muted,
                }}
              >
                직접 입력
              </T>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {distances.map((distance) => (
              <Chip
                key={distance}
                label={`${distance / 1000}km`}
                selected={!custom && request.target_distance_m === distance}
                onPress={() => {
                  setCustom(false);
                  update({ target_distance_m: distance });
                }}
              />
            ))}
          </View>
          {custom && (
            <View style={{ gap: 8 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <TextInput
                  accessibilityLabel="직접 입력 거리 (km)"
                  placeholder="1~20"
                  placeholderTextColor={colors.faint}
                  value={input}
                  onChangeText={(value) => {
                    setInput(value);
                    setAttempted(false);
                  }}
                  keyboardType="decimal-pad"
                  maxLength={7}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor:
                      attempted && parsed === null
                        ? colors.danger
                        : colors.line,
                    paddingHorizontal: 14,
                    color: colors.text,
                    fontSize: 16,
                    backgroundColor: colors.panel,
                  }}
                />
                <T muted>km</T>
              </View>
              <T
                style={{
                  fontSize: 11,
                  color:
                    attempted && parsed === null ? colors.danger : colors.muted,
                }}
              >
                {attempted && parsed === null
                  ? "1~20km 사이의 숫자를 입력해 주세요."
                  : "1~20km · 소수점 세 자리까지 입력할 수 있어요."}
              </T>
            </View>
          )}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <T style={{ fontSize: 14, fontWeight: "700" }}>달리는 시간대</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["day", "night"] as const).map((time) => (
            <Chip
              key={time}
              label={time === "day" ? "주간" : "야간"}
              icon={time === "day" ? "sunny-outline" : "moon-outline"}
              selected={request.time_of_day === time}
              onPress={() => update({ time_of_day: time })}
            />
          ))}
        </View>
      </View>
      <T muted style={{ fontSize: 11, lineHeight: 18 }}>
        현재 위치·주소 검색 대신 용산구 시연 장소에서 선택해요.
      </T>
      <Button
        label="코스 추천받기"
        onPress={() => {
          if (request.route_type === "loop") {
            if (parsed === null) {
              setAttempted(true);
              return;
            }
            update({ target_distance_m: parsed });
          }
          onRecommend();
        }}
      />
      <Modal
        visible={selecting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelecting(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000B",
            justifyContent: "center",
            alignItems: "center",
            padding: 22,
          }}
        >
          <Panel style={{ width: "100%", maxWidth: 460, padding: 24, gap: 18 }}>
            <T style={{ fontSize: 22, fontWeight: "700" }}>
              {selecting === "end"
                ? "어디까지 달릴까요?"
                : "어디서 출발할까요?"}
            </T>
            {request.route_type === "straight" && (
              <T muted style={{ fontSize: 12 }}>
                출발지와 목적지는 다른 장소를 선택해 주세요.
              </T>
            )}
            {STARTS.map((place) => {
              const disabled =
                request.route_type === "straight" &&
                !!other &&
                haversine(place.coordinate, other) < 50;
              const current =
                selecting === "end" && request.route_type === "straight"
                  ? request.end
                  : request.start;
              return (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={place.label}
                  disabled={disabled}
                  onPress={() => {
                    update(
                      selecting === "end"
                        ? { end: place.coordinate }
                        : { start: place.coordinate },
                    );
                    setSelecting(null);
                  }}
                  style={{
                    padding: 16,
                    borderWidth: 1,
                    borderColor:
                      haversine(current, place.coordinate) < 1
                        ? colors.lime
                        : colors.line,
                    borderRadius: 14,
                    gap: 6,
                    opacity: disabled ? 0.35 : 1,
                  }}
                >
                  <T style={{ fontWeight: "700" }}>{place.label}</T>
                  <T muted style={{ fontSize: 12 }}>
                    {disabled ? "이미 반대쪽 장소로 선택했어요" : place.detail}
                  </T>
                </Pressable>
              );
            })}
            <Button
              label="닫기"
              secondary
              icon="close"
              onPress={() => setSelecting(null)}
            />
          </Panel>
        </View>
      </Modal>
    </View>
  );
}
