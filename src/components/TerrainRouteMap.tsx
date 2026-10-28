import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import Svg, {
  Circle,
  G,
  Image,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { Position } from "../domain/contracts";
import {
  fitTerrain,
  terrain,
  terrainPoint,
  zoomTerrain,
  type Camera,
} from "../maps/terrain";
import { routeProgress } from "../maps/progress";
import { colors } from "../theme/tokens";
import type { RouteMapProps } from "./RouteMapOffline";
import { Icon, T } from "./ui";
import { RouteLineGroup } from "./RouteLineGroup";

const slopeColors = ["#637B6C", "#B4A474", "#CE9069", "#4C5854"];
const labels: { name: string; position: Position }[] = [
  { name: "남 산", position: [126.9908, 37.5511] },
  { name: "용 산", position: [126.966, 37.536] },
  { name: "이 촌", position: [126.973, 37.522] },
  { name: "한 남", position: [127.003, 37.535] },
  { name: "용산가족공원", position: [126.9845, 37.5205] },
];
const relief = require("../../assets/maps/yongsan-relief.png");

export function TerrainRouteMap({
  courses,
  selectedId,
  onSelect,
  height = 360,
  progress,
  showLabels = true,
}: RouteMapProps) {
  const [layoutWidth, setLayoutWidth] = useState(640);
  const [layers, setLayers] = useState({
    terrain: true,
    roads: true,
    slope: true,
  });
  const [manualCamera, setManualCamera] = useState<{
    key: string;
    camera: Camera;
  } | null>(null);
  const mapHeight = Math.max(140, height - 82);
  const selected = courses.find((c) => c.id === selectedId) ?? courses[0];
  const cameraKey =
    courses.map((c) => c.id).join("|") + `:${layoutWidth}:${mapHeight}`;
  const fitted = useMemo(
    () =>
      fitTerrain(
        courses.flatMap((c) => c.geometry.coordinates),
        layoutWidth / mapHeight,
      ),
    [courses, layoutWidth, mapHeight],
  );
  const camera = manualCamera?.key === cameraKey ? manualCamera.camera : fitted;
  const units = camera.width / layoutWidth;
  const latest = useRef({ camera, cameraKey, units });
  useEffect(() => {
    latest.current = { camera, cameraKey, units };
  }, [camera, cameraKey, units]);
  const drag = useRef({ camera, cameraKey, units });
  const onPanGrant = useCallback(() => {
    drag.current = latest.current;
  }, []);
  const onPanMove = useCallback(
    (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const start = drag.current;
      setManualCamera({
        key: start.cameraKey,
        camera: {
          ...start.camera,
          x: start.camera.x - gesture.dx * start.units,
          y: start.camera.y - gesture.dy * start.units,
        },
      });
    },
    [],
  );
  const pan = useMemo(
    () =>
      // RN의 create는 핸들러를 등록만 한다. ref는 이후 제스처 이벤트에서 읽는다.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
        onPanResponderGrant: onPanGrant,
        onPanResponderMove: onPanMove,
        onPanResponderTerminationRequest: () => true,
      }),
    [onPanGrant, onPanMove],
  );
  const zoom = (factor: number) =>
    setManualCamera({ key: cameraKey, camera: zoomTerrain(camera, factor) });
  const toggle = (layer: keyof typeof layers) =>
    setLayers((s) => ({ ...s, [layer]: !s[layer] }));
  const trail =
    selected && progress !== undefined
      ? routeProgress(selected.geometry.coordinates, progress)
      : null;
  const metres =
    (camera.width * Math.cos((37.53 * Math.PI) / 180)) / layoutWidth;
  const scaleMetres =
    [50, 100, 200, 500, 1000, 2000, 5000].find((n) => n / metres >= 48) ?? 5000;
  const scaleWidth = scaleMetres / metres;
  const linePoints = (points: Position[]) =>
    points
      .map(terrainPoint)
      .map((p) => p.join(","))
      .join(" ");
  const stroke = (n: number) => n * units;
  function endpoint(position: Position, label: string, color: string) {
    const [x, y] = terrainPoint(position);
    return (
      <G>
        <Circle cx={x} cy={y} r={stroke(14)} fill={color} opacity={0.13} />
        <Circle
          cx={x}
          cy={y}
          r={stroke(5)}
          fill={color}
          stroke="#E8F7DD"
          strokeWidth={stroke(2)}
        />
        {showLabels && (
          <>
            <Rect
              x={x - stroke(label.length * 5 + 10)}
              y={y + stroke(14)}
              width={stroke(label.length * 10 + 20)}
              height={stroke(24)}
              rx={stroke(12)}
              fill="#17251D"
              stroke={color}
              strokeWidth={stroke(1)}
            />
            <SvgText
              x={x}
              y={y + stroke(30)}
              fill={color}
              textAnchor="middle"
              fontSize={stroke(10)}
              fontWeight="700"
            >
              {label}
            </SvgText>
          </>
        )}
      </G>
    );
  }
  return (
    <View
      style={[styles.card, { height }]}
      onLayout={(e) => setLayoutWidth(Math.max(1, e.nativeEvent.layout.width))}
      testID="terrain-map"
    >
      <View
        style={{
          height: mapHeight,
          overflow: "hidden",
          backgroundColor: "#101918",
        }}
      >
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
            accessibilityLabel="용산구 공간정보 코스 지도"
          >
            <Rect
              x={camera.x}
              y={camera.y}
              width={camera.width}
              height={camera.height}
              fill="#101918"
            />
            <Path d={terrain.boundary} fill="#192622" />
            {layers.terrain && (
              <>
                <Image
                  href={relief}
                  x={0}
                  y={0}
                  width={terrain.width}
                  height={terrain.height}
                  preserveAspectRatio="none"
                />
                <Path
                  d={terrain.contours}
                  fill="none"
                  stroke="#95A287"
                  strokeWidth={stroke(0.55)}
                  opacity={0.2}
                />
              </>
            )}
            <Path
              d={terrain.parks}
              fill="#314831"
              fillRule="evenodd"
              opacity={0.65}
            />
            <Path
              d={terrain.boundary}
              fill="none"
              stroke="#778F78"
              strokeWidth={stroke(0.75)}
              strokeDasharray={`${stroke(4)} ${stroke(6)}`}
              opacity={0.38}
            />
            {layers.roads &&
              terrain.roads.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={layers.slope ? slopeColors[i] : "#60756B"}
                  strokeWidth={stroke(i === 2 ? 1.05 : 0.8)}
                  opacity={layers.slope && i === 2 ? 0.65 : 0.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            {labels.map((label) => {
              const [x, y] = terrainPoint(label.position);
              return (
                <SvgText
                  key={label.name}
                  x={x}
                  y={y}
                  fill="#A7B8A1"
                  opacity={0.6}
                  textAnchor="middle"
                  fontSize={stroke(label.name.length > 4 ? 9 : 12)}
                  letterSpacing={stroke(2)}
                >
                  {label.name}
                </SvgText>
              );
            })}
            {[...courses]
              .sort(
                (a, b) =>
                  Number(a.id === selected?.id) - Number(b.id === selected?.id),
              )
              .map((course) => {
                const active = course.id === selected?.id;
                const points = linePoints(course.geometry.coordinates);
                return (
                  <RouteLineGroup
                    key={course.id}
                    id={course.id}
                    onSelect={onSelect ? () => onSelect(course.id) : undefined}
                  >
                    <Polyline
                      points={points}
                      fill="none"
                      stroke={active ? colors.lime : "#8CADA0"}
                      strokeWidth={stroke(active ? 15 : 10)}
                      opacity={active ? 0.09 : 0.04}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Polyline
                      points={points}
                      fill="none"
                      stroke="#101918"
                      strokeWidth={stroke(active ? 7 : 5)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Polyline
                      points={points}
                      fill="none"
                      stroke={active ? colors.lime : "#8CADA0"}
                      strokeWidth={stroke(active ? 3.5 : 2)}
                      opacity={active ? 1 : 0.65}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </RouteLineGroup>
                );
              })}
            {selected && selected.signal_positions && (
              <G accessibilityLabel="선택 코스 신호등 위치">
                {selected.signal_positions.map((position, index) => {
                  const [x, y] = terrainPoint(position);
                  return (
                    <Circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={stroke(3.5)}
                      fill="#FF746C"
                      stroke="#241E1B"
                      strokeWidth={stroke(1.2)}
                      accessibilityLabel={`신호등 위치 ${index + 1}`}
                    />
                  );
                })}
              </G>
            )}
            {selected &&
              endpoint(
                selected.geometry.coordinates[0]!,
                selected.route_type === "loop" ? "출발 · 도착" : "출발",
                colors.lime,
              )}
            {selected?.route_type === "straight" &&
              endpoint(
                selected.geometry.coordinates.at(-1)!,
                "도착",
                "#C6B6FF",
              )}
            {trail && (
              <>
                <Polyline
                  points={linePoints(trail.travelled)}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={stroke(4)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle
                  cx={terrainPoint(trail.position)[0]}
                  cy={terrainPoint(trail.position)[1]}
                  r={stroke(7)}
                  fill="white"
                  stroke={colors.lime}
                  strokeWidth={stroke(3)}
                />
              </>
            )}
          </Svg>
        </View>
        <View pointerEvents="none" style={styles.brand}>
          <View style={styles.brandLine}>
            <View style={styles.dot} />
            <T style={styles.brandText}>DALRO TERRAIN</T>
          </View>
        </View>
        <View style={styles.layerRow}>
          {(
            [
              ["terrain", "지형"],
              ["roads", "도로망"],
              ["slope", "경사"],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${label} 레이어`}
              accessibilityState={{ selected: layers[key] }}
              onPress={() => toggle(key)}
              style={[styles.layer, layers[key] && styles.layerActive]}
            >
              <T
                style={{
                  fontSize: 10,
                  color: layers[key] ? "#CDDEBF" : "#7E8D81",
                }}
              >
                {label}
              </T>
            </Pressable>
          ))}
        </View>
        {selected?.signal_positions && (
          <View pointerEvents="none" style={styles.signalCount}>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: "#FF746C",
              }}
            />
            <T style={{ fontSize: 10, color: "#DDE7D5" }}>
              신호등 {selected.signal_positions.length}곳
            </T>
          </View>
        )}
        <View style={styles.controls}>
          <T
            style={{
              color: "#DDE7D5",
              fontSize: 10,
              textAlign: "center",
              marginBottom: 5,
            }}
          >
            N ↑
          </T>
          {(
            [
              ["지도 확대", "add", () => zoom(0.72)],
              ["지도 축소", "remove", () => zoom(1 / 0.72)],
              [
                "코스 지도 확대 전환",
                "scan-outline",
                () =>
                  setManualCamera({
                    key: cameraKey,
                    camera: fitTerrain(
                      (selected ? [selected] : courses).flatMap(
                        (c) => c.geometry.coordinates,
                      ),
                      layoutWidth / mapHeight,
                    ),
                  }),
              ],
            ] as const
          ).map(([label, icon, action]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={action}
              style={styles.control}
            >
              <Icon name={icon} size={17} color="#DAE3D5" />
            </Pressable>
          ))}
        </View>
        <View pointerEvents="none" style={styles.legend}>
          <View
            style={{
              width: scaleWidth,
              borderColor: "#9CAB9D",
              borderBottomWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              height: 4,
            }}
          />
          <T style={{ fontSize: 9, color: "#9CAB9D", marginTop: 4 }}>
            {scaleMetres >= 1000
              ? `${scaleMetres / 1000} km`
              : `${scaleMetres} m`}
          </T>
        </View>
        {courses.length === 0 && (
          <View style={styles.empty}>
            <T muted>추천 코스를 선택해 주세요</T>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.footerMain}>
          <Icon name="navigate" color={colors.lime} size={18} />
          <View style={{ flex: 1, gap: 4 }}>
            <T numberOfLines={1} style={{ fontSize: 12, fontWeight: "700" }}>
              {selected?.route_type === "straight"
                ? `${selected.start_label} → ${selected.end_label}`
                : (selected?.start_label ?? "용산구 공간정보")}
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지도 전체 보기"
            onPress={() => setManualCamera(null)}
            style={{ padding: 10 }}
          >
            <Icon name="expand-outline" size={19} />
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.slopeLegend}>
          {layers.roads && layers.slope ? (
            <>
              <T style={{ fontSize: 9, color: "#8A9B88" }}>평균 지형 경사</T>
              {["<5%", "5–10%", "≥10%", "미측정"].map((label, i) => (
                <View key={label} style={styles.legendItem}>
                  <View
                    style={{
                      width: 10,
                      height: 2,
                      backgroundColor: slopeColors[i],
                    }}
                  />
                  <T style={{ fontSize: 9, color: "#BAC7B4" }}>{label}</T>
                </View>
              ))}
            </>
          ) : (
            <T style={{ fontSize: 9, color: "#8A9B88" }}>
              용산구 도로망 · 공원 · 지형 자료
            </T>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#303C30",
    backgroundColor: colors.panel,
  },
  brand: {
    position: "absolute",
    top: 12,
    left: 15,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#101A17EB",
  },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandText: {
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "800",
    color: "#E2EBD8",
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime },
  layerRow: {
    position: "absolute",
    top: 48,
    left: 15,
    flexDirection: "row",
    gap: 4,
  },
  layer: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334237",
    backgroundColor: "#111B17EB",
  },
  layerActive: { borderColor: "#627854", backgroundColor: "#263723EF" },
  signalCount: {
    position: "absolute",
    top: 83,
    left: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#101A17E8",
  },
  controls: { position: "absolute", right: 12, top: 15, gap: 4 },
  control: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#15201CEB",
    borderColor: "#354237",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    position: "absolute",
    left: 16,
    bottom: 12,
    padding: 3,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: {
    height: 80,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#2B382B",
  },
  footerMain: {
    height: 51,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  slopeLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 24,
  },
  empty: { position: "absolute", bottom: 20, alignSelf: "center" },
});
