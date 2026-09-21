import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { BrowserHost, type HeliconStore } from "@helicon/daemon";
import type { BrowserTabSnapshot, FramePayload } from "@helicon/browser";
import { HttpError } from "./httpError.js";

export type BrowserEventEmitter = (type: string, data: unknown) => void;

export interface BrowserApiOptions {
  store: HeliconStore;
  emit: BrowserEventEmitter;
  useFakeEngine?: boolean;
  requireApproval?: (sessionId: string, tool: string, detail: Record<string, unknown>) => Promise<boolean>;
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
    this.host = new BrowserHost(options.store, { useFakeEngine: options.useFakeEngine });
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

    if (rest === "/tabs" && method === "GET") {
      const tabs = await this.host.listTabs(sessionId);
      this.json(res, 200, { tabs });
      return true;
    }
    if (rest === "/tabs" && method === "POST") {
      const body = await readBody();
      const url = typeof body["url"] === "string" ? body["url"] : undefined;
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
    if (action === "/snapshot" && method === "POST") {
      const snap = await this.host.engineForAutomation().captureSnapshot(tabId);
      this.json(res, 200, { snapshot: snap });
      return true;
    }
    if (action === "/screenshot" && method === "POST") {
      const bytes = await this.host.engineForAutomation().captureScreenshot(tabId);
      this.json(res, 200, { pngBase64: bytes.toString("base64") });
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

    return false;
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
