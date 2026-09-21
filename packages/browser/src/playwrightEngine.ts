import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext, CDPSession, Page } from "playwright-core";
import { chromium } from "playwright-core";
import type {
  BrowserEngine,
  BrowserEngineOptions,
  ClickInput,
  NavigateInput,
  OpenTabInput,
  PressInput,
  ScrollInput,
  TypeInput,
  WaitForInput,
  EvaluateInput,
} from "./engine.js";
import type {
  AutomationSnapshot,
  BrowserDownload,
  BrowserTabSnapshot,
  ColorScheme,
  ConsoleEntry,
  FramePayload,
  NetworkEntry,
  ViewportState,
} from "./types.js";
import { DEFAULT_VIEWPORT, MIN_VIEWPORT_DIM, MAX_VIEWPORT_AREA } from "./types.js";
import { isAllowedNavigationUrl, normalizePreviewUrl } from "./url.js";
import { resolveEnvironmentPortUrl } from "./environmentPort.js";
import { buildAutomationSnapshot, INTERACTIVE_EXTRACT_SCRIPT } from "./snapshot.js";
import { finalizeRecordingFromJpegs } from "./recordingCompositor.js";
import { HELICON_PICK_INIT_SCRIPT } from "./pickOverlay.js";
import { stat } from "node:fs/promises";

interface TabRuntime {
  snapshot: BrowserTabSnapshot;
  context: BrowserContext;
  page: Page;
  cdp: CDPSession | null;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  controllerEpoch: number;
  crashAttempts: number[];
  recordingPath: string | null;
  recordingFrames: string[];
  recordingActive: boolean;
  pickBound: boolean;
}

function clampViewport(v: ViewportState): ViewportState {
  let w = Math.max(MIN_VIEWPORT_DIM, Math.round(v.width * v.zoom));
  let h = Math.max(MIN_VIEWPORT_DIM, Math.round(v.height * v.zoom));
  while (w * h > MAX_VIEWPORT_AREA) {
    w = Math.floor(w * 0.9);
    h = Math.floor(h * 0.9);
  }
  return { ...v, width: w, height: h };
}

export async function createPlaywrightEngine(options: BrowserEngineOptions): Promise<BrowserEngine> {
  await mkdir(options.profilesDir, { recursive: true });
  await mkdir(options.artifactsDir, { recursive: true });
  const chromeDir = join(options.dataDir, "chrome");
  await mkdir(chromeDir, { recursive: true });

  let browser: Browser | null = null;
  const contexts = new Map<string, BrowserContext>();
  const tabs = new Map<string, TabRuntime>();
  const downloads: BrowserDownload[] = [];
  const frameSubs = new Map<string, Set<(f: FramePayload) => void>>();
  const debugPort = options.debugPort ?? 9333;

  const ensureBrowser = async (): Promise<Browser> => {
    if (browser) {
      return browser;
    }
    browser = await chromium.launch({
      headless: true,
      channel: undefined,
      args: [`--remote-debugging-port=${debugPort}`],
      downloadsPath: join(options.artifactsDir, "downloads"),
    });
    return browser;
  };

  const profileDir = (profileId: string): string => join(options.profilesDir, profileId);

  const getContext = async (profileId: string, persistent: boolean): Promise<BrowserContext> => {
    const key = `${profileId}:${persistent ? "p" : "i"}`;
    const existing = contexts.get(key);
    if (existing) {
      return existing;
    }
    await ensureBrowser();
    let ctx: BrowserContext;
    if (persistent && profileId !== "incognito") {
      ctx = await chromium.launchPersistentContext(profileDir(profileId), {
        headless: true,
        viewport: null,
        acceptDownloads: true,
      });
    } else {
      ctx = await (browser as Browser).newContext({ viewport: null, acceptDownloads: true });
    }
    ctx.on("download", async (download) => {
      const name = download.suggestedFilename();
      const path = join(options.artifactsDir, "downloads", `${randomUUID()}-${name}`);
      await download.saveAs(path);
      const entry: BrowserDownload = {
        id: randomUUID(),
        tabId: "",
        url: download.url(),
        suggestedFilename: name,
        path,
        at: new Date().toISOString(),
      };
      if (/\.(exe|msi|bat|cmd|sh)$/i.test(name)) {
        entry.path = path;
      }
      downloads.push(entry);
    });
    contexts.set(key, ctx);
    return ctx;
  };

  const attachDiagnostics = async (tab: TabRuntime): Promise<void> => {
    if (tab.cdp) {
      return;
    }
    const cdp = await tab.page.context().newCDPSession(tab.page);
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Log.enable");
    await cdp.send("Accessibility.enable");
    cdp.on("Runtime.consoleAPICalled", (evt) => {
      const text = evt.args.map((a) => a.value ?? a.description ?? "").join(" ");
      tab.console.push({ level: evt.type, text, timestamp: Date.now() });
      if (tab.console.length > 200) {
        tab.console.shift();
      }
    });
    cdp.on("Network.responseReceived", (evt) => {
      tab.network.push({
        url: evt.response.url,
        method: "",
        status: evt.response.status,
        failed: false,
        timestamp: Date.now(),
      });
      if (tab.network.length > 200) {
        tab.network.shift();
      }
    });
    tab.cdp = cdp;
  };

  const syncSnapshot = async (tab: TabRuntime): Promise<BrowserTabSnapshot> => {
    const title = await tab.page.title().catch(() => "");
    const url = tab.page.url();
    tab.snapshot = {
      ...tab.snapshot,
      url,
      title,
      loading: false,
    };
    return tab.snapshot;
  };

  const navigateInternal = async (tabId: string, input: NavigateInput): Promise<BrowserTabSnapshot> => {
    const tab = tabs.get(tabId);
    if (!tab) {
      throw new Error("Tab not found");
    }
    let target: string | null = null;
    if (input.url) {
      target = normalizePreviewUrl(input.url);
    } else if (input.environmentPort) {
      target = await resolveEnvironmentPortUrl({
        port: input.environmentPort.port,
        path: input.environmentPort.path,
        hosts: options.wslHosts ?? ["localhost", "127.0.0.1"],
      });
    }
    if (!target || !isAllowedNavigationUrl(target)) {
      tab.snapshot = { ...tab.snapshot, failed: "ERR_BLOCKED_BY_CLIENT", loading: false };
      return tab.snapshot;
    }
    tab.snapshot = { ...tab.snapshot, loading: true, failed: null };
    try {
      await tab.page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await syncSnapshot(tab);
    } catch (error) {
      tab.snapshot = {
        ...tab.snapshot,
        loading: false,
        failed: error instanceof Error ? error.message : "Navigation failed",
      };
    }
    return tab.snapshot;
  };

  const engine: BrowserEngine = {
    ready: false,
    async ensureInstalled() {
      await ensureBrowser();
      (engine as { ready: boolean }).ready = true;
    },
    async openTab(input: OpenTabInput) {
      const profileId = input.profileId ?? "default";
      const persistent = profileId !== "incognito";
      const ctx = await getContext(profileId, persistent);
      const page = await ctx.newPage();
      const tabId = input.tabId ?? `tab_${randomUUID().slice(0, 8)}`;
      const snap: BrowserTabSnapshot = {
        tabId,
        url: "about:blank",
        title: "",
        loading: false,
        failed: null,
        profileId,
        muted: false,
        audible: false,
        controller: "none",
        viewport: { ...DEFAULT_VIEWPORT },
        colorScheme: "system",
        faviconDataUrl: null,
      };
      const runtime: TabRuntime = {
        snapshot: snap,
        context: ctx,
        page,
        cdp: null,
        console: [],
        network: [],
        controllerEpoch: 0,
        crashAttempts: [],
        recordingPath: null,
        recordingFrames: [],
        recordingActive: false,
        pickBound: false,
      };
      tabs.set(tabId, runtime);
      page.on("popup", async (popup) => {
        const popupId = `tab_${randomUUID().slice(0, 8)}`;
        const popupSnap: BrowserTabSnapshot = { ...snap, tabId: popupId, url: popup.url() };
        tabs.set(popupId, {
          snapshot: popupSnap,
          context: ctx,
          page: popup,
          cdp: null,
          console: [],
          network: [],
          controllerEpoch: 0,
          crashAttempts: [],
          recordingPath: null,
          recordingFrames: [],
          recordingActive: false,
          pickBound: false,
        });
      });
      page.on("crash", () => {
        void recoverCrash(tabId);
      });
      if (input.url) {
        await navigateInternal(tabId, { url: input.url });
      }
      await attachDiagnostics(runtime);
      return runtime.snapshot;
    },
    async closeTab(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        return;
      }
      await tab.page.close().catch(() => undefined);
      tabs.delete(tabId);
    },
    async listTabs() {
      return [...tabs.values()].map((t) => t.snapshot);
    },
    navigate: navigateInternal,
    async goBack(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await tab.page.goBack({ timeout: 15_000 }).catch(() => undefined);
      return syncSnapshot(tab);
    },
    async goForward(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await tab.page.goForward({ timeout: 15_000 }).catch(() => undefined);
      return syncSnapshot(tab);
    },
    async reload(tabId, hard) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await tab.page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      return syncSnapshot(tab);
    },
    async setViewport(tabId, viewport) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      const v = clampViewport(viewport);
      await tab.page.setViewportSize({ width: v.width, height: v.height });
      tab.snapshot = { ...tab.snapshot, viewport: v };
      return tab.snapshot;
    },
    async setColorScheme(tabId, scheme: ColorScheme) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await attachDiagnostics(tab);
      if (tab.cdp) {
        const value = scheme === "system" ? "" : scheme;
        await tab.cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });
      }
      tab.snapshot = { ...tab.snapshot, colorScheme: scheme };
      return tab.snapshot;
    },
    async setMuted(tabId, muted) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await tab.page.evaluate(`(() => {
        const v = document.querySelector('video');
        if (v) v.muted = ${muted ? "true" : "false"};
      })()`);
      tab.snapshot = { ...tab.snapshot, muted };
      return tab.snapshot;
    },
    async captureScreenshot(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      return tab.page.screenshot({ type: "png" });
    },
    async captureSnapshot(tabId): Promise<AutomationSnapshot> {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await attachDiagnostics(tab);
      const png = await tab.page.screenshot({ type: "png", fullPage: false });
      const extract = await tab.page.evaluate(INTERACTIVE_EXTRACT_SCRIPT);
      let axTree: unknown = {};
      if (tab.cdp) {
        axTree = await tab.cdp.send("Accessibility.getFullAXTree");
      }
      return buildAutomationSnapshot(
        {
          url: tab.page.url(),
          title: await tab.page.title(),
          loading: tab.snapshot.loading,
          pngBase64: png.toString("base64"),
          axTree,
          extract: extract as { interactive: []; visibleText: string },
        },
        { console: tab.console, network: tab.network },
      );
    },
    async click(tabId, input: ClickInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      tab.snapshot = { ...tab.snapshot, controller: "agent" };
      if (input.x !== undefined && input.y !== undefined) {
        await tab.page.mouse.click(input.x, input.y);
        return;
      }
      if (input.selector) {
        await tab.page.click(input.selector);
        return;
      }
      if (input.locator) {
        await tab.page.locator(input.locator).click();
      }
    },
    async type(tabId, input: TypeInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      if (input.clear) {
        if (input.selector) {
          await tab.page.fill(input.selector, "");
        }
      }
      if (input.selector) {
        await tab.page.fill(input.selector, input.text);
      } else if (input.locator) {
        await tab.page.locator(input.locator).fill(input.text);
      } else {
        await tab.page.keyboard.type(input.text);
      }
    },
    async press(tabId, input: PressInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      const mods: string[] = [];
      if (input.alt) {
        mods.push("Alt");
      }
      if (input.control) {
        mods.push("Control");
      }
      if (input.meta) {
        mods.push("Meta");
      }
      if (input.shift) {
        mods.push("Shift");
      }
      await tab.page.keyboard.press([...mods, input.key].join("+"));
    },
    async scroll(tabId, input: ScrollInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      if (input.selector) {
        await tab.page.locator(input.selector).evaluate(
          (el, d) => {
            el.scrollBy(d.deltaX, d.deltaY);
          },
          { deltaX: input.deltaX, deltaY: input.deltaY },
        );
      } else {
        await tab.page.mouse.wheel(input.deltaX, input.deltaY);
      }
    },
    async evaluate(tabId, input: EvaluateInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      return tab.page.evaluate(input.expression);
    },
    async waitFor(tabId, input: WaitForInput) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      const timeout = Math.min(input.timeoutMs ?? 15_000, 60_000);
      if (input.locator) {
        await tab.page.locator(input.locator).waitFor({ timeout });
      }
      if (input.text) {
        await tab.page.getByText(input.text).waitFor({ timeout });
      }
      if (input.urlIncludes) {
        await tab.page.waitForURL((u) => u.toString().includes(input.urlIncludes as string), { timeout });
      }
    },
    async startPick(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      if (!tab.pickBound) {
        tab.pickBound = true;
        await tab.page.addInitScript(HELICON_PICK_INIT_SCRIPT);
        await tab.page.evaluate(HELICON_PICK_INIT_SCRIPT);
        try {
          await tab.page.exposeFunction("heliconPickComplete", async (payload: Record<string, unknown>) => {
            options.onPickComplete?.(tabId, payload);
          });
        } catch {
          /* already exposed on this page */
        }
      }
      await tab.page.evaluate(`(() => {
        document.body.style.cursor = 'crosshair';
        window.__heliconPick = true;
      })()`);
    },
    async cancelPick(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        return;
      }
      await tab.page.evaluate(`(() => { window.__heliconPick = false; document.body.style.cursor = ''; })()`);
    },
    async startRecording(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      tab.recordingFrames = [];
      tab.recordingActive = true;
      tab.recordingPath = join(options.artifactsDir, `rec-${tabId}-${Date.now()}.webm`);
    },
    async stopRecording(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      tab.recordingActive = false;
      const out = tab.recordingPath ?? join(options.artifactsDir, `rec-${tabId}-${Date.now()}.webm`);
      const result = await finalizeRecordingFromJpegs(tab.recordingFrames, out);
      tab.recordingFrames = [];
      tab.recordingPath = null;
      try {
        const info = await stat(result.path);
        return { path: result.path, bytes: info.size };
      } catch {
        return result;
      }
    },
    async listDownloads() {
      return downloads;
    },
    async openDevTools(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        throw new Error("Tab not found");
      }
      await tab.page.pause();
    },
    subscribeFrames(tabId, onFrame) {
      let set = frameSubs.get(tabId);
      if (!set) {
        set = new Set();
        frameSubs.set(tabId, set);
      }
      set.add(onFrame);
      const tab = tabs.get(tabId);
      if (!tab) {
        return () => set?.delete(onFrame);
      }
      let active = true;
      void attachDiagnostics(tab).then(async () => {
        if (!tab.cdp) {
          return;
        }
        await tab.cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 2 });
        tab.cdp.on("Page.screencastFrame", async (frame) => {
          if (!active) {
            return;
          }
          if (tab.recordingActive) {
            tab.recordingFrames.push(frame.data);
            if (tab.recordingFrames.length > 3600) {
              tab.recordingFrames.shift();
            }
          }
          const payload: FramePayload = {
            tabId,
            dataUrl: `data:image/jpeg;base64,${frame.data}`,
            width: tab.snapshot.viewport.width,
            height: tab.snapshot.viewport.height,
            at: Date.now(),
          };
          for (const fn of set ?? []) {
            fn(payload);
          }
          await tab.cdp?.send("Page.screencastFrameAck", { sessionId: frame.sessionId });
        });
      });
      return () => {
        active = false;
        set?.delete(onFrame);
      };
    },
    humanInput(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) {
        return;
      }
      tab.controllerEpoch += 1;
      tab.snapshot = { ...tab.snapshot, controller: "human" };
    },
    async close() {
      for (const tab of tabs.values()) {
        await tab.page.close().catch(() => undefined);
      }
      tabs.clear();
      for (const ctx of contexts.values()) {
        await ctx.close().catch(() => undefined);
      }
      contexts.clear();
      if (browser) {
        await browser.close().catch(() => undefined);
        browser = null;
      }
    },
  };

  async function recoverCrash(tabId: string): Promise<void> {
    const tab = tabs.get(tabId);
    if (!tab) {
      return;
    }
    const now = Date.now();
    tab.crashAttempts = tab.crashAttempts.filter((t) => now - t < 30_000);
    if (tab.crashAttempts.length >= 3) {
      return;
    }
    tab.crashAttempts.push(now);
    const delay = 250 * 2 ** tab.crashAttempts.length;
    await new Promise((r) => setTimeout(r, delay));
    const url = tab.snapshot.url;
    const page = await tab.context.newPage();
    tab.page = page;
    tab.cdp = null;
    if (url && url !== "about:blank") {
      await page.goto(url).catch(() => undefined);
    }
    await syncSnapshot(tab);
  }

  return engine;
}
