import { useEffect } from "react";

export function WebViewport() {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const viewport = existing ?? document.createElement("meta");
    const previous = viewport.content;
    viewport.name = "viewport";
    viewport.content =
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content";
    if (!existing) document.head.append(viewport);
    const style = document.createElement("style");
    style.textContent = `
      html, body { width:100%; height:100%; overflow:hidden; overscroll-behavior:none; }
      body { position:fixed; inset:0; margin:0; height:100dvh; }
      #root { position:fixed; inset:0; display:flex; flex-direction:column; overflow:hidden; touch-action:pan-x pan-y; }
      [data-testid="screen-scroll"] { overscroll-behavior:contain; touch-action:pan-x pan-y; }
      input, textarea, select { font-size:16px !important; }
    `;
    document.head.append(style);
    const stopGesture = (event: Event) => event.preventDefault();
    const stopPagePinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", stopGesture, { passive: false });
    document.addEventListener("gesturechange", stopGesture, { passive: false });
    document.addEventListener("touchmove", stopPagePinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
      document.removeEventListener("touchmove", stopPagePinch);
      style.remove();
      if (existing) viewport.content = previous;
      else viewport.remove();
    };
  }, []);
  return null;
}
