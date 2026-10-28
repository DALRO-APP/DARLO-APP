import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { notify } from "./notify";
import { Button, Chip, Icon, Panel, Status, T } from "./ui";
import { STARTS } from "../domain/catalog";
import { parseDistanceKm, placeLabel } from "../domain/presentation";
import { usePlaceSearch, useRecommendations } from "../services/queries";
import { usePreferences } from "../state/preferences";
import { colors } from "../theme/tokens";
import { haversine, type Position } from "../domain/contracts";

const distances = [3000, 5000, 7000, 10000];
// 저장·코스 ID가 같은 좌표를 다시 만들 수 있도록 소수 6자리(약 0.1m)로 맞춘다.
const round = (p: Position): Position => [
  Math.round(p[0] * 1e6) / 1e6,
  Math.round(p[1] * 1e6) / 1e6,
];
interface Option {
  key: string;
  name: string;
  detail: string;
  position: Position;
  start_position: Position | null;
  in_service_area: boolean;
  serviceArea?: string;
}
export function Conditions({ onRecommend }: { onRecommend: () => void }) {
  const request = usePreferences((s) => s.request);
  const update = usePreferences((s) => s.update);
  const preview = useRecommendations(request.route_type === "straight");
  const firstCourse = preview.data?.courses[0];
  const [selecting, setSelecting] = useState<"start" | "end" | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const searching = debounced.trim().length > 0;
  const search = usePlaceSearch(debounced);
  const close = () => {
    setSelecting(null);
    setQuery("");
    setDebounced("");
  };
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
  const current =
    selecting === "end" && request.route_type === "straight"
      ? request.end
      : request.start;
  const choose = (place: Option) => {
    const area = place.serviceArea ?? "서울 용산구";
    if (!place.in_service_area)
      return notify(
        "베타 서비스 지역이 아니에요",
        `DALRO 베타 버전은 ${area} 안에서만 코스를 추천해요. ${area} 안의 장소를 검색해 주세요.`,
      );
    if (!place.start_position)
      return notify(
        "출발할 도로를 찾지 못했어요",
        "이 장소 근처 300m 안에 달릴 수 있는 도로가 없어요. 가까운 다른 장소를 골라 주세요.",
      );
    const position = round(place.start_position);
    update(
      selecting === "end"
        ? { end: position, end_label: place.name }
        : { start: position, start_label: place.name },
    );
    close();
  };
  const option = (place: Option) => {
    const disabled =
      request.route_type === "straight" &&
      !!other &&
      !!place.start_position &&
      haversine(place.start_position, other) < 50;
    return (
      <Pressable
        key={place.key}
        accessibilityRole="button"
        accessibilityLabel={place.name}
        disabled={disabled}
        onPress={() => choose(place)}
        style={{
          padding: 16,
          borderWidth: 1,
          borderColor:
            place.start_position && haversine(current, place.start_position) < 1
              ? colors.lime
              : colors.line,
          borderRadius: 14,
          gap: 6,
          opacity: disabled ? 0.35 : place.in_service_area ? 1 : 0.6,
        }}
      >
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <T style={{ flex: 1, fontWeight: "700" }}>{place.name}</T>
          {!place.in_service_area && (
            <T style={{ fontSize: 11, color: colors.muted }}>베타 지역 밖</T>
          )}
        </View>
        <T muted style={{ fontSize: 12 }}>
          {disabled ? "이미 반대쪽 장소로 선택했어요" : place.detail}
        </T>
      </Pressable>
    );
  };
  const location = (field: "start" | "end") => (
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
        <T style={{ flex: 1, fontSize: 14 }}>{placeLabel(request, field)}</T>
        <Icon name="chevron-down" size={18} />
      </Pressable>
    </View>
  );
  return (
    <View style={{ gap: 22 }}>
      {location("start")}
      {request.route_type === "straight" ? (
        <>
          {location("end")}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="출발지와 목적지 바꾸기"
            onPress={() =>
              update({
                start: request.end,
                end: request.start,
                start_label: request.end_label,
                end_label: request.start_label,
              })
            }
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
          <Panel
            testID="straight-distance-preview"
            style={{ padding: 17, gap: 9 }}
          >
            <T muted style={{ fontSize: 12 }}>
              예상 거리
            </T>
            {preview.isPending ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <ActivityIndicator size="small" color={colors.lime} />
                <T muted style={{ fontSize: 14 }}>
                  거리 계산 중이에요
                </T>
              </View>
            ) : preview.isError ? (
              <>
                <T style={{ fontSize: 14 }}>거리를 불러오지 못했어요</T>
                <T muted style={{ fontSize: 12 }}>
                  {preview.error.message}
                </T>
                <Chip
                  label="거리 다시 계산"
                  icon="refresh"
                  onPress={() => void preview.refetch()}
                />
              </>
            ) : firstCourse ? (
              <>
                <T accent style={{ fontSize: 28, fontWeight: "800" }}>
                  약 {(firstCourse.summary.distance_m / 1000).toFixed(1)} km
                </T>
                <T muted style={{ fontSize: 12, lineHeight: 19 }}>
                  첫 번째 추천 코스 기준 · 선택한 출발지와 목적지를 잇는
                  거리예요.
                </T>
                {firstCourse.is_mock && (
                  <T muted style={{ fontSize: 11 }}>
                    더미 코스 기준 예상 거리예요.
                  </T>
                )}
              </>
            ) : (
              <>
                <T style={{ fontSize: 14 }}>연결 가능한 코스가 없어요</T>
                <T muted style={{ fontSize: 12 }}>
                  출발지나 목적지를 바꿔 주세요.
                </T>
              </>
            )}
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
        장소를 검색해 고를 수 있어요 · 베타 버전은 서울 용산구 안에서만
        추천해요.
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
        onRequestClose={close}
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
          <Panel style={{ width: "100%", maxWidth: 460, padding: 24, gap: 14 }}>
            <T style={{ fontSize: 22, fontWeight: "700" }}>
              {selecting === "end"
                ? "어디까지 달릴까요?"
                : "어디서 출발할까요?"}
            </T>
            <TextInput
              accessibilityLabel="장소 검색"
              placeholder="장소·역·도로명 검색"
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              style={{
                minHeight: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.line,
                paddingHorizontal: 14,
                color: colors.text,
                fontSize: 16,
                backgroundColor: colors.elevated,
              }}
            />
            <T muted style={{ fontSize: 12, lineHeight: 18 }}>
              베타 버전은 서울 용산구 안에서만 코스를 추천해요.
              {request.route_type === "straight"
                ? " 출발지와 목적지는 다른 장소를 선택해 주세요."
                : ""}
            </T>
            <ScrollView
              style={{ maxHeight: 340 }}
              contentContainerStyle={{ gap: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              {!searching ? (
                <>
                  <T muted style={{ fontSize: 12 }}>
                    시연 장소
                  </T>
                  {STARTS.map((place) =>
                    option({
                      key: place.id,
                      name: place.label,
                      detail: place.detail,
                      position: place.coordinate,
                      start_position: place.coordinate,
                      in_service_area: true,
                    }),
                  )}
                </>
              ) : search.isPending ? (
                <ActivityIndicator color={colors.lime} />
              ) : search.isError ? (
                <Status
                  title="장소를 검색하지 못했어요"
                  message={search.error.message}
                  onRetry={() => void search.refetch()}
                />
              ) : (
                <>
                  {search.data.places.length === 0 && (
                    <T muted style={{ fontSize: 13 }}>
                      검색 결과가 없어요. 다른 이름으로 찾아 주세요.
                    </T>
                  )}
                  {search.data.places.map((place) =>
                    option({
                      key: place.id,
                      name: place.name,
                      detail: place.address,
                      position: place.position,
                      start_position: place.start_position,
                      in_service_area: place.in_service_area,
                      serviceArea: search.data.service_area,
                    }),
                  )}
                  {search.data.notice && (
                    <T muted style={{ fontSize: 11, lineHeight: 17 }}>
                      {search.data.notice}
                    </T>
                  )}
                </>
              )}
            </ScrollView>
            <Button label="닫기" secondary icon="close" onPress={close} />
          </Panel>
        </View>
      </Modal>
    </View>
  );
}
