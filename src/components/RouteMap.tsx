import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFocusEffect } from "expo-router";
import { getKakaoNativeView } from "../../modules/dalro-kakao-map/src/DalroKakaoMapView";
import {
  nativeCamera,
  nativeRoutes,
  nativeRunner,
} from "../maps/native-payload";
import { colors } from "../theme/tokens";
import { RouteMap as OfflineMap, type RouteMapProps } from "./RouteMapOffline";
import { Button, Icon, T } from "./ui";
export type { RouteMapProps } from "./RouteMapOffline";

export function RouteMap(props: RouteMapProps) {
  const [offline, setOffline] = useState(false);
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY;
  const expoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const NativeView = useMemo(
    () => (expoGo || !key ? null : getKakaoNativeView()),
    [expoGo, key],
  );
  if (offline || !key) return <OfflineMap {...props} />;
  if (!NativeView)
    return (
      <View style={[styles.card, { height: props.height ?? 360 }]}>
        <Icon name="map-outline" color={colors.lime} size={30} />
        <T style={{ fontWeight: "800", fontSize: 17 }}>카카오 지도 연결 준비</T>
        <T muted style={{ fontSize: 12, lineHeight: 20, textAlign: "center" }}>
          {expoGo
            ? "Expo Go에는 카카오 지도 SDK가 없어요.\nDALRO 개발 앱을 설치해 열어 주세요."
            : "이 앱에는 지도 모듈이 없어요.\n새 DALRO 개발 빌드를 설치해 주세요."}
        </T>
        <Button
          label="시연 지도 보기"
          secondary
          icon="map-outline"
          onPress={() => setOffline(true)}
        />
      </View>
    );
  return (
    <NativeRouteMap
      {...props}
      apiKey={key}
      NativeView={NativeView}
      onOffline={() => setOffline(true)}
    />
  );
}

type NativeViewType = NonNullable<ReturnType<typeof getKakaoNativeView>>;
function NativeRouteMap({
  courses,
  selectedId,
  onSelect,
  height = 360,
  progress,
  apiKey,
  NativeView,
  onOffline,
}: RouteMapProps & {
  apiKey: string;
  NativeView: NativeViewType;
  onOffline: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [width, setWidth] = useState(320);
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );
  useEffect(() => {
    if (status !== "loading" || !active) return;
    const timer = setTimeout(() => {
      setError(
        "지도 응답을 기다리는 시간이 길어졌어요. 네트워크와 앱 등록을 확인해 주세요.",
      );
      setStatus("error");
    }, 20000);
    return () => clearTimeout(timer);
  }, [status, active, attempt]);
  const selected =
    courses.find((course) => course.id === selectedId) ?? courses[0];
  const routesJson = useMemo(
    () => JSON.stringify(nativeRoutes(courses, selectedId, progress)),
    [courses, selectedId, progress],
  );
  const cameraJson = useMemo(
    () =>
      JSON.stringify(
        nativeCamera(
          (zoom && selected ? [selected] : courses).flatMap(
            (course) => course.geometry.coordinates,
          ),
          width,
          height - 100,
        ),
      ),
    [courses, selected, zoom, width, height],
  );
  const runnerJson = JSON.stringify(nativeRunner(selected, progress));
  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ flex: 1 }}>
        <NativeView
          key={attempt}
          style={{ flex: 1 }}
          appKey={apiKey}
          routesJson={routesJson}
          cameraJson={cameraJson}
          runnerJson={runnerJson}
          active={active && status !== "error"}
          onReady={() => setStatus("ready")}
          onError={({ nativeEvent }) => {
            setError(`${nativeEvent.message} (${nativeEvent.code})`);
            setStatus("error");
          }}
        />
        {status !== "ready" && (
          <View style={styles.overlay}>
            {status === "loading" ? (
              <>
                <ActivityIndicator color={colors.lime} />
                <T>카카오 지도를 불러오고 있어요</T>
              </>
            ) : (
              <>
                <T style={{ fontWeight: "800" }}>
                  카카오 지도를 불러오지 못했어요
                </T>
                <T
                  muted
                  style={{ fontSize: 11, lineHeight: 18, textAlign: "center" }}
                >
                  {error}
                </T>
                <View style={{ width: "100%", flexDirection: "row", gap: 8 }}>
                  <Button
                    style={styles.action}
                    label="지도 다시 시도"
                    secondary
                    icon="refresh"
                    onPress={() => {
                      setStatus("loading");
                      setError("");
                      setAttempt((value) => value + 1);
                    }}
                  />
                  <Button
                    style={styles.action}
                    label="시연 지도 보기"
                    secondary
                    icon="map-outline"
                    onPress={onOffline}
                  />
                </View>
              </>
            )}
          </View>
        )}
      </View>
      {onSelect && courses.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, maxHeight: 40 }}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          {courses.map((course, index) => (
            <Pressable
              key={course.id}
              accessibilityRole="button"
              accessibilityLabel={`${course.name} 지도 선택`}
              accessibilityState={{ selected: course.id === selected?.id }}
              onPress={() => onSelect(course.id)}
              style={[
                styles.choice,
                course.id === selected?.id && { borderColor: colors.lime },
              ]}
            >
              <T style={{ fontSize: 11 }}>
                {index + 1}. {course.name}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Icon name="navigate" color={colors.lime} size={17} />
        <View style={{ flex: 1, gap: 3 }}>
          <T style={{ fontSize: 12 }}>
            {selected?.route_type === "straight"
              ? `${selected.start_label} → ${selected.end_label}`
              : (selected?.start_label ?? "용산구")}
          </T>
          <T muted style={{ fontSize: 10 }}>
            카카오 지도 · 코스 경로는 시연용
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="코스 지도 확대 전환"
          disabled={status !== "ready"}
          onPress={() => setZoom(!zoom)}
          style={{ padding: 8 }}
        >
          <Icon name={zoom ? "contract-outline" : "expand-outline"} size={19} />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  container: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 15,
    gap: 13,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  action: { flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 6 },
  choice: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
