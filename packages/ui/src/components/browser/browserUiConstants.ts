/** DevTools-style device presets (portrait). Kept in UI to avoid a runtime dependency on @helicon/browser. */
export const DEVICE_PRESETS = [
  { id: "responsive", label: "Responsive", width: 1280, height: 720 },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667 },
  { id: "iphone-14", label: "iPhone 14", width: 390, height: 844 },
  { id: "pixel-7", label: "Pixel 7", width: 412, height: 915 },
  { id: "ipad", label: "iPad", width: 768, height: 1024 },
  { id: "laptop", label: "Laptop", width: 1366, height: 768 },
  { id: "desktop-hd", label: "Desktop HD", width: 1920, height: 1080 },
] as const;

export const ZOOM_LADDER = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5] as const;

export const BROWSER_PERMISSIONS = [
  { id: "clipboard-read", label: "Clipboard read" },
  { id: "clipboard-sanitized-write", label: "Clipboard write" },
  { id: "notifications", label: "Notifications" },
  { id: "geolocation", label: "Geolocation" },
] as const;
