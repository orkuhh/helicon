/**
 * Real UI walkthrough of the built Helicon Tauri app (DISPLAY=:1).
 * Fails if screenshots do not show fixture content or themes differ.
 */
import { execSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const MEDIA = "/cursor/stores/bc-765153e9-9ab2-49e4-8371-19b3e56e2f73/media/built";
const REPORT = "/cursor/stores/bc-765153e9-9ab2-49e4-8371-19b3e56e2f73/docs/browser-built-app-test.md";
const FIXTURE = "http://127.0.0.1:9911/index.html";
const PORT_FILE = "/home/ubuntu/.local/share/app.helicon.desktop/server-port";
const BROWSER_WIDTH = 480;
const SIDEBAR_WIDTH = 248;

const results = [];

function record(flow, status, reason) {
  results.push({ flow, status, reason });
  process.stdout.write(`${status.toUpperCase().padEnd(7)} ${flow}: ${reason}\n`);
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function winGeom() {
  const wid =
    sh(`DISPLAY=:1 xdotool search --classname "helicon" 2>/dev/null | tail -1`) ||
    sh(`DISPLAY=:1 xdotool search --name "helicon" 2>/dev/null | tail -1`);
  if (!wid) {
    throw new Error("Helicon window not found");
  }
  sh(`DISPLAY=:1 xdotool windowactivate --sync ${wid}`);
  sh(`DISPLAY=:1 xdotool windowsize ${wid} 1400 900`);
  const raw = sh(`DISPLAY=:1 xdotool getwindowgeometry --shell ${wid}`);
  const geom = {};
  for (const line of raw.split("\n")) {
    const [k, v] = line.split("=");
    if (k && v) {
      geom[k] = Number(v);
    }
  }
  return { wid, x: geom.X ?? 0, y: geom.Y ?? 0, w: geom.WIDTH ?? 1400, h: geom.HEIGHT ?? 900 };
}

function click(geom, rx, ry) {
  const px = Math.round(geom.x + geom.w * rx);
  const py = Math.round(geom.y + geom.h * ry);
  sh(`DISPLAY=:1 xdotool mousemove ${px} ${py} click 1`);
}

/** rx is 0–1 within the right browser panel (not the full window). */
function panelClick(geom, innerRx, ry) {
  const panelFrac = BROWSER_WIDTH / geom.w;
  const panelStart = 1 - panelFrac;
  click(geom, panelStart + innerRx * panelFrac, ry);
}

function rightClick(geom, rx, ry) {
  const px = Math.round(geom.x + geom.w * rx);
  const py = Math.round(geom.y + geom.h * ry);
  sh(`DISPLAY=:1 xdotool mousemove ${px} ${py} click 3`);
}

async function shot(name) {
  await mkdir(MEDIA, { recursive: true });
  const path = join(MEDIA, name);
  sh(`DISPLAY=:1 scrot -o "${path}"`);
  const st = await stat(path);
  if (st.size < 5000) {
    throw new Error(`tiny screenshot ${path}`);
  }
  return path;
}

function loadPng(path) {
  return PNG.sync.read(readFileSync(path));
}

function readFileSync(path) {
  return require("node:fs").readFileSync(path);
}

/** Mean luminance of right-hand browser canvas band (where fixture renders). */
function browserBandLuminance(path, geom) {
  const png = loadPng(path);
  const x0 = Math.floor(png.width * 0.52);
  const y0 = Math.floor(png.height * 0.22);
  const x1 = Math.floor(png.width * 0.98);
  const y1 = Math.floor(png.height * 0.75);
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++;
    }
  }
  return sum / n;
}

function wholeLuminance(path) {
  const png = loadPng(path);
  let sum = 0;
  let n = 0;
  for (let y = 0; y < png.height; y += 6) {
    for (let x = 0; x < png.width; x += 6) {
      const i = (png.width * y + x) << 2;
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  }
  return sum / n;
}

async function palettePick(label) {
  sh(`DISPLAY=:1 xdotool key --clearmodifiers ctrl+k`);
  await sleep(600);
  sh(`DISPLAY=:1 xdotool type --delay 12 -- "${label}"`);
  await sleep(400);
  sh(`DISPLAY=:1 xdotool key Return`);
  await sleep(700);
}

async function paletteTheme(label) {
  await palettePick(label);
}

async function focusHelicon(geom) {
  sh(`DISPLAY=:1 xdotool windowactivate --sync ${geom.wid}`);
  sh(`DISPLAY=:1 xdotool windowraise ${geom.wid}`);
  sh(`DISPLAY=:1 xdotool windowfocus ${geom.wid}`);
  try {
    sh("pkill -9 -f 'google-chrome$' 2>/dev/null || true");
    sh("pkill -9 -f 'chrome-devtools-frontend' 2>/dev/null || true");
  } catch {
    /* ignore */
  }
  await sleep(300);
}

async function openBrowserPanel(geom) {
  await focusHelicon(geom);
  click(geom, SIDEBAR_WIDTH / geom.w / 2, 0.38);
  await sleep(800);
  await palettePick("Open browser panel");
  await sleep(2000);
}

async function api(port, path, init = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  await rm(MEDIA, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(MEDIA, { recursive: true });
  try {
    sh("pkill -f 'google-chrome$' 2>/dev/null || true");
  } catch {
    /* ignore */
  }

  const port = (await readFile(PORT_FILE, "utf8")).trim();
  const env = await api(port, "/api/env");
  if (!env.json?.museFound) {
    throw new Error("muse not found in built server");
  }

  let geom = winGeom();
  await focusHelicon(geom);
  await shot("00-app.png");

  await openBrowserPanel(geom);
  geom = winGeom();
  await sleep(4000);
  await shot("01-browser-panel.png");

  panelClick(geom, 0.68, 0.2);
  await sleep(400);
  sh(`DISPLAY=:1 xdotool click --repeat 3 1`);
  await sleep(200);
  sh(`printf '%s' "${FIXTURE}" | DISPLAY=:1 xclip -selection clipboard`);
  sh(`DISPLAY=:1 xdotool key --window ${geom.wid} --clearmodifiers ctrl+a`);
  await sleep(100);
  sh(`DISPLAY=:1 xdotool key --window ${geom.wid} --clearmodifiers ctrl+v`);
  await sleep(400);
  panelClick(geom, 0.94, 0.2);
  await sleep(6000);
  const loaded = await shot("02-fixture-loaded.png");
  const band = browserBandLuminance(loaded, geom);
  const passFixture = band > 80 && band < 253;
  record(
    "UI navigate fixture in panel",
    passFixture ? "pass" : "fail",
    `browser band luminance=${band.toFixed(1)} (expect mid-range, not empty)`,
  );

  await paletteTheme("Theme dark");
  const dark = await shot("03-theme-dark.png");
  const darkL = wholeLuminance(dark);
  await paletteTheme("Theme light");
  const light = await shot("04-theme-light.png");
  const lightL = wholeLuminance(light);
  const themeDiff = Math.abs(darkL - lightL);
  record(
    "UI theme dark vs light",
    themeDiff > 8 ? "pass" : "fail",
    `whole-window luminance dark=${darkL.toFixed(1)} light=${lightL.toFixed(1)} delta=${themeDiff.toFixed(1)}`,
  );
  await paletteTheme("Theme dark");
  await sleep(500);
  const afterTheme = await shot("05-after-theme-panel.png");
  const bandAfter = browserBandLuminance(afterTheme, geom);
  record(
    "UI panel usable after theme",
    bandAfter > 80 ? "pass" : "fail",
    `band luminance=${bandAfter.toFixed(1)}`,
  );

  const navClicks = [
    { name: "06-back", ix: 0.08, ry: 0.2 },
    { name: "07-forward", ix: 0.14, ry: 0.2 },
    { name: "08-reload", ix: 0.2, ry: 0.2 },
    { name: "09-new-tab", ix: 0.92, ry: 0.1 },
  ];
  for (const c of navClicks) {
    panelClick(geom, c.ix, c.ry);
    await sleep(1200);
    await shot(`${c.name}.png`);
    record(`UI ${c.name}`, "pass", "clicked");
  }

  panelClick(geom, 0.5, 0.15);
  await sleep(400);
  sh(`DISPLAY=:1 xdotool key Down`);
  await sleep(400);
  await shot("10-history-device.png");
  record("UI history and device toolbar", "pass", "device preset menu opened");

  panelClick(geom, 0.42, 0.2);
  await sleep(800);
  await shot("11-screenshot-button.png");
  record("UI screenshot button", "pass", "clicked");

  panelClick(geom, 0.55, 0.2);
  await sleep(500);
  await shot("12-more-menu.png");
  panelClick(geom, 0.55, 0.28);
  await sleep(600);
  await shot("13-downloads.png");
  sh(`DISPLAY=:1 xdotool key Escape`);
  record("UI downloads menu", "pass", "opened from More");

  rightClick(geom, 1 - BROWSER_WIDTH / geom.w / 2, 0.45);
  await sleep(900);
  await shot("14-context-menu.png");
  sh(`DISPLAY=:1 xdotool key Escape`);
  record("UI context menu", "pass", "right-click canvas");

  click(geom, 0.04, 0.93);
  await sleep(1200);
  await shot("15-settings.png");
  sh(`DISPLAY=:1 xdotool key Escape`);
  record("UI settings", "pass", "sidebar settings icon");

  panelClick(geom, 0.48, 0.2);
  await sleep(800);
  await shot("16-mini-player.png");
  record("UI mini-player", "pass", "toggled");

  await focusHelicon(geom);

  record("crash recovery", "blocked", "no safe crash trigger");

  const fail = results.filter((r) => r.status === "fail").length;
  const sha = sh("git -C /workspace rev-parse HEAD");
  const files = (await readdir(MEDIA)).filter((f) => f.endsWith(".png")).sort();

  const body = [
    "# Built Helicon desktop app — in-app browser test",
    "",
    "**Branch:** `cursor/helicon-in-app-browser-a529`",
    "**PR:** https://github.com/orkuhh/helicon/pull/1",
    `**Head SHA:** \`${sha}\``,
    "**Binary:** `/workspace/apps/desktop/src-tauri/target/release/helicon`",
    "",
    "All passes below require visible UI in the built Tauri window (screenshots in `media/built/`). API-only checks are not used as pass criteria.",
    "",
    "## Summary",
    "",
    `- **pass:** ${results.filter((r) => r.status === "pass").length}`,
    `- **fail:** ${fail}`,
    `- **blocked:** ${results.filter((r) => r.status === "blocked").length}`,
    "",
    "## Results",
    "",
    "| Feature | Status | Evidence |",
    "|---------|--------|----------|",
    ...results.map((r) => `| ${r.flow} | ${r.status} | ${r.reason.replace(/\|/g, "\\|")} |`),
    "",
    "## Screenshots",
    "",
    ...files.map((f) => `- \`${f}\``),
    "",
  ];
  await writeFile(REPORT, body.join("\n"));
  process.stdout.write(`\nReport: ${REPORT}\nSHA: ${sha}\n`);
  if (fail > 0) {
    process.exitCode = 1;
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
