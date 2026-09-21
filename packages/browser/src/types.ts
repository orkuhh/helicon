export type BrowserController = "none" | "human" | "agent";

export type ColorScheme = "system" | "light" | "dark";

export type ViewportMode = "fill" | "freeform" | "preset";

export interface ViewportState {
  mode: ViewportMode;
  width: number;
  height: number;
  presetId: string | null;
  zoom: number;
}

export interface BrowserTabSnapshot {
  tabId: string;
  url: string;
  title: string;
  loading: boolean;
  failed: string | null;
  profileId: string;
  muted: boolean;
  audible: boolean;
  controller: BrowserController;
  viewport: ViewportState;
  colorScheme: ColorScheme;
  faviconDataUrl: string | null;
}

export interface ConsoleEntry {
  level: string;
  text: string;
  timestamp: number;
  source?: string;
}

export interface NetworkEntry {
  url: string;
  method: string;
  status: number | null;
  failed: boolean;
  errorText?: string;
  timestamp: number;
}

export interface InteractiveNode {
  role: string;
  name: string;
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface AutomationSnapshot {
  url: string;
  title: string;
  loading: boolean;
  visibleText: string;
  interactive: InteractiveNode[];
  axTree: unknown;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  pngBase64: string;
}

export interface BrowserProfile {
  id: string;
  name: string;
  persistent: boolean;
  builtIn: boolean;
}

export interface DiscoveredServer {
  url: string;
  title: string | null;
  port: number;
  source: "lsof" | "probe" | "configured";
}

export interface BrowserDownload {
  id: string;
  tabId: string;
  url: string;
  suggestedFilename: string;
  path: string;
  at: string;
}

export interface FramePayload {
  tabId: string;
  dataUrl: string;
  width: number;
  height: number;
  at: number;
}

export type BrowserPermission = "clipboard-read" | "clipboard-sanitized-write" | "notifications" | "geolocation";

export interface BrowserDefaults {
  profileId: string;
  viewport: ViewportState;
  colorScheme: ColorScheme;
  autoShowFloatingPreview: boolean;
  recordingShowKeyPresses: boolean;
  recordingShowMousePresses: boolean;
  downloadDir: string | null;
  configuredLocalUrls: string[];
  grantedPermissions: BrowserPermission[];
}

export const DEFAULT_VIEWPORT: ViewportState = {
  mode: "fill",
  width: 1280,
  height: 720,
  presetId: null,
  zoom: 1,
};

export const DEFAULT_BROWSER_DEFAULTS: BrowserDefaults = {
  profileId: "default",
  viewport: { ...DEFAULT_VIEWPORT },
  colorScheme: "system",
  autoShowFloatingPreview: true,
  recordingShowKeyPresses: true,
  recordingShowMousePresses: true,
  downloadDir: null,
  configuredLocalUrls: [],
  grantedPermissions: [],
};

export const ZOOM_LADDER = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5] as const;

export const MAX_VIEWPORT_AREA = 3840 * 2160;
export const MIN_VIEWPORT_DIM = 240;
