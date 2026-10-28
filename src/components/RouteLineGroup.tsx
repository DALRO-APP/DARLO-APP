import type { ReactNode } from "react";
import { G } from "react-native-svg";

export interface RouteLineGroupProps {
  id: string;
  onSelect?: () => void;
  children: ReactNode;
}

export function RouteLineGroup({
  id,
  onSelect,
  children,
}: RouteLineGroupProps) {
  return (
    <G testID={`route-line-${id}`} onPress={onSelect}>
      {children}
    </G>
  );
}
