import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import type { Purpose } from "../domain/contracts";
export function Scenery({
  purpose,
  height = 110,
}: {
  purpose: Purpose;
  height?: number;
}) {
  const night = purpose === "NIGHT";
  const forest = purpose === "GREEN";
  const hill = purpose === "POWER";
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 500 180"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id={`sky-${purpose}`} x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0"
            stopColor={night ? "#18223A" : forest ? "#263E31" : "#465764"}
          />
          <Stop offset="1" stopColor="#19291D" />
        </LinearGradient>
      </Defs>
      <Rect width="500" height="180" fill={`url(#sky-${purpose})`} />
      <Circle
        cx="390"
        cy="42"
        r={night ? 13 : 24}
        fill={night ? "#F3EEBF" : "#C6D698"}
        opacity={night ? 1 : 0.6}
      />
      <Path
        d={
          hill
            ? "M0 135 L100 57 L190 99 L277 34 L370 119 L500 62 L500 180 L0 180Z"
            : "M0 98 Q120 72 230 107 T500 85 L500 180 L0 180Z"
        }
        fill="#2D4437"
      />
      {!forest && !hill && (
        <>
          <Path d="M0 115 Q170 100 500 137 L500 180 L0 180Z" fill="#305A66" />
          {[30, 66, 100, 156, 188, 234, 282].map((x, i) => (
            <Rect
              key={x}
              x={x}
              y={95 - (i % 3) * 12}
              width="17"
              height={20 + (i % 3) * 12}
              fill="#14262C"
            />
          ))}
          <Path
            d="M0 138 L500 148"
            stroke="#ADB69A"
            strokeWidth="2"
            opacity={0.5}
          />
        </>
      )}
      <Path
        d="M240 112 Q270 134 172 180 L335 180 Q294 134 257 112Z"
        fill="#84917A"
        opacity={0.7}
      />
      {Array.from({ length: forest ? 12 : 4 }, (_, i) => (
        <Path
          key={i}
          d={`M${i * 47 + 10} 120 v-33 m0 -12 l-17 26 h34 Z m0 -18 l-14 21 h28 Z`}
          fill="#15291D"
          stroke="#15291D"
          strokeWidth="5"
        />
      ))}
      {night && (
        <>
          <Path d="M355 156 V92 h22" stroke="#909B7B" strokeWidth="3" />
          <Circle cx="377" cy="92" r="5" fill="#ECEDA2" />
          <Circle cx="377" cy="92" r="17" fill="#ECEDA2" opacity={0.1} />
        </>
      )}
    </Svg>
  );
}
