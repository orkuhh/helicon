import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWslHostUnion } from "../src/wslHosts.js";

describe("buildWslHostUnion", () => {
  it("includes localhost on non-windows", async () => {
    if (process.platform === "win32") {
      return;
    }
    const hosts = await buildWslHostUnion();
    assert.ok(hosts.includes("localhost"));
    assert.ok(hosts.includes("127.0.0.1"));
  });

  it("merges WSL addresses when exec succeeds on Windows", async () => {
    if (process.platform !== "win32") {
      return;
    }
    const hosts = await buildWslHostUnion(async () => ({
      stdout: "172.22.0.1 172.22.0.2\n",
      stderr: "",
      code: 0,
    }));
    assert.ok(hosts.includes("172.22.0.1"));
  });
});
