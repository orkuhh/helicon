import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Turn CDP screencast JPEG frames into a video artifact (ffmpeg when available). */
export async function finalizeRecordingFromJpegs(
  framesBase64: string[],
  outPath: string,
): Promise<{ path: string; bytes: number }> {
  await mkdir(dirname(outPath), { recursive: true });
  if (framesBase64.length === 0) {
    await writeFile(outPath, Buffer.alloc(0));
    const stat = await readFile(outPath);
    return { path: outPath, bytes: stat.byteLength };
  }
  const tmpDir = join(dirname(outPath), `rec-frames-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  try {
    for (let i = 0; i < framesBase64.length; i++) {
      const name = `frame${String(i).padStart(5, "0")}.jpg`;
      await writeFile(join(tmpDir, name), Buffer.from(framesBase64[i], "base64"));
    }
    const encoded = await encodeWithFfmpeg(tmpDir, outPath);
    if (encoded) {
      const bytes = (await readFile(outPath)).byteLength;
      return { path: outPath, bytes };
    }
    const fallback = outPath.replace(/\.webm$/i, ".png");
    await writeFile(fallback, Buffer.from(framesBase64[framesBase64.length - 1], "base64"));
    const bytes = (await readFile(fallback)).byteLength;
    return { path: fallback, bytes };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
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
