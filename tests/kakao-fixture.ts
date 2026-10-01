import { test as base, expect, type Page } from "@playwright/test";

// SDK의 DOM/좌표/이벤트 경계만 모사한다. 실제 카카오 인증·타일 성공을 의미하지 않는다.
const sdkStub = `(() => {
  const state = window.__kakaoTest = { maps: [], paths: [], overlays: [], bounds: [] };
  class LatLng { constructor(lat, lon) { this.lat = lat; this.lon = lon; } getLat() { return this.lat; } getLng() { return this.lon; } }
  class LatLngBounds { constructor() { this.points = []; } extend(point) { this.points.push(point); } }
  class Map {
    constructor(container, options) { this.container = container; this.center = options.center; state.maps.push(this); }
    setBounds(bounds) { state.bounds.push(bounds.points); }
    setCenter(point) { this.center = point; }
    getCenter() { return this.center; }
    relayout() {}
  }
  class Overlay {
    constructor(options) { this.options = options; this.map = options.map; this.listeners = {}; state.overlays.push(this); }
    setMap(map) { this.map = map; }
    setPosition(point) { this.options.position = point; }
  }
  class Polyline extends Overlay { constructor(options) { super(options); state.paths.push(this); } }
  window.kakao = { maps: { load(callback) { callback(); }, Map, LatLng, LatLngBounds, Polyline, CustomOverlay: Overlay,
    event: { addListener(target, name, callback) { target.listeners[name] = callback; }, removeListener(target, name) { delete target.listeners[name]; } }
  } };
})();`;

export async function mockKakaoSdk(page: Page, failFirst = false) {
  let requests = 0;
  await page.route("https://dapi.kakao.com/v2/maps/sdk.js?*", async (route) => {
    requests++;
    if (failFirst && requests === 1) await route.abort("failed");
    else
      await route.fulfill({
        contentType: "application/javascript",
        body: sdkStub,
      });
  });
  return () => requests;
}

// 모든 시연 E2E가 카카오 외부 서비스 가용성과 무관하게 재현되도록 한다.
export const test = base.extend<{ sdkMock: void }>({
  sdkMock: [
    async ({ page }, use) => {
      await mockKakaoSdk(page);
      await use();
    },
    { auto: true },
  ],
});
export { expect };
