import type { ReactNode } from "react";
import { StyleSheet, View, type GestureResponderHandlers } from "react-native";
import type { Camera } from "../maps/terrain";

export interface MapGestureSurfaceProps {
  children: ReactNode;
  camera: Camera;
  onChange: (camera: Camera) => void;
  panHandlers: GestureResponderHandlers;
}

export function MapGestureSurface({
  children,
  panHandlers,
}: MapGestureSurfaceProps) {
  return (
    <View style={StyleSheet.absoluteFill} {...panHandlers}>
      {children}
    </View>
  );
}
