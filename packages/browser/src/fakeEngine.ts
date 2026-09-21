import { randomUUID } from "node:crypto";
import type { BrowserContextMenuAction } from "./editingContext.js";
import type { BrowserEngine, BrowserEngineOptions, ClickInput, NavigateInput, OpenTabInput, PressInput, ScrollInput, TypeInput, WaitForInput, EvaluateInput } from "./engine.js";
import type { AutomationSnapshot, BrowserDownload, BrowserTabSnapshot, ColorScheme, FramePayload, ViewportState } from "./types.js";
import { DEFAULT_VIEWPORT } from "./types.js";
import { normalizePreviewUrl } from "./url.js";
import { buildAutomationSnapshot, INTERACTIVE_EXTRACT_SCRIPT } from "./snapshot.js";

interface FakeTab {
  snapshot: BrowserTabSnapshot;
  controllerEpoch: number;
}

export function createFakeEngine(options: BrowserEngineOptions): BrowserEngine {
  const tabs = new Map<string, FakeTab>();
  const downloads: BrowserDownload[] = [];
  const frameSubs = new Map<string, Set<(f: FramePayload) => void>>();
  let frameTimer: ReturnType<typeof setInterval> | null = null;

  const emitFrames = (): void => {
    for (const [tabId, subs] of frameSubs) {
      const tab = tabs.get(tabId);
      if (!tab) {
        continue;
      }
      const payload: FramePayload = {
        tabId,
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        width: tab.snapshot.viewport.width,
        height: tab.snapshot.viewport.height,
        at: Date.now(),
      };
      for (const fn of subs) {
        fn(payload);
      }
    }
  };

  const startFrames = (): void => {
    if (frameTimer) {
      return;
    }
    frameTimer = setInterval(emitFrames, 80);
    frameTimer.unref?.();
  };

  const stopFramesIfIdle = (): void => {
    if (frameSubs.size === 0 && frameTimer) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
  };

  const mkTab = (input: OpenTabInput): BrowserTabSnapshot => {
    const tabId = input.tabId ?? `tab_${randomUUID().slice(0, 8)}`;
    const url = input.url ? normalizePreviewUrl(input.url) ?? "about:blank" : "about:blank";
    return {
      tabId,
      url,
      title: url === "about:blank" ? "" : "Fake page",
      loading: false,
      failed: null,
      profileId: input.profileId ?? "default",
      muted: false,
      audible: false,
      controller: "none",
      viewport: { ...DEFAULT_VIEWPORT },
      colorScheme: "system",
      faviconDataUrl: null,
    };
  };

  const engine: BrowserEngine = {
    ready: true,
    async ensureInstalled() {
      return;
    },
    async openTab(input) {
      const snap = mkTab(input);
      tabs.set(snap.tabId, { snapshot: snap, controllerEpoch: 0 });
      return snap;
    },
    async closeTab(tabId) {
      tabs.delete(tabId);
      frameSubs.delete(tabId);
      stopFramesIfIdle();
    },
    async listTabs() {
      return [...tabs.values()].map((t) => t.snapshot);
    },
    async navigate(tabId, input: NavigateInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      let url = "about:blank";
      if (input.url) {
        url = normalizePreviewUrl(input.url) ?? tab.snapshot.url;
      } else if (input.environmentPort) {
        url = `http://localhost:${input.environmentPort.port}${input.environmentPort.path ?? "/"}`;
      }
      tab.snapshot = { ...tab.snapshot, url, title: "Fake page", loading: false, failed: null };
      return tab.snapshot;
    },
    async goBack(tabId) {
      return (await engine.navigate(tabId, { url: "about:blank" }));
    },
    async goForward(tabId) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      return t.snapshot;
    },
    async reload(tabId) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      return t.snapshot;
    },
    async stopLoading(tabId) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      t.snapshot = { ...t.snapshot, loading: false };
      return t.snapshot;
    },
    async setViewport(tabId, viewport: ViewportState) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      t.snapshot = { ...t.snapshot, viewport };
      return t.snapshot;
    },
    async setColorScheme(tabId, scheme: ColorScheme) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      t.snapshot = { ...t.snapshot, colorScheme: scheme };
      return t.snapshot;
    },
    async setMuted(tabId, muted: boolean) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      t.snapshot = { ...t.snapshot, muted };
      return t.snapshot;
    },
    async captureScreenshot() {
      return Buffer.from("fakepng");
    },
    async probeContextMenu() {
      return {
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true,
        linkUrl: "https://example.com",
        imageUrl: null,
        misspelledWord: "helicn",
        spellSuggestions: ["helicon", "helix"],
      };
    },
    async runContextMenuAction(_tabId, _x, _y, _action: BrowserContextMenuAction) {
      return;
    },
    async captureSnapshot(tabId): Promise<AutomationSnapshot> {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      return buildAutomationSnapshot(
        {
          url: t.snapshot.url,
          title: t.snapshot.title,
          loading: t.snapshot.loading,
          pngBase64: "",
          axTree: {},
          extract: { interactive: [], visibleText: "" },
        },
        { console: [], network: [] },
      );
    },
    async click(tabId, _input: ClickInput) {
      const t = tabs.get(tabId);
      if (!t) {
        throw new Error("Tab not found");
      }
      t.snapshot = { ...t.snapshot, controller: "agent" };
    },
    async type(tabId, _input: TypeInput) {
      await engine.click(tabId, {});
    },
    async press(tabId, _input: PressInput) {
      await engine.click(tabId, {});
    },
    async scroll(tabId, _input: ScrollInput) {
      await engine.click(tabId, {});
    },
    async evaluate(tabId, input: EvaluateInput) {
      if (input.expression === INTERACTIVE_EXTRACT_SCRIPT) {
        return { interactive: [], visibleText: "" };
      }
      return null;
    },
    async waitFor(_tabId, _input: WaitForInput) {
      return;
    },
    async startPick(tabId) {
      options.onPickComplete?.(tabId, {
        tag: "div",
        selector: "div",
        text: "picked",
        rect: { x: 0, y: 0, width: 10, height: 10 },
        comment: "",
      });
    },
    async cancelPick() {
      return;
    },
    async startRecording() {
      return;
    },
    async stopRecording() {
      return { path: "/tmp/fake.webm", bytes: 12 };
    },
    async listDownloads() {
      return downloads;
    },
    async openDevTools() {
      return;
    },
    async getDevToolsFrontendUrl() {
      return "https://example.com/devtools";
    },
    subscribeFrames(tabId, onFrame) {
      let set = frameSubs.get(tabId);
      if (!set) {
        set = new Set();
        frameSubs.set(tabId, set);
      }
      set.add(onFrame);
      startFrames();
      return () => {
        set?.delete(onFrame);
        if (set && set.size === 0) {
          frameSubs.delete(tabId);
        }
        stopFramesIfIdle();
      };
    },
    humanInput(tabId) {
      const t = tabs.get(tabId);
      if (!t) {
        return;
      }
      t.controllerEpoch += 1;
      t.snapshot = { ...t.snapshot, controller: "human" };
    },
    async close() {
      if (frameTimer) {
        clearInterval(frameTimer);
        frameTimer = null;
      }
      tabs.clear();
      frameSubs.clear();
    },
  };

  return engine;
}
