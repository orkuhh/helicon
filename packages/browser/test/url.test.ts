import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collapseLoopbackHost, isAllowedNavigationUrl, normalizePreviewUrl, stripCredentials } from "../src/url.js";

describe("normalizePreviewUrl", () => {
  it("adds https for bare domains", () => {
    assert.equal(normalizePreviewUrl("example.com"), "https://example.com/");
  });
  it("adds http for localhost", () => {
    assert.equal(normalizePreviewUrl("localhost:5173"), "http://localhost:5173/");
  });
  it("rejects javascript", () => {
    assert.equal(normalizePreviewUrl("javascript:alert(1)"), null);
  });
});

describe("security helpers", () => {
  it("allows http(s) only", () => {
    assert.equal(isAllowedNavigationUrl("https://x.com"), true);
    assert.equal(isAllowedNavigationUrl("file:///etc/passwd"), false);
  });
  it("strips credentials", () => {
    assert.equal(stripCredentials("https://user:pass@example.com/x"), "https://example.com/x");
  });
  it("collapses loopback", () => {
    assert.match(collapseLoopbackHost("http://127.0.0.1:3000"), /local/);
  });
});
