import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import jpeg from "jpeg-js";
import type { RecordingCompositorOptions, RecordingFrameMeta } from "./recordingTypes.js";
import { drawRecordingOverlay } from "./recordingOverlay.js";

/** Turn CDP screencast JPEG frames into a video artifact (ffmpeg when available). */
export async function finalizeRecordingFromFrames(
  frames: RecordingFrameMeta[],
  outPath: string,
  overlay: RecordingCompositorOptions,
): Promise<{ path: string; bytes: number }> {
  await mkdir(dirname(outPath), { recursive: true });
  if (frames.length === 0) {
    await writeFile(outPath, Buffer.alloc(0));
    const stat = await readFile(outPath);
    return { path: outPath, bytes: stat.byteLength };
  }
  const tmpDir = join(dirname(outPath), `rec-frames-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  try {
    for (let i = 0; i < frames.length; i += 1) {
      const name = `frame${String(i).padStart(5, "0")}.jpg`;
      const buf = Buffer.from(frames[i].jpegBase64, "base64");
      const withOverlay = await applyOverlay(buf, frames[i], overlay);
      await writeFile(join(tmpDir, name), withOverlay);
    }
    const encoded = await encodeWithFfmpeg(tmpDir, outPath);
    if (encoded) {
      const bytes = (await readFile(outPath)).byteLength;
      return { path: outPath, bytes };
    }
    const fallback = outPath.replace(/\.webm$/i, ".png");
    const last = await applyOverlay(Buffer.from(frames[frames.length - 1].jpegBase64, "base64"), frames[frames.length - 1], overlay);
    await writeFile(fallback, last);
    return { path: fallback, bytes: last.byteLength };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function applyOverlay(jpegBuf: Buffer, meta: RecordingFrameMeta, options: RecordingCompositorOptions): Promise<Buffer> {
  if (!options.showMouse && !options.showKeys) {
    return jpegBuf;
  }
  if (!meta.cursor && !meta.keyLabel) {
    return jpegBuf;
  }
  const decoded = jpeg.decode(jpegBuf, { useTArray: true });
  const metaCopy = {
    cursor: options.showMouse ? meta.cursor : undefined,
    keyLabel: options.showKeys ? meta.keyLabel : undefined,
  };
  drawRecordingOverlay(decoded.width, decoded.height, decoded.data, metaCopy);
  const encoded = jpeg.encode({ data: decoded.data, width: decoded.width, height: decoded.height }, 80);
  return Buffer.from(encoded.data);
}

/** @deprecated use finalizeRecordingFromFrames */
export async function finalizeRecordingFromJpegs(
  framesBase64: string[],
  outPath: string,
): Promise<{ path: string; bytes: number }> {
  return await finalizeRecordingFromFrames(
    framesBase64.map((jpegBase64) => ({ jpegBase64 })),
    outPath,
    { showMouse: true, showKeys: true },
  );
}

function encodeWithFfmpeg(framesDir: string, outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-framerate",
      "12",
      "-i",
      join(framesDir, "frame%05d.jpg"),
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuv420p",
      outPath,
    ];
    const child = spawn("ffmpeg", args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}
