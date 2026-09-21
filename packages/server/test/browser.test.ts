import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HeliconServer } from "../src/server.js";

describe("browser API", () => {
  it("lists discovered servers", async () => {
    const server = new HeliconServer({ dataDir: ":memory:", browserUseFakeEngine: true });
    const { port } = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const res = await fetch(`${base}/api/browser/discovered`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { servers: unknown[] };
    assert.ok(Array.isArray(body.servers));
    await server.close();
  });
});
