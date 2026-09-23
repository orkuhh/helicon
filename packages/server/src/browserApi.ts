import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BrowserHost, type HeliconStore } from "@helicon/daemon";
import type { BrowserTabSnapshot, FramePayload } from "@helicon/browser";
import { HttpError } from "./httpError.js";

export type BrowserEventEmitter = (type: string, data: unknown) => void;

export interface BrowserApiOptions {
  store: HeliconStore;
  emit: BrowserEventEmitter;
  useFakeEngine?: boolean;
  exec?: (command: string, args: string[]) => Promise<{ stdout: string; exitCode: number }>;
  requireApproval?: (sessionId: string, tool: string, detail: Record<string, unknown>) => Promise<boolean>;
  onWorkLog?: (sessionId: string, verb: string, detail: Record<string, unknown>) => void;
}

interface FrameSink {
  sessionId: string;
  tabId: string;
  write: (chunk: string) => void;
  unsubscribe?: () => void;
}

export class BrowserApi {
  private readonly host: BrowserHost;
  private readonly frameSinks = new Set<FrameSink>();

  constructor(private readonly options: BrowserApiOptions) {
    this.host = new BrowserHost(options.store, {
      useFakeEngine: options.useFakeEngine,
      exec: options.exec,
    });
    this.host.setPickHandler((tabId, sessionId, payload) => {
      void this.emitPick(sessionId, tabId, payload);
    });
    this.host.setTabOpenedHandler((sessionId, tab) => {
      this.emitBrowser(sessionId, "browser.opened", { tab });
    });
    this.host.setCrashHandler((sessionId, tabId, phase) => {
      this.emitBrowser(sessionId, "browser.crash", { tabId, phase });
      if (phase === "failed") {
        void this.host
          .engineForAutomation()
          .listTabs()
          .then((tabs) => {
            const tab = tabs.find((t) => t.tabId === tabId);
            if (tab) {
              this.emitBrowser(sessionId, "browser.navigated", { tab });
            }
          });
      }
    });
  }

  private async emitPick(sessionId: string, tabId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const png = await this.host.engineForAutomation().captureScreenshot(tabId);
      this.options.emit("browser-pick", {
        sessionId,
        tabId,
        payload: { ...payload, pngBase64: png.toString("base64") },
        at: Date.now(),
      });
    } catch {
      this.options.emit("browser-pick", { sessionId, tabId, payload, at: Date.now() });
    }
  }

  async close(): Promise<void> {
    for (const sink of [...this.frameSinks]) {
      sink.unsubscribe?.();
    }
    this.frameSinks.clear();
    await this.host.close();
  }

  private sessionIdFromPath(path: string): { sessionId: string; rest: string } | null {
    const m = path.match(/^\/api\/sessions\/([^/]+)\/browser(\/.*)?$/);
    if (!m) {
      return null;
    }
    return { sessionId: decodeURIComponent(m[1] as string), rest: m[2] ?? "" };
  }

  async handle(
    method: string,
    path: string,
    url: URL,
    req: IncomingMessage,
    res: ServerResponse,
    readBody: () => Promise<Record<string, unknown>>,
  ): Promise<boolean> {
    if (path === "/api/browser/discovered" && method === "GET") {
      const servers = await this.host.listDiscovered();
      this.json(res, 200, { servers });
      return true;
    }
    if (path === "/api/browser/defaults" && method === "GET") {
      this.json(res, 200, { defaults: this.host.getDefaults() });
      return true;
    }
    if (path === "/api/browser/defaults" && method === "PATCH") {
      const body = await readBody();
      const defaults = this.host.setDefaults(body as Partial<ReturnType<BrowserHost["getDefaults"]>>);
      this.json(res, 200, { defaults });
      return true;
    }
    if (path === "/api/browser/downloads" && method === "GET") {
      const engine = this.host.engineForAutomation();
      const downloads = await engine.listDownloads();
      this.json(res, 200, { downloads });
      return true;
    }
    if (path === "/api/browser/profiles" && method === "GET") {
      this.json(res, 200, { profiles: this.host.listProfiles() });
      return true;
    }
    if (path === "/api/browser/profiles" && method === "POST") {
      const body = await readBody();
      const id = typeof body["id"] === "string" ? body["id"] : randomUUID().slice(0, 16);
      const name = typeof body["name"] === "string" ? body["name"] : id;
      this.options.store.createBrowserProfile(id, name);
      this.json(res, 200, { ok: true, id });
      return true;
    }
    if (path === "/api/browser/import/sources" && method === "GET") {
      this.json(res, 200, { sources: await this.host.listImportSources() });
      return true;
    }
    if (path === "/api/browser/import" && method === "POST") {
      const body = await readBody();
      const file = typeof body["filePath"] === "string" ? body["filePath"] : "";
      if (!file) {
        throw new HttpError(400, "filePath is required.");
      }
      const result = await this.host.importCookiesFromFile(file);
      this.json(res, 200, result);
      return true;
    }
    if (path === "/api/browser/clear" && method === "POST") {
      const body = await readBody();
      const profileId = typeof body["profileId"] === "string" ? body["profileId"] : "default";
      const what = body["what"] === "cache" ? "cache" : "cookies";
      await this.host.clearProfileData(profileId, what);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (path === "/api/browser/pip.html" && method === "GET") {
      const sessionId = url.searchParams.get("sessionId") ?? "";
      const tabId = url.searchParams.get("tabId") ?? "";
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": "img-src data: 'self'" });
      res.end(`<!doctype html><meta charset=utf-8><title>Preview</title><style>html,body{margin:0;background:#111;height:100%}img{width:100%;height:100%;object-fit:contain}</style><img id=f><script>
const u=new URL('/api/browser/stream',location.origin);u.searchParams.set('sessionId','${sessionId}');u.searchParams.set('tabId','${tabId}');
const s=new EventSource(u);s.addEventListener('frame',e=>{const d=JSON.parse(e.data);document.getElementById('f').src=d.dataUrl});</script>`);
      return true;
    }
    if (path.startsWith("/api/browser/stream")) {
      if (method !== "GET") {
        return false;
      }
      return this.serveFrameStream(url, res);
    }

    const parsed = this.sessionIdFromPath(path);
    if (!parsed) {
      return false;
    }
    const { sessionId, rest } = parsed;
    if (!this.options.store.findSession(sessionId)) {
      throw new HttpError(404, "Unknown session.");
    }

    if (rest === "/history" && method === "GET") {
      this.json(res, 200, { history: this.host.listHistory(sessionId) });
      return true;
    }
    if (rest === "/history" && method === "DELETE") {
      const body = await readBody();
      const url = typeof body["url"] === "string" ? body["url"] : "";
      if (!url) {
        throw new HttpError(400, "url is required.");
      }
      this.host.removeHistory(sessionId, url);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (rest === "/tabs" && method === "GET") {
      const tabs = await this.host.listTabs(sessionId);
      this.json(res, 200, { tabs });
      return true;
    }
    if (rest === "/tabs" && method === "POST") {
      const body = await readBody();
      const url = typeof body["url"] === "string" ? body["url"] : undefined;
      if (url) {
        await this.guard(sessionId, "preview_open", { url });
      }
      const profileId = typeof body["profileId"] === "string" ? body["profileId"] : undefined;
      const tab = await this.host.openTab(sessionId, url, profileId);
      this.emitBrowser(sessionId, "browser.opened", { tab });
      this.json(res, 200, { tab });
      return true;
    }

    const tabMatch = rest.match(/^\/tabs\/([^/]+)(\/.*)?$/);
    if (!tabMatch) {
      return false;
    }
    const tabId = decodeURIComponent(tabMatch[1] as string);
    const action = tabMatch[2] ?? "";

    if (action === "" && method === "DELETE") {
      await this.host.closeTab(sessionId, tabId);
      this.emitBrowser(sessionId, "browser.closed", { tabId });
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/navigate" && method === "POST") {
      const body = await readBody();
      await this.guard(sessionId, "preview_navigate", body);
      const tab = await this.navigateBody(sessionId, tabId, body);
      this.emitBrowser(sessionId, "browser.navigated", { tab });
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/back" && method === "POST") {
      const tab = await this.host.engineForAutomation().goBack(tabId);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/forward" && method === "POST") {
      const tab = await this.host.engineForAutomation().goForward(tabId);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/reload" && method === "POST") {
      const tab = await this.host.engineForAutomation().reload(tabId, false);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/hard-reload" && method === "POST") {
      const tab = await this.host.engineForAutomation().reload(tabId, true);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/stop" && method === "POST") {
      const tab = await this.host.engineForAutomation().stopLoading(tabId);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/snapshot" && method === "POST") {
      const snap = await this.host.engineForAutomation().captureSnapshot(tabId);
      this.json(res, 200, { snapshot: snap });
      return true;
    }
    if (action === "/screenshot" && method === "POST") {
      const bytes = await this.host.engineForAutomation().captureScreenshot(tabId);
      const dir = this.host.artifactsPath("screenshots");
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.png`;
      const path = join(dir, filename);
      await writeFile(path, bytes);
      this.json(res, 200, { pngBase64: bytes.toString("base64"), path });
      return true;
    }
    if (action === "/click" && method === "POST") {
      const body = await readBody();
      await this.guard(sessionId, "preview_click", body);
      await this.host.engineForAutomation().click(tabId, body as never);
      this.emitBrowser(sessionId, "browser.controller", { tabId, controller: "agent" });
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/mute" && method === "POST") {
      const body = await readBody();
      const tab = await this.host.engineForAutomation().setMuted(tabId, body["muted"] === true);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/viewport-metrics" && method === "POST") {
      const body = await readBody();
      const width = Number(body["width"]);
      const height = Number(body["height"]);
      const tab = await this.host.engineForAutomation().setViewport(tabId, {
        mode: "fill",
        width: Number.isFinite(width) ? width : 1280,
        height: Number.isFinite(height) ? height : 720,
        presetId: null,
        zoom: 1,
      });
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/resize" && method === "POST") {
      const body = await readBody();
      const tab = await this.host.engineForAutomation().setViewport(tabId, body["viewport"] as never);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/appearance" && method === "POST") {
      const body = await readBody();
      const tab = await this.host.engineForAutomation().setColorScheme(tabId, body["appearance"] as never);
      this.json(res, 200, { tab });
      return true;
    }
    if (action === "/type" && method === "POST") {
      const body = await readBody();
      await this.guard(sessionId, "preview_type", body);
      await this.host.engineForAutomation().type(tabId, body as never);
      this.work(sessionId, "preview_type", body);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/press" && method === "POST") {
      const body = await readBody();
      await this.guard(sessionId, "preview_press", body);
      await this.host.engineForAutomation().press(tabId, body as never);
      this.work(sessionId, "preview_press", body);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/scroll" && method === "POST") {
      const body = await readBody();
      await this.host.engineForAutomation().scroll(tabId, body as never);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/evaluate" && method === "POST") {
      const body = await readBody();
      await this.guard(sessionId, "preview_evaluate", body);
      const result = await this.host.engineForAutomation().evaluate(tabId, body as never);
      this.work(sessionId, "preview_evaluate", body);
      this.json(res, 200, { result });
      return true;
    }
    if (action === "/wait" && method === "POST") {
      const body = await readBody();
      await this.host.engineForAutomation().waitFor(tabId, body as never);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/pick/start" && method === "POST") {
      await this.host.engineForAutomation().startPick(tabId);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/pick/cancel" && method === "POST") {
      await this.host.engineForAutomation().cancelPick(tabId);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/pick/complete" && method === "POST") {
      const body = await readBody();
      this.options.emit("browser-pick", { sessionId, tabId, payload: body, at: Date.now() });
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/recording/start" && method === "POST") {
      await this.host.engineForAutomation().startRecording(tabId);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/recording/stop" && method === "POST") {
      const rec = await this.host.engineForAutomation().stopRecording(tabId);
      this.work(sessionId, "preview_recording_stop", rec);
      this.json(res, 200, rec);
      return true;
    }
    if (action === "/devtools" && method === "POST") {
      await this.host.engineForAutomation().openDevTools(tabId);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/context-menu/probe" && method === "POST") {
      const body = await readBody();
      const tab = await this.host.engineForAutomation().listTabs().then((tabs) => tabs.find((t) => t.tabId === tabId));
      const vw = tab?.viewport.width ?? 1280;
      const vh = tab?.viewport.height ?? 720;
      const cw = Number(body["canvasWidth"]) || vw;
      const ch = Number(body["canvasHeight"]) || vh;
      const x = (Number(body["x"]) / cw) * vw;
      const y = (Number(body["y"]) / ch) * vh;
      this.host.bumpControlEpoch(tabId);
      const probe = await this.host.engineForAutomation().probeContextMenu(tabId, x, y);
      this.json(res, 200, { probe });
      return true;
    }
    if (action === "/context-menu/action" && method === "POST") {
      const body = await readBody();
      const tab = await this.host.engineForAutomation().listTabs().then((tabs) => tabs.find((t) => t.tabId === tabId));
      const vw = tab?.viewport.width ?? 1280;
      const vh = tab?.viewport.height ?? 720;
      const cw = Number(body["canvasWidth"]) || vw;
      const ch = Number(body["canvasHeight"]) || vh;
      const x = (Number(body["x"]) / cw) * vw;
      const y = (Number(body["y"]) / ch) * vh;
      this.host.bumpControlEpoch(tabId);
      await this.host.engineForAutomation().runContextMenuAction(tabId, x, y, body["action"] as never);
      this.json(res, 200, { ok: true });
      return true;
    }
    if (action === "/pointer" && method === "POST") {
      const body = await readBody();
      this.host.bumpControlEpoch(tabId);
      const tab = await this.host.engineForAutomation().listTabs().then((tabs) => tabs.find((t) => t.tabId === tabId));
      const vw = tab?.viewport.width ?? 1280;
      const vh = tab?.viewport.height ?? 720;
      const cw = Number(body["canvasWidth"]) || vw;
      const ch = Number(body["canvasHeight"]) || vh;
      const x = (Number(body["x"]) / cw) * vw;
      const y = (Number(body["y"]) / ch) * vh;
      await this.host.engineForAutomation().click(tabId, { x, y });
      this.json(res, 200, { ok: true });
      return true;
    }

    return false;
  }

  private work(sessionId: string, verb: string, detail: Record<string, unknown>): void {
    this.options.onWorkLog?.(sessionId, verb, detail);
    this.options.emit("browser-work", { sessionId, verb, detail, at: Date.now() });
  }

  private async navigateBody(sessionId: string, tabId: string, body: Record<string, unknown>): Promise<BrowserTabSnapshot> {
    if (body["kind"] === "environment-port") {
      const port = Number(body["port"]);
      const pathPart = typeof body["path"] === "string" ? body["path"] : undefined;
      return await this.host.navigate(sessionId, tabId, { environmentPort: { port, path: pathPart } });
    }
    const url = typeof body["url"] === "string" ? body["url"] : undefined;
    return await this.host.navigate(sessionId, tabId, { url });
  }

  private async guard(sessionId: string, tool: string, body: Record<string, unknown>): Promise<void> {
    if (!this.options.requireApproval) {
      return;
    }
    const ok = await this.options.requireApproval(sessionId, tool, body);
    if (!ok) {
      throw new HttpError(403, "Browser action denied by approval policy.");
    }
  }

  private emitBrowser(sessionId: string, method: string, params: Record<string, unknown>): void {
    this.options.emit("browser", { sessionId, method, params, at: Date.now() });
  }

  private serveFrameStream(url: URL, res: ServerResponse): boolean {
    const sessionId = url.searchParams.get("sessionId");
    const tabId = url.searchParams.get("tabId");
    if (!sessionId || !tabId) {
      throw new HttpError(400, "sessionId and tabId are required.");
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const sink: FrameSink = {
      sessionId,
      tabId,
      write: (chunk) => {
        res.write(chunk);
      },
    };
    sink.unsubscribe = this.host.subscribeFrames(tabId, (frame: FramePayload) => {
      sink.write(`event: frame\ndata: ${JSON.stringify(frame)}\n\n`);
    });
    this.frameSinks.add(sink);
    res.on("close", () => {
      sink.unsubscribe?.();
      this.frameSinks.delete(sink);
    });
    return true;
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  }

  getHost(): BrowserHost {
    return this.host;
  }
}
