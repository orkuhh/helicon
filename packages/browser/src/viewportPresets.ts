import type { ViewportState } from "./types.js";

export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** Common DevTools-style device presets (portrait). */
export const DEVICE_PRESETS: readonly DevicePreset[] = [
  { id: "responsive", label: "Responsive", width: 1280, height: 720 },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667 },
  { id: "iphone-14", label: "iPhone 14", width: 390, height: 844 },
  { id: "pixel-7", label: "Pixel 7", width: 412, height: 915 },
  { id: "ipad", label: "iPad", width: 768, height: 1024 },
  { id: "laptop", label: "Laptop", width: 1366, height: 768 },
  { id: "desktop-hd", label: "Desktop HD", width: 1920, height: 1080 },
];

export function viewportForPreset(presetId: string, zoom = 1): ViewportState {
  const preset = DEVICE_PRESETS.find((p) => p.id === presetId) ?? DEVICE_PRESETS[0];
  return {
    mode: preset.id === "responsive" ? "fill" : "preset",
    width: preset.width,
    height: preset.height,
    presetId: preset.id === "responsive" ? null : preset.id,
    zoom,
  };
}
