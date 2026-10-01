import Svg, { Ellipse, Path, Circle, G } from "react-native-svg";

// 코드로 그린 DALRO 마스코트. 외부 이미지/네트워크 없이 같은 모습으로 렌더링합니다.
export function Mascot({
  size = 112,
  celebrate = false,
}: {
  size?: number;
  celebrate?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      accessibilityLabel="달로 러닝 마스코트"
    >
      <G transform="rotate(-10 80 80)">
        <Path
          d="M56 113 Q34 148 22 132 Q8 113 24 108 Q34 104 40 114 L53 97"
          fill="#9CF941"
        />
        <Path
          d="M100 110 Q124 145 139 129 Q151 112 132 109 L114 92"
          fill="#9CF941"
        />
        <Circle cx="80" cy="69" r="53" fill="#A5FF4F" />
        <Path d="M29 48 Q71 17 132 54 L130 65 Q69 38 29 59 Z" fill="#F5F4D8" />
        <Ellipse cx="61" cy="70" rx="7" ry="11" fill="#152018" />
        {celebrate ? (
          <Path
            d="M93 63 L84 72 L96 75"
            stroke="#152018"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <Ellipse cx="96" cy="73" rx="7" ry="11" fill="#152018" />
        )}
        <Path d="M70 87 Q79 104 90 88 Z" fill="#152018" />
        <Path
          d={celebrate ? "M41 94 Q13 82 17 65" : "M113 96 Q133 84 136 103"}
          stroke="#A5FF4F"
          strokeWidth="17"
          strokeLinecap="round"
          fill="none"
        />
      </G>
      <Path
        d="M139 20 L145 10 M144 39 L155 36 M13 30 L8 23"
        stroke="#B5FF76"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
