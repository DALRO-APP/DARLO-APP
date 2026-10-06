import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { Position } from "../domain/contracts";
import {
  loadKakaoMaps,
  type KakaoMap,
  type KakaoMaps,
  type KakaoOverlay,
} from "../maps/kakao.web";
import { colors } from "../theme/tokens";
import {
  RouteMap as OfflineRouteMap,
  type RouteMapProps,
} from "./RouteMapOffline";
import { Button, Icon, T } from "./ui";
import { routeProgress } from "../maps/progress";
export type { RouteMapProps } from "./RouteMapOffline";

function marker(text: string, color: string): HTMLDivElement {
  const element = document.createElement("div");
  element.textContent = text;
  Object.assign(element.style, {
    padding: "7px 11px",
    borderRadius: "14px",
    border: "2px solid #F4FFED",
    background: color,
    color: "#14200F",
    font: "800 12px system-ui",
    boxShadow: "0 2px 10px #0005",
    whiteSpace: "nowrap",
  });
  return element;
}

export function RouteMap(props: RouteMapProps) {
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY;
  return key ? (
    <KakaoRouteMap {...props} apiKey={key} />
  ) : (
    <OfflineRouteMap {...props} />
  );
}

function KakaoRouteMap({
  courses,
  selectedId,
  onSelect,
  height = 360,
  progress,
  showLabels = true,
  apiKey,
}: RouteMapProps & { apiKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<KakaoMap | null>(null);
  const sdk = useRef<KakaoMaps | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [offline, setOffline] = useState(false);
  const selected = courses.find((c) => c.id === selectedId) ?? courses[0];
  const initialPosition = useRef<Position>(
    selected?.geometry.coordinates[0] ?? [126.9745, 37.5178],
  );

  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    void loadKakaoMaps(apiKey)
      .then((maps) => {
        if (cancelled || !container.current) return;
        sdk.current = maps;
        const [lon, lat] = initialPosition.current;
        const instance = new maps.Map(container.current, {
          center: new maps.LatLng(lat, lon),
          level: 5,
          scrollwheel: false,
          keyboardShortcuts: true,
        });
        map.current = instance;
        observer = new ResizeObserver(() => {
          const center = instance.getCenter();
          instance.relayout();
          instance.setCenter(center);
        });
        observer.observe(container.current);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    const element = container.current;
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current = null;
      sdk.current = null;
      element?.replaceChildren();
    };
  }, [apiKey, attempt, offline]);

  useEffect(() => {
    if (status !== "ready" || !sdk.current || !map.current) return;
    const maps = sdk.current;
    const instance = map.current;
    const overlays: { overlay: KakaoOverlay; click?: () => void }[] = [];
    const point = ([lon, lat]: Position) => new maps.LatLng(lat, lon);
    [...courses]
      .sort(
        (a, b) => Number(a.id === selected?.id) - Number(b.id === selected?.id),
      )
      .forEach((course) => {
        const active = course.id === selected?.id;
        const line = new maps.Polyline({
          map: instance,
          path: course.geometry.coordinates.map(point),
          strokeWeight: active ? 6 : 4,
          strokeColor: active ? colors.lime : "#587D56",
          strokeOpacity: active ? 1 : 0.55,
          zIndex: active ? 3 : 2,
        });
        const click = () => onSelect?.(course.id);
        maps.event.addListener(line, "click", click);
        overlays.push({ overlay: line, click });
      });
    if (selected) {
      const start = new maps.CustomOverlay({
        map: instance,
        position: point(selected.geometry.coordinates[0]!),
        content: marker(
          showLabels
            ? selected.route_type === "straight"
              ? "● 출발"
              : "● 출발 · 도착"
            : "●",
          colors.lime,
        ),
        yAnchor: 1.25,
        zIndex: 5,
      });
      overlays.push({ overlay: start });
      if (selected.route_type === "straight") {
        const end = new maps.CustomOverlay({
          map: instance,
          position: point(selected.geometry.coordinates.at(-1)!),
          content: marker(showLabels ? "● 도착" : "●", "#C6B6FF"),
          yAnchor: 1.3,
          zIndex: 4,
        });
        overlays.push({ overlay: end });
      }
    }
    return () => {
      overlays.forEach(({ overlay, click }) => {
        if (click) maps.event.removeListener(overlay, "click", click);
        overlay.setMap(null);
      });
    };
  }, [courses, selected, onSelect, showLabels, status]);

  useEffect(() => {
    if (status !== "ready" || !sdk.current || !map.current) return;
    const maps = sdk.current;
    const bounds = new maps.LatLngBounds();
    const visible = zoom && selected ? [selected] : courses;
    const points = visible.flatMap((c) => c.geometry.coordinates);
    points.forEach(([lon, lat]) => bounds.extend(new maps.LatLng(lat, lon)));
    if (points.length) map.current.setBounds(bounds, 45, 30, 35, 30);
  }, [courses, selected, zoom, status]);

  useEffect(() => {
    if (
      status !== "ready" ||
      !sdk.current ||
      !map.current ||
      progress === undefined ||
      !selected
    )
      return;
    const maps = sdk.current;
    const trail = routeProgress(selected.geometry.coordinates, progress);
    if (!trail) return;
    const travelled = new maps.Polyline({
      map: map.current,
      path: trail.travelled.map(([lon, lat]) => new maps.LatLng(lat, lon)),
      strokeWeight: 7,
      strokeColor: "#FFFFFF",
      strokeOpacity: 1,
      zIndex: 4,
    });
    const [lon, lat] = trail.position;
    const moving = new maps.CustomOverlay({
      map: map.current,
      position: new maps.LatLng(lat, lon),
      content: marker("달로", "#FFFFFF"),
      yAnchor: 0.5,
      zIndex: 6,
    });
    return () => {
      moving.setMap(null);
      travelled.setMap(null);
    };
  }, [selected, progress, status]);

  if (offline)
    return (
      <OfflineRouteMap
        courses={courses}
        selectedId={selectedId}
        onSelect={onSelect}
        height={height}
        progress={progress}
        showLabels={showLabels}
      />
    );
  return (
    <View style={[styles.card, { height }]}>
      <View style={{ flex: 1, position: "relative" }}>
        <div
          ref={container}
          data-testid="kakao-map"
          data-map-status={status}
          aria-label="카카오 지도"
          style={{ position: "absolute", inset: 0, backgroundColor: "#E8EADB" }}
        />
        {status !== "ready" && (
          <View style={styles.status}>
            {status === "loading" ? (
              <>
                <ActivityIndicator color={colors.lime} />
                <T>카카오 지도를 불러오고 있어요</T>
              </>
            ) : (
              <>
                <Icon name="map-outline" color={colors.lime} size={28} />
                <T style={{ fontWeight: "700" }}>
                  카카오 지도를 불러오지 못했어요
                </T>
                <T
                  muted
                  style={{ fontSize: 11, lineHeight: 18, textAlign: "center" }}
                >
                  JavaScript 키와 지도 사용 설정,{"\n"}현재 주소의 도메인 등록을
                  확인해 주세요.
                </T>
                <T muted style={{ fontSize: 11 }}>
                  {window.location.origin}
                </T>
                <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
                  <Button
                    label="지도 다시 시도"
                    secondary
                    icon="refresh"
                    style={styles.action}
                    onPress={() => {
                      setStatus("loading");
                      setAttempt((a) => a + 1);
                    }}
                  />
                  <Button
                    label="시연 지도 보기"
                    secondary
                    icon="map-outline"
                    style={styles.action}
                    onPress={() => setOffline(true)}
                  />
                </View>
              </>
            )}
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <Icon name="navigate" color={colors.lime} size={17} />
        <View style={{ flex: 1, gap: 3 }}>
          <T style={{ fontSize: 12, fontWeight: "700" }}>
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
          style={{ padding: 10 }}
        >
          <Icon name={zoom ? "contract-outline" : "expand-outline"} size={19} />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  action: { flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 6 },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.panel,
  },
  footer: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  status: {
    position: "absolute",
    inset: 0,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    padding: 15,
  },
});
