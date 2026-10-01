export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoBounds {
  extend(point: KakaoLatLng): void;
}
export interface KakaoMap {
  setBounds(
    bounds: KakaoBounds,
    top?: number,
    right?: number,
    bottom?: number,
    left?: number,
  ): void;
  setCenter(point: KakaoLatLng): void;
  getCenter(): KakaoLatLng;
  relayout(): void;
}
export interface KakaoOverlay {
  setMap(map: KakaoMap | null): void;
}
export interface KakaoCustomOverlay extends KakaoOverlay {
  setPosition(point: KakaoLatLng): void;
}
export interface KakaoMaps {
  load(callback: () => void): void;
  Map: new (
    container: HTMLElement,
    options: {
      center: KakaoLatLng;
      level: number;
      scrollwheel: boolean;
      keyboardShortcuts: boolean;
    },
  ) => KakaoMap;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Polyline: new (options: {
    map: KakaoMap;
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    zIndex: number;
  }) => KakaoOverlay;
  CustomOverlay: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    zIndex: number;
    clickable?: boolean;
  }) => KakaoCustomOverlay;
  event: {
    addListener(
      target: KakaoMap | KakaoOverlay,
      event: string,
      callback: () => void,
    ): void;
    removeListener(
      target: KakaoMap | KakaoOverlay,
      event: string,
      callback: () => void,
    ): void;
  };
}
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

let pending: Promise<KakaoMaps> | undefined;
const SCRIPT_ID = "dalro-kakao-maps-sdk";

// 여러 화면에서 지도를 사용해도 공식 SDK는 한 번만 로드합니다.
export function loadKakaoMaps(key: string): Promise<KakaoMaps> {
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);
  if (pending) return pending;
  const loading = new Promise<KakaoMaps>((resolve, reject) => {
    let settled = false;
    document.getElementById(SCRIPT_ID)?.remove();
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      script.remove();
      reject(
        new Error(
          "카카오 지도 연결에 실패했습니다. JavaScript 키, 카카오맵 API 활성화, 현재 주소의 도메인 등록을 확인해 주세요.",
        ),
      );
    };
    const timer = window.setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        fail();
        return;
      }
      window.kakao.maps.load(() => {
        if (settled) return;
        if (!window.kakao?.maps?.Map) {
          fail();
          return;
        }
        clearTimeout(timer);
        settled = true;
        script.onload = null;
        script.onerror = null;
        resolve(window.kakao.maps);
      });
    };
    document.head.appendChild(script);
  });
  pending = loading.catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
