import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { finalizeRecordingFromJpegs } from "../src/recordingCompositor.js";

describe("finalizeRecordingFromJpegs", () => {
  it("writes an artifact for empty frame lists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "helicon-rec-"));
    try {
      const empty = await finalizeRecordingFromJpegs([], join(dir, "empty.webm"));
      assert.equal(empty.bytes, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
