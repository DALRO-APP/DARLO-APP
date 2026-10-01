import { requireNativeView } from "expo";
import { requireOptionalNativeModule } from "expo-modules-core";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";

export interface DalroKakaoMapViewProps extends ViewProps {
  appKey: string;
  routesJson: string;
  cameraJson: string;
  runnerJson: string;
  active: boolean;
  onReady: () => void;
  onError: (event: { nativeEvent: { code: string; message: string } }) => void;
}
let view: ComponentType<DalroKakaoMapViewProps> | undefined;
// Loading this JS file in Expo Go must not try to mount an unavailable native view.
export function getKakaoNativeView(): ComponentType<DalroKakaoMapViewProps> | null {
  if (!requireOptionalNativeModule("DalroKakaoMap")) return null;
  view ??= requireNativeView<DalroKakaoMapViewProps>("DalroKakaoMap");
  return view;
}
