import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeEngine } from "../src/fakeEngine.js";

describe("screencast frames", () => {
  it("emits jpeg/png data URLs over subscribeFrames", async () => {
    const engine = createFakeEngine({
      dataDir: "/tmp/helicon-test",
      profilesDir: "/tmp/helicon-test/profiles",
      artifactsDir: "/tmp/helicon-test/artifacts",
    });
    const tab = await engine.openTab({});
    const frames: string[] = [];
    const unsub = engine.subscribeFrames(tab.tabId, (f) => {
      frames.push(f.dataUrl);
    });
    await new Promise((r) => setTimeout(r, 200));
    unsub();
    await engine.close();
    assert.ok(frames.length > 0);
    assert.match(frames[0], /^data:image\//);
  });
});
