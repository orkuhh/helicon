import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HeliconServer, type HostHandle } from "../src/server.js";
import type { ServeTarget } from "@helicon/daemon";

class FakeConnection {
  replies = new Map<string, unknown>();

  async command(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const reply = this.replies.get(method);
    if (reply instanceof Error) {
      throw reply;
    }
    if (typeof reply === "function") {
      return (reply as (p: Record<string, unknown>) => unknown)(params);
    }
    return reply ?? { ok: true };
  }
  async request(): Promise<unknown> {
    return { ok: true };
  }
  onNotification(): void {}
}

function fakeFactory(connection: FakeConnection): (target: ServeTarget) => HostHandle {
  return () => ({
    start: async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { initializeResult: { serverInfo: { name: "muse", version: "1.1.1" } } };
    },
    connection: connection as never,
    close: async () => ({ code: 0, signal: null }),
    onExit: () => {},
  });
}

describe("browser API", () => {
  it("lists discovered servers", async () => {
    const connection = new FakeConnection();
    const server = new HeliconServer({
      port: 0,
      dataDir: ":memory:",
      platform: "linux",
      musePath: "muse",
      browserUseFakeEngine: true,
      hostFactory: fakeFactory(connection),
      exec: async () => ({ stdout: "", exitCode: 127 }),
    });
    const { port } = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const res = await fetch(`${base}/api/browser/discovered`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { servers: unknown[] };
    assert.ok(Array.isArray(body.servers));
    await server.close();
  });

  it("opens a tab and starts pick mode", async () => {
    const connection = new FakeConnection();
    connection.replies.set("session/start", { session: { sessionId: "s1", modelId: "muse-spark-1.3" } });
    const server = new HeliconServer({
      port: 0,
      dataDir: ":memory:",
      platform: "linux",
      musePath: "muse",
      browserUseFakeEngine: true,
      hostFactory: fakeFactory(connection),
      exec: async () => ({ stdout: "", exitCode: 127 }),
    });
    const { port } = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const created = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: "/work/proj" }),
    });
    assert.equal(created.status, 200);
    const sessionId = ((await created.json()) as { session: { sessionId: string } }).session.sessionId;
    const open = await fetch(`${base}/api/sessions/${sessionId}/browser/tabs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(open.status, 200);
    const tab = (await open.json()) as { tab: { tabId: string } };
    const pick = await fetch(`${base}/api/sessions/${sessionId}/browser/tabs/${tab.tab.tabId}/pick/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(pick.status, 200);
    await server.close();
  });

  it("denies destructive MCP tools under default approval (D9)", async () => {
    const connection = new FakeConnection();
    connection.replies.set("session/start", { session: { sessionId: "s1", modelId: "muse-spark-1.3" } });
    const server = new HeliconServer({
      port: 0,
      dataDir: ":memory:",
      platform: "linux",
      musePath: "muse",
      browserUseFakeEngine: true,
      hostFactory: fakeFactory(connection),
      exec: async () => ({ stdout: "", exitCode: 127 }),
    });
    const { port } = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const created = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: "/work/proj" }),
    });
    const sessionId = ((await created.json()) as { session: { sessionId: string } }).session.sessionId;
    await fetch(`${base}/api/sessions/${sessionId}/browser/tabs`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const denied = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, name: "preview_evaluate", arguments: { expression: "1+1" } }),
    });
    assert.equal(denied.status, 403);
    await server.close();
  });
});
