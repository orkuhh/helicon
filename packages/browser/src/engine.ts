import type { BrowserContextMenuAction, BrowserContextMenuProbe } from "./editingContext.js";
import type {
  AutomationSnapshot,
  BrowserDownload,
  BrowserTabSnapshot,
  ColorScheme,
  FramePayload,
  ViewportState,
} from "./types.js";

export interface NavigateInput {
  url?: string;
  environmentPort?: { port: number; path?: string };
}

export interface ClickInput {
  locator?: string;
  selector?: string;
  x?: number;
  y?: number;
}

export interface TypeInput {
  locator?: string;
  selector?: string;
  text: string;
  clear?: boolean;
}

export interface PressInput {
  key: string;
  alt?: boolean;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export interface ScrollInput {
  deltaX: number;
  deltaY: number;
  selector?: string;
}

export interface EvaluateInput {
  expression: string;
  awaitPromise?: boolean;
}

export interface WaitForInput {
  locator?: string;
  text?: string;
  urlIncludes?: string;
  timeoutMs?: number;
}

export interface OpenTabInput {
  tabId?: string;
  url?: string;
  profileId?: string;
}

export interface BrowserEngine {
  readonly ready: boolean;
  ensureInstalled(): Promise<void>;
  openTab(input: OpenTabInput): Promise<BrowserTabSnapshot>;
  closeTab(tabId: string): Promise<void>;
  listTabs(): Promise<BrowserTabSnapshot[]>;
  navigate(tabId: string, input: NavigateInput): Promise<BrowserTabSnapshot>;
  goBack(tabId: string): Promise<BrowserTabSnapshot>;
  goForward(tabId: string): Promise<BrowserTabSnapshot>;
  reload(tabId: string, hard?: boolean): Promise<BrowserTabSnapshot>;
  stopLoading(tabId: string): Promise<BrowserTabSnapshot>;
  setViewport(tabId: string, viewport: ViewportState): Promise<BrowserTabSnapshot>;
  setColorScheme(tabId: string, scheme: ColorScheme): Promise<BrowserTabSnapshot>;
  setMuted(tabId: string, muted: boolean): Promise<BrowserTabSnapshot>;
  captureScreenshot(tabId: string): Promise<Buffer>;
  probeContextMenu(tabId: string, x: number, y: number): Promise<BrowserContextMenuProbe>;
  runContextMenuAction(tabId: string, x: number, y: number, action: BrowserContextMenuAction): Promise<void>;
  captureSnapshot(tabId: string): Promise<AutomationSnapshot>;
  click(tabId: string, input: ClickInput): Promise<void>;
  type(tabId: string, input: TypeInput): Promise<void>;
  press(tabId: string, input: PressInput): Promise<void>;
  scroll(tabId: string, input: ScrollInput): Promise<void>;
  evaluate(tabId: string, input: EvaluateInput): Promise<unknown>;
  waitFor(tabId: string, input: WaitForInput): Promise<void>;
  startPick(tabId: string): Promise<void>;
  cancelPick(tabId: string): Promise<void>;
  startRecording(tabId: string): Promise<void>;
  stopRecording(tabId: string): Promise<{ path: string; bytes: number }>;
  listDownloads(): Promise<BrowserDownload[]>;
  openDevTools(tabId: string): Promise<void>;
  getDevToolsFrontendUrl(tabId: string): Promise<string | null>;
  subscribeFrames(tabId: string, onFrame: (frame: FramePayload) => void): () => void;
  humanInput(tabId: string): void;
  close(): Promise<void>;
}

export type BrowserEngineFactory = (options: BrowserEngineOptions) => Promise<BrowserEngine>;

export interface BrowserEngineOptions {
  dataDir: string;
  profilesDir: string;
  artifactsDir: string;
  debugPort?: number;
  wslHosts?: string[];
  onPickComplete?: (tabId: string, payload: Record<string, unknown>) => void;
  recordingShowMousePresses?: boolean;
  recordingShowKeyPresses?: boolean;
  grantedPermissions?: import("./types.js").BrowserPermission[];
  onPopupTab?: (parentTabId: string, tab: import("./types.js").BrowserTabSnapshot) => void;
  onCrashState?: (tabId: string, phase: "recovering" | "failed" | "idle") => void;
}
