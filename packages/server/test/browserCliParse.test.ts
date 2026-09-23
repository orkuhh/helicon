import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBrowserCliArgv } from "../src/browserCliParse.js";

describe("parseBrowserCliArgv", () => {
  it("parses host, session, tool, and flags", () => {
    const { config, tool, args } = parseBrowserCliArgv([
      "--host",
      "10.0.0.2",
      "--session",
      "s1",
      "preview_navigate",
      "--url",
      "http://localhost:5173",
    ]);
    assert.equal(config.host, "10.0.0.2");
    assert.equal(config.sessionId, "s1");
    assert.equal(tool, "preview_navigate");
    assert.equal(args["url"], "http://localhost:5173");
  });

  it("rejects unknown flags", () => {
    assert.throws(() => parseBrowserCliArgv(["--bogus", "x", "preview_status"]), /Unknown flag/);
  });
});
