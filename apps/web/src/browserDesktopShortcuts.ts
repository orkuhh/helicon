import { captureOsSnapshot } from "./browserDesktop.js";

/** OS SnapShot (slice 16): desktop global hook via window keydown when Helicon is focused. */
export function bindBrowserDesktopShortcuts(): void {
  window.addEventListener(
    "keydown",
    (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || !event.shiftKey || event.key.toLowerCase() !== "s" || event.altKey) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      void captureOsSnapshot().then((png) => {
        if (!png) {
          return;
        }
        window.dispatchEvent(new CustomEvent("helicon-os-snapshot", { detail: { pngBase64: png } }));
      });
    },
    true,
  );
}
