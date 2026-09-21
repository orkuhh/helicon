import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  buildWslHostUnion,
  createFakeEngine,
  discoverLocalServers,
  listImportSources,
  importCookiesFromNetscapeFile,
  type BrowserDefaults,
  type BrowserEngine,
  type BrowserTabSnapshot,
  DEFAULT_BROWSER_DEFAULTS,
  normalizePreviewUrl,
  resolveEnvironmentPortUrl,
  loadPlaywrightEngine,
} from "@helicon/browser";
import type { HeliconStore } from "./store.js";

export interface BrowserHostOptions {
  dataDir?: string;
  useFakeEngine?: boolean;
  wslHosts?: string[];
  exec?: (command: string, args: string[]) => Promise<{ stdout: string; exitCode: number }>;
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
  private wslHosts: string[];
  private readonly exec?: BrowserHostOptions["exec"];
  private readonly sessionTabs = new Map<string, Set<string>>();
  private readonly tabSession = new Map<string, string>();
  private readonly automationEpoch = new Map<string, number>();
  private wslHostsLoaded = false;
  private onPickComplete?: (tabId: string, sessionId: string, payload: Record<string, unknown>) => void;
  private onTabOpened?: (sessionId: string, tab: BrowserTabSnapshot) => void;

  constructor(
    private readonly store: HeliconStore,
    private readonly hostOptions: BrowserHostOptions = {},
  ) {
    const base = hostOptions.dataDir ?? join(homedir(), ".helicon");
    this.dataDir = join(base, "browser");
    this.profilesDir = join(this.dataDir, "profiles");
    this.artifactsDir = join(this.dataDir, "artifacts");
    this.useFake = hostOptions.useFakeEngine ?? process.env["HELICON_BROWSER_FAKE"] === "1";
    this.wslHosts = hostOptions.wslHosts ?? ["localhost", "127.0.0.1"];
    this.exec = hostOptions.exec;
  }

  async ensureEngine(): Promise<BrowserEngine> {
    if (!this.wslHostsLoaded && !this.hostOptions.wslHosts) {
      this.wslHostsLoaded = true;
      this.wslHosts = await buildWslHostUnion(
        this.exec
          ? async (command, args) => {
              const r = await this.exec!(command, args);
              return { stdout: r.stdout, stderr: "", code: r.exitCode };
            }
          : undefined,
      );
    }
    if (this.engine) {
      return this.engine;
    }
    if (this.useFake) {
      this.engine = createFakeEngine({
        dataDir: this.dataDir,
        profilesDir: this.profilesDir,
        artifactsDir: this.artifactsDir,
        wslHosts: this.wslHosts,
        onPickComplete: (tabId, payload) => {
          const sessionId = this.tabSession.get(tabId);
          if (sessionId && this.onPickComplete) {
            this.onPickComplete(tabId, sessionId, payload);
          }
        },
        onPopupTab: (parentTabId, tab) => {
          void this.registerEngineTab(parentTabId, tab);
        },
      });
    } else {
      const defaults = this.getDefaults();
      this.engine = await loadPlaywrightEngine({
        dataDir: this.dataDir,
        profilesDir: this.profilesDir,
        artifactsDir: this.artifactsDir,
        wslHosts: this.wslHosts,
        recordingShowKeyPresses: defaults.recordingShowKeyPresses,
        recordingShowMousePresses: defaults.recordingShowMousePresses,
        grantedPermissions: defaults.grantedPermissions,
        onPickComplete: (tabId, payload) => {
          const sessionId = this.tabSession.get(tabId);
          if (sessionId && this.onPickComplete) {
            this.onPickComplete(tabId, sessionId, payload);
          }
        },
        onPopupTab: (parentTabId, tab) => {
          void this.registerEngineTab(parentTabId, tab);
        },
      });
    }
    const engine = this.engine;
    if (!engine) {
      throw new Error("Browser engine failed to start");
    }
    await engine.ensureInstalled();
    return engine;
  }

  setPickHandler(handler: (tabId: string, sessionId: string, payload: Record<string, unknown>) => void): void {
    this.onPickComplete = handler;
  }

  setTabOpenedHandler(handler: (sessionId: string, tab: BrowserTabSnapshot) => void): void {
    this.onTabOpened = handler;
  }

  sessionIdForTab(tabId: string): string | null {
    return this.tabSession.get(tabId) ?? null;
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

  private registerTabWithSession(sessionId: string, tab: BrowserTabSnapshot): void {
    let set = this.sessionTabs.get(sessionId);
    if (!set) {
      set = new Set();
      this.sessionTabs.set(sessionId, set);
    }
    set.add(tab.tabId);
    this.tabSession.set(tab.tabId, sessionId);
    this.store.rememberBrowserTab(sessionId, tab.tabId, tab.url, tab.profileId);
  }

  private async registerEngineTab(parentTabId: string, tab: BrowserTabSnapshot): Promise<void> {
    const sessionId = this.tabSession.get(parentTabId);
    if (!sessionId) {
      return;
    }
    this.registerTabWithSession(sessionId, tab);
    this.onTabOpened?.(sessionId, tab);
  }

  listHistory(sessionId: string): { url: string; title: string | null }[] {
    const found = this.store.findSession(sessionId);
    if (!found) {
      return [];
    }
    return this.store.listBrowserHistory(found.cwd).map((row) => ({ url: row.url, title: row.title }));
  }

  removeHistory(sessionId: string, url: string): void {
    const found = this.store.findSession(sessionId);
    if (!found) {
      return;
    }
    this.store.removeBrowserHistory(found.cwd, url);
  }

  async openTab(sessionId: string, url?: string, profileId?: string): Promise<BrowserTabSnapshot> {
    const engine = await this.ensureEngine();
    const defaults = this.getDefaults();
    const tab = await engine.openTab({
      url,
      profileId: profileId ?? defaults.profileId,
    });
    this.registerTabWithSession(sessionId, tab);
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
    return all.filter((t: BrowserTabSnapshot) => ids.has(t.tabId));
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

  async listImportSources() {
    return await listImportSources();
  }

  async importCookiesFromFile(filePath: string) {
    return await importCookiesFromNetscapeFile(filePath);
  }

  listProfiles(): { id: string; name: string; persistent: boolean; builtIn: boolean }[] {
    return this.store.listBrowserProfiles();
  }

  async clearProfileData(profileId: string, what: "cookies" | "cache"): Promise<void> {
    await this.ensureEngine();
    if (what === "cookies") {
      // Playwright persistent contexts store on disk; removing dir is the reliable clear.
      const { rm } = await import("node:fs/promises");
      await rm(join(this.profilesDir, profileId), { recursive: true, force: true });
    }
  }
}
