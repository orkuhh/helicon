import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLoopbackUrl, previewToolAllowed, urlFromToolDetail } from "../src/browserApproval.js";

describe("browserApproval (D9)", () => {
  it("treats localhost URLs as loopback", () => {
    assert.equal(isLoopbackUrl("http://localhost:5173/"), true);
    assert.equal(isLoopbackUrl("http://127.0.0.1:3000"), true);
    assert.equal(isLoopbackUrl("https://example.com"), false);
  });

  it("resolves navigate URLs from tool detail", () => {
    assert.equal(urlFromToolDetail("preview_navigate", { url: "http://localhost" }), "http://localhost");
    assert.equal(
      urlFromToolDetail("preview_navigate", { kind: "environment-port", port: 5173 }),
      "http://localhost:5173",
    );
  });

  it("auto-allows readonly tools in onRequest mode", () => {
    assert.equal(previewToolAllowed("onRequest", "preview_status", {}), true);
    assert.equal(previewToolAllowed("onRequest", "preview_snapshot", {}), true);
  });

  it("allows loopback navigate in onRequest mode", () => {
    assert.equal(previewToolAllowed("onRequest", "preview_navigate", { url: "http://localhost:5173" }), true);
  });

  it("denies destructive tools in onRequest mode", () => {
    assert.equal(previewToolAllowed("onRequest", "preview_click", {}, { tabUrl: "http://localhost" }), false);
    assert.equal(previewToolAllowed("onRequest", "preview_evaluate", { expression: "1" }), false);
  });

  it("denies external navigate in onRequest mode", () => {
    assert.equal(previewToolAllowed("onRequest", "preview_navigate", { url: "https://example.com" }), false);
  });

  it("honours allowAll and yolo", () => {
    assert.equal(previewToolAllowed("allowAll", "preview_evaluate", {}), true);
    assert.equal(previewToolAllowed("onRequest", "preview_evaluate", {}, { yolo: true }), true);
  });

  it("denyUnmatched blocks non-loopback open-world", () => {
    assert.equal(previewToolAllowed("denyUnmatched", "preview_navigate", { url: "https://evil.test" }), false);
    assert.equal(previewToolAllowed("denyUnmatched", "preview_navigate", { url: "http://127.0.0.1:8080" }), true);
  });
});
