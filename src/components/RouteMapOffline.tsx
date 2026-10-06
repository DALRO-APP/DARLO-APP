import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Text as SvgText,
  Polyline,
} from "react-native-svg";
import type { Course, Position } from "../domain/contracts";
import { colors } from "../theme/tokens";
import { Icon, T } from "./ui";
import { routeProgress } from "../maps/progress";

export interface RouteMapProps {
  courses: Course[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  height?: number;
  progress?: number;
  showLabels?: boolean;
}
// 지도 공급자는 이 props 계약을 유지해 Kakao/native 구현으로 교체합니다.
export function RouteMap({
  courses,
  selectedId,
  onSelect,
  height = 360,
  progress,
  showLabels = true,
}: RouteMapProps) {
  const [zoom, setZoom] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(640);
  const selected = courses.find((c) => c.id === selectedId) ?? courses[0];
  const points = (zoom && selected ? [selected] : courses).flatMap(
    (c) => c.geometry.coordinates,
  );
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const width = 640;
  const viewHeight = (height * width) / Math.max(1, layoutWidth);
  const unit = width / Math.max(1, layoutWidth);
  // 지도 안내와 하단 출발지 카드가 경로/출발점을 가리지 않도록 한다.
  const plotHeight = Math.max(60, viewHeight - 142 * unit);
  const centerY = 56 * unit + plotHeight / 2;
  const geoWidth = Math.max(
    (maxX - minX) * Math.cos((((minY + maxY) / 2) * Math.PI) / 180),
    0.006,
  );
  const geoHeight = Math.max(maxY - minY, 0.006);
  const scale = Math.min(
    Math.max(120, width - 64 * unit) / geoWidth,
    plotHeight / geoHeight,
  );
  const project = ([lon, lat]: Position): Position => [
    width / 2 +
      (lon - (minX + maxX) / 2) *
        Math.cos((((minY + maxY) / 2) * Math.PI) / 180) *
        scale,
    centerY - (lat - (minY + maxY) / 2) * scale,
  ];
  const trail =
    selected && progress !== undefined
      ? routeProgress(selected.geometry.coordinates, progress)
      : null;
  const marker = trail ? project(trail.position) : [320, viewHeight / 2];
  return (
    <View
      style={[mapStyles.container, { height }]}
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 640 ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        accessibilityLabel="용산구 오프라인 시연 코스 지도"
      >
        <G transform={`scale(1 ${viewHeight / 360})`}>
          <Rect width="640" height="360" fill="#171E1B" />
          <Path
            d="M-50 210 Q130 145 250 215 T690 260 L690 355 Q450 270 250 290 T-50 300Z"
            fill="#172F38"
          />
          <Path
            d="M-20 207 Q140 150 251 209 T660 259 M-20 301 Q135 238 250 291 T650 351"
            stroke="#35483B"
            strokeWidth="7"
            fill="none"
          />
          <Path
            d="M420 -20 Q480 40 450 94 L516 148 L560 115 L589 55 L530 8Z M26 68 L64 42 L125 75 L102 133 L57 142Z M188 282 L237 301 L280 355 L158 360Z"
            fill="#24392A"
          />
          {Array.from({ length: 21 }, (_, i) => (
            <Path
              key={`road-${i}`}
              d={`M${i * 39 - 100} -20 L${i * 39 + 70} 380 M-50 ${i * 27 - 120} L680 ${i * 27 + 65}`}
              stroke={i % 5 === 0 ? "#3C453E" : "#28312B"}
              strokeWidth={i % 5 === 0 ? 4 : 1.4}
              fill="none"
            />
          ))}
          <Path
            d="M90 -10 L255 380 M500 -20 L350 380 M-20 95 Q300 95 660 180"
            stroke="#4D554B"
            strokeWidth="5"
            opacity={0.65}
            fill="none"
          />
          <SvgText x="90" y="63" fill="#7A897A" fontSize="14">
            용산구
          </SvgText>
          <SvgText x="448" y="82" fill="#72896F" fontSize="13">
            남산
          </SvgText>
          <SvgText
            x="375"
            y="300"
            fill="#628A9D"
            fontSize="17"
            letterSpacing="4"
          >
            한 강
          </SvgText>
          <SvgText x="91" y="332" fill="#82947B" fontSize="12">
            이촌 한강공원
          </SvgText>
        </G>
        {[...courses]
          .sort(
            (a, b) => Number(a.id === selectedId) - Number(b.id === selectedId),
          )
          .map((course) => {
            const active = course.id === selected?.id;
            const projected = course.geometry.coordinates.map(project);
            const first = projected[0]!;
            const last = projected.at(-1)!;
            return (
              <G key={course.id} onPress={() => onSelect?.(course.id)}>
                <Polyline
                  points={projected.map((p) => p.join(",")).join(" ")}
                  stroke={active ? "#ACFF62" : "#6C8970"}
                  strokeWidth={active ? 16 : 10}
                  opacity={active ? 0.1 : 0.05}
                  fill="none"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={projected.map((p) => p.join(",")).join(" ")}
                  stroke={active && !trail ? "#ACFF62" : "#667F64"}
                  strokeWidth={active ? 4.5 : 2.5}
                  opacity={active ? 1 : 0.7}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {active && (
                  <>
                    <Circle
                      cx={first[0]}
                      cy={first[1]}
                      r="10"
                      fill={colors.lime}
                      stroke="#F4FFED"
                      strokeWidth="3"
                    />
                    {course.route_type === "straight" && (
                      <>
                        <Circle
                          cx={last[0]}
                          cy={last[1]}
                          r="10"
                          fill="#C6B6FF"
                          stroke="#F4FFED"
                          strokeWidth="3"
                        />
                        {showLabels && (
                          <SvgText
                            x={last[0]}
                            y={last[1] - 20}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#C6B6FF"
                          >
                            도착
                          </SvgText>
                        )}
                      </>
                    )}
                    {showLabels && (
                      <>
                        <Rect
                          x={first[0] - 21}
                          y={first[1] - 39}
                          width="44"
                          height="22"
                          rx="11"
                          fill="#101710"
                          stroke="#678D3A"
                        />
                        <SvgText
                          x={first[0] + 1}
                          y={first[1] - 24}
                          textAnchor="middle"
                          fontSize="11"
                          fill={colors.lime}
                        >
                          출발
                        </SvgText>
                      </>
                    )}
                  </>
                )}
              </G>
            );
          })}
        {trail && (
          <>
            <Polyline
              points={trail.travelled
                .map(project)
                .map((p) => p.join(","))
                .join(" ")}
              stroke={colors.lime}
              strokeWidth={5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle
              cx={marker[0]}
              cy={marker[1]}
              r="18"
              fill="#FFFFFF"
              opacity={0.12}
            />
            <Circle
              cx={marker[0]}
              cy={marker[1]}
              r="7"
              fill="#FFFFFF"
              stroke={colors.lime}
              strokeWidth="3"
            />
          </>
        )}
      </Svg>
      <View style={mapStyles.label}>
        <View style={mapStyles.dot} />
        <T style={{ fontSize: 11, color: colors.muted }}>용산구 · 시연 지도</T>
      </View>
      <View style={mapStyles.bottom}>
        <Icon name="navigate" color={colors.lime} size={17} />
        <T style={{ fontSize: 12, fontWeight: "600", flex: 1 }}>
          {selected?.route_type === "straight"
            ? `${selected.start_label} → ${selected.end_label}`
            : (selected?.start_label ?? "추천 코스를 선택해 주세요")}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="코스 지도 확대 전환"
          onPress={() => setZoom(!zoom)}
          style={mapStyles.recenter}
        >
          <Icon name={zoom ? "contract-outline" : "expand-outline"} size={19} />
        </Pressable>
      </View>
    </View>
  );
}
const mapStyles = StyleSheet.create({
  container: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#17201A",
  },
  label: {
    position: "absolute",
    top: 15,
    left: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0C0E0DE8",
    borderRadius: 10,
    padding: 10,
  },
  dot: { height: 5, width: 5, backgroundColor: colors.lime, borderRadius: 3 },
  bottom: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#10160FEF",
    padding: 10,
    borderRadius: 13,
  },
  recenter: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#293126",
  },
});
