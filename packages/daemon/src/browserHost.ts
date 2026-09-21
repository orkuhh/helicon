import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  createFakeEngine,
  discoverLocalServers,
  type BrowserDefaults,
  type BrowserEngine,
  type BrowserTabSnapshot,
  DEFAULT_BROWSER_DEFAULTS,
  normalizePreviewUrl,
  resolveEnvironmentPortUrl,
} from "@helicon/browser";
import type { HeliconStore } from "./store.js";

export interface BrowserHostOptions {
  dataDir?: string;
  useFakeEngine?: boolean;
  wslHosts?: string[];
}

export interface SessionBrowserState {
  sessionId: string;
  activeTabId: string | null;
  tabs: BrowserTabSnapshot[];
}

export class BrowserHost {
  private engine: BrowserEngine | null = null;
  private readonly dataDir: string;
  private readonly profilesDir: string;
  private readonly artifactsDir: string;
  private readonly useFake: boolean;
  private readonly wslHosts: string[];
  private readonly sessionTabs = new Map<string, Set<string>>();
  private readonly tabSession = new Map<string, string>();
  private readonly automationEpoch = new Map<string, number>();

  constructor(
    private readonly store: HeliconStore,
    options: BrowserHostOptions = {},
  ) {
    const base = options.dataDir ?? join(homedir(), ".helicon");
    this.dataDir = join(base, "browser");
    this.profilesDir = join(this.dataDir, "profiles");
    this.artifactsDir = join(this.dataDir, "artifacts");
    this.useFake = options.useFakeEngine ?? process.env["HELICON_BROWSER_FAKE"] === "1";
    this.wslHosts = options.wslHosts ?? ["localhost", "127.0.0.1"];
  }

  async ensureEngine(): Promise<BrowserEngine> {
    if (this.engine) {
      return this.engine;
    }
    if (this.useFake) {
      this.engine = createFakeEngine({
        dataDir: this.dataDir,
        profilesDir: this.profilesDir,
        artifactsDir: this.artifactsDir,
        wslHosts: this.wslHosts,
      });
    } else {
      const { createPlaywrightEngine } = require("@helicon/browser/dist/src/playwrightEngine.js") as typeof import("@helicon/browser/dist/src/playwrightEngine.js");
      this.engine = await createPlaywrightEngine({
        dataDir: this.dataDir,
        profilesDir: this.profilesDir,
        artifactsDir: this.artifactsDir,
        wslHosts: this.wslHosts,
      });
    }
    const engine = this.engine;
    if (!engine) {
      throw new Error("Browser engine failed to start");
    }
    await engine.ensureInstalled();
    return engine;
  }

  getDefaults(): BrowserDefaults {
    return this.store.getBrowserDefaults();
  }

  setDefaults(patch: Partial<BrowserDefaults>): BrowserDefaults {
    return this.store.setBrowserDefaults(patch);
  }

  async listDiscovered(configuredUrls?: string[]): Promise<Awaited<ReturnType<typeof discoverLocalServers>>> {
    const defaults = this.getDefaults();
    return discoverLocalServers({ configuredUrls: configuredUrls ?? defaults.configuredLocalUrls });
  }

  async openTab(sessionId: string, url?: string, profileId?: string): Promise<BrowserTabSnapshot> {
    const engine = await this.ensureEngine();
    const defaults = this.getDefaults();
    const tab = await engine.openTab({
      url,
      profileId: profileId ?? defaults.profileId,
    });
    let set = this.sessionTabs.get(sessionId);
    if (!set) {
      set = new Set();
      this.sessionTabs.set(sessionId, set);
    }
    set.add(tab.tabId);
    this.tabSession.set(tab.tabId, sessionId);
    this.store.rememberBrowserTab(sessionId, tab.tabId, tab.url);
    if (url) {
      this.store.pushBrowserHistory(sessionId, tab.url, tab.title);
    }
    return tab;
  }

  async restoreSessionTabs(sessionId: string): Promise<BrowserTabSnapshot[]> {
    const rows = this.store.listBrowserTabRestore(sessionId);
    const out: BrowserTabSnapshot[] = [];
    for (const row of rows) {
      const tab = await this.openTab(sessionId, row.url, row.profileId);
      out.push(tab);
    }
    if (out.length === 0) {
      const tab = await this.openTab(sessionId);
      out.push(tab);
    }
    return out;
  }

  async listTabs(sessionId: string): Promise<BrowserTabSnapshot[]> {
    const engine = await this.ensureEngine();
    const ids = this.sessionTabs.get(sessionId);
    if (!ids || ids.size === 0) {
      return await this.restoreSessionTabs(sessionId);
    }
    const all = await engine.listTabs();
    return all.filter((t) => ids.has(t.tabId));
  }

  async closeTab(sessionId: string, tabId?: string): Promise<void> {
    const engine = await this.ensureEngine();
    const ids = this.sessionTabs.get(sessionId);
    if (!ids) {
      return;
    }
    if (!tabId) {
      for (const id of [...ids]) {
        await engine.closeTab(id);
        ids.delete(id);
        this.tabSession.delete(id);
        this.store.forgetBrowserTab(sessionId, id);
      }
      return;
    }
    await engine.closeTab(tabId);
    ids.delete(tabId);
    this.tabSession.delete(tabId);
    this.store.forgetBrowserTab(sessionId, tabId);
  }

  private assertTab(sessionId: string, tabId: string): void {
    const ids = this.sessionTabs.get(sessionId);
    if (!ids?.has(tabId)) {
      throw new Error("Unknown browser tab for session");
    }
  }

  async navigate(
    sessionId: string,
    tabId: string,
    target: { url?: string; environmentPort?: { port: number; path?: string } },
  ): Promise<BrowserTabSnapshot> {
    this.assertTab(sessionId, tabId);
    const engine = await this.ensureEngine();
    let snap: BrowserTabSnapshot;
    if (target.environmentPort) {
      const url = await resolveEnvironmentPortUrl({
        port: target.environmentPort.port,
        path: target.environmentPort.path,
        hosts: this.wslHosts,
      });
      snap = await engine.navigate(tabId, { url: url ?? undefined, environmentPort: target.environmentPort });
    } else {
      const normalized = target.url ? normalizePreviewUrl(target.url) : null;
      snap = await engine.navigate(tabId, { url: normalized ?? target.url });
    }
    this.store.rememberBrowserTab(sessionId, tabId, snap.url);
    if (snap.url && snap.url !== "about:blank") {
      this.store.pushBrowserHistory(sessionId, snap.url, snap.title);
    }
    return snap;
  }

  engineForAutomation(): BrowserEngine {
    if (!this.engine) {
      throw new Error("Browser engine not started");
    }
    return this.engine;
  }

  bumpControlEpoch(tabId: string): number {
    const next = (this.automationEpoch.get(tabId) ?? 0) + 1;
    this.automationEpoch.set(tabId, next);
    this.engine?.humanInput(tabId);
    return next;
  }

  getControlEpoch(tabId: string): number {
    return this.automationEpoch.get(tabId) ?? 0;
  }

  subscribeFrames(tabId: string, onFrame: (frame: import("@helicon/browser").FramePayload) => void): () => void {
    if (!this.engine) {
      return () => undefined;
    }
    return this.engine.subscribeFrames(tabId, onFrame);
  }

  async close(): Promise<void> {
    await this.engine?.close();
    this.engine = null;
    this.sessionTabs.clear();
    this.tabSession.clear();
  }

  artifactsPath(...parts: string[]): string {
    return join(this.artifactsDir, ...parts);
  }

  newArtifactId(): string {
    return randomUUID();
  }
}
