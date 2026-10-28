import type { RouteLineGroupProps } from "./RouteLineGroup";

// SVG의 native touchable mixin을 거치지 않고 DOM 클릭을 연결한다.
export function RouteLineGroup({
  id,
  onSelect,
  children,
}: RouteLineGroupProps) {
  return (
    <g
      data-testid={`route-line-${id}`}
      onClick={onSelect}
      style={{ cursor: onSelect ? "pointer" : undefined }}
    >
      {children}
    </g>
  );
}
