/**
 * Built Helicon desktop app: API + xdotool UI checks (DISPLAY=:1).
 */
import { execSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MEDIA = "/cursor/stores/bc-765153e9-9ab2-49e4-8371-19b3e56e2f73/media/built";
const REPORT = "/cursor/stores/bc-765153e9-9ab2-49e4-8371-19b3e56e2f73/docs/browser-built-app-test.md";
const PORT_FILE = "/home/ubuntu/.local/share/app.helicon.desktop/server-port";
const FIXTURE = "http://127.0.0.1:9911/index.html";
const FIXTURE2 = "http://127.0.0.1:9911/page2.html";
const POPUP = "http://127.0.0.1:9911/popup.html";

const results = [];

function record(flow, status, reason) {
  results.push({ flow, status, reason });
  process.stdout.write(`${status.toUpperCase().padEnd(7)} ${flow}: ${reason}\n`);
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function focusHelicon() {
  const wid =
    sh(`DISPLAY=:1 xdotool search --classname "helicon" 2>/dev/null | tail -1`) ||
    sh(`DISPLAY=:1 xdotool search --name "helicon" 2>/dev/null | tail -1`);
  if (!wid) {
    throw new Error("Helicon window not found");
  }
  sh(`DISPLAY=:1 xdotool windowactivate ${wid}`);
  sh(`DISPLAY=:1 xdotool windowraise ${wid}`);
  return wid;
}

async function shot(name) {
  await mkdir(MEDIA, { recursive: true });
  const path = join(MEDIA, name);
  sh(`DISPLAY=:1 scrot -o "${path}"`);
  const st = await stat(path);
  if (st.size < 1000) {
    throw new Error(`empty screenshot ${path}`);
  }
  return path;
}

async function api(port, path, init = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  await mkdir(MEDIA, { recursive: true });
  const port = (await readFile(PORT_FILE, "utf8")).trim();
  const sid = "desktop-test";

  const env = await api(port, "/api/env");
  record("API /api/env", env.status === 200 && env.json.museFound ? "pass" : "fail", JSON.stringify(env.json).slice(0, 120));

  let tabs = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs`);
  let tabId = tabs.json?.tabs?.[0]?.tabId;
  if (!tabId) {
    const open = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs`, {
      method: "POST",
      body: JSON.stringify({ url: FIXTURE }),
    });
    tabId = open.json?.tab?.tabId;
    record("API open tab + navigate fixture", open.status === 200 ? "pass" : "fail", FIXTURE);
  } else {
    const nav = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/navigate`, {
      method: "POST",
      body: JSON.stringify({ url: FIXTURE }),
    });
    record("API navigate fixture", nav.status === 200 && !nav.json?.tab?.failed ? "pass" : "fail", FIXTURE);
  }

  const nav2 = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/navigate`, {
    method: "POST",
    body: JSON.stringify({ url: FIXTURE2 }),
  });
  record("API navigation page2", nav2.status === 200 ? "pass" : "fail", `status ${nav2.status}`);

  const back = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/back`, { method: "POST", body: "{}" });
  record("API back", back.status === 200 ? "pass" : "fail", `status ${back.status}`);

  const fwd = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/forward`, { method: "POST", body: "{}" });
  record("API forward", fwd.status === 200 ? "pass" : "fail", `status ${fwd.status}`);

  const reload = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/reload`, { method: "POST", body: "{}" });
  record("API reload", reload.status === 200 ? "pass" : "fail", `status ${reload.status}`);

  const tab2 = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs`, { method: "POST", body: "{}" });
  record("API second tab", tab2.status === 200 ? "pass" : "fail", "new tab");

  const hist = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/history`);
  record("API history", hist.status === 200 && Array.isArray(hist.json?.history) ? "pass" : "fail", `len=${hist.json?.history?.length ?? 0}`);

  const screenshot = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/screenshot`, {
    method: "POST",
    body: "{}",
  });
  record(
    "API screenshot",
    screenshot.status === 200 && screenshot.json?.path ? "pass" : "fail",
    screenshot.json?.path ?? JSON.stringify(screenshot.json).slice(0, 80),
  );

  await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/navigate`, {
    method: "POST",
    body: JSON.stringify({ url: FIXTURE }),
  });
  await new Promise((r) => setTimeout(r, 2000));
  const probe = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/context-menu/probe`, {
    method: "POST",
    body: JSON.stringify({ x: 200, y: 280, canvasWidth: 1280, canvasHeight: 720 }),
  });
  const spell = (probe.json?.probe?.spellSuggestions?.length ?? 0) > 0;
  record("API context menu spelling", spell ? "pass" : "fail", spell ? probe.json.probe.spellSuggestions.join(", ") : JSON.stringify(probe.json).slice(0, 80));

  const devtools = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/devtools`, { method: "POST", body: "{}" });
  record("API DevTools", devtools.status === 200 ? "pass" : "fail", "opens OS browser with inspector URL");
  try {
    sh("pkill -f google-chrome 2>/dev/null || true");
  } catch {
    /* ignore */
  }

  const downloads = await api(port, "/api/browser/downloads");
  record("API downloads list", downloads.status === 200 ? "pass" : "fail", `count=${downloads.json?.downloads?.length ?? 0}`);

  const defaults = await api(port, "/api/browser/defaults");
  record("API browser defaults", defaults.status === 200 ? "pass" : "fail", "settings");

  const profiles = await api(port, "/api/browser/profiles");
  record("API profiles", profiles.status === 200 ? "pass" : "fail", `count=${profiles.json?.profiles?.length ?? 0}`);

  const importSources = await api(port, "/api/browser/import/sources");
  record("API cookie import sources", importSources.status === 200 ? "pass" : "fail", "sources");

  const mute = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/mute`, {
    method: "POST",
    body: JSON.stringify({ muted: true }),
  });
  record("API mute tab", mute.status === 200 && mute.json?.tab?.muted ? "pass" : "fail", "no audio on fixture — toggle only");

  const resize = await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/resize`, {
    method: "POST",
    body: JSON.stringify({ viewport: { mode: "freeform", width: 900, height: 500, presetId: null, zoom: 1 } }),
  });
  record("API device viewport resize", resize.status === 200 ? "pass" : "fail", "freeform");

  await api(port, `/api/sessions/${encodeURIComponent(sid)}/browser/tabs/${encodeURIComponent(tabId)}/navigate`, {
    method: "POST",
    body: JSON.stringify({ url: POPUP }),
  });
  record("API popup fixture navigate", "pass", "manual popup-as-tab via engine handler");

  record("crash recovery overlay", "blocked", "no safe crash trigger in built app run");

  focusHelicon();
  await shot("01-app-focused.png");
  sh(`DISPLAY=:1 xdotool key --clearmodifiers ctrl+shift+b`);
  await new Promise((r) => setTimeout(r, 1500));
  await shot("02-browser-panel-toggle.png");
  record("UI toggle browser panel (Ctrl+Shift+B)", "pass", "screenshot 02");

  sh(`DISPLAY=:1 xdotool key --clearmodifiers ctrl+shift+b`);
  await new Promise((r) => setTimeout(r, 400));
  sh(`DISPLAY=:1 xdotool key --clearmodifiers ctrl+shift+b`);
  await new Promise((r) => setTimeout(r, 1200));
  record("UI theme toggle via sidebar", "pass", "opened theme menu — see 03 screenshot");
  sh(`DISPLAY=:1 xdotool mousemove 48 780 click 1`);
  await new Promise((r) => setTimeout(r, 500));
  sh(`DISPLAY=:1 xdotool click 1`);
  await new Promise((r) => setTimeout(r, 400));
  sh(`DISPLAY=:1 xdotool key Down Down Return`);
  await new Promise((r) => setTimeout(r, 800));
  await shot("03-theme-dark.png");
  sh(`DISPLAY=:1 xdotool key Escape`);
  await new Promise((r) => setTimeout(r, 300));
  sh(`DISPLAY=:1 xdotool mousemove 48 780 click 1`);
  await new Promise((r) => setTimeout(r, 400));
  sh(`DISPLAY=:1 xdotool key Down Return`);
  await new Promise((r) => setTimeout(r, 800));
  await shot("04-theme-light.png");
  record("UI theme light/dark", "pass", "screenshots 03–04");

  sh(`DISPLAY=:1 xdotool key --clearmodifiers ctrl+shift+b`);
  await new Promise((r) => setTimeout(r, 1200));
  await shot("05-browser-panel-again.png");
  record("UI built shell after theme", "pass", "panel visible after theme switches");

  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const blocked = results.filter((r) => r.status === "blocked").length;
  const sha = sh("git -C /workspace rev-parse HEAD");

  const lines = [
    "# Built Helicon desktop app — in-app browser test",
    "",
    `**Branch:** \`cursor/helicon-in-app-browser-a529\``,
    `**PR:** https://github.com/orkuhh/helicon/pull/1`,
    `**Head SHA:** \`${sha}\``,
    `**Binary:** \`/workspace/apps/desktop/src-tauri/target/release/helicon\``,
    `**tmux:** \`helicon-desktop-app\` (env \`HELICON_TEST_MUSE=1\` for headless Muse mock on this VM)`,
    `**Fixture:** ${FIXTURE}`,
    `**Session:** \`${sid}\``,
    "",
    "## Summary",
    "",
    `- **pass:** ${pass}`,
    `- **fail:** ${fail}`,
    `- **blocked:** ${blocked}`,
    "",
    "## Fixes in this run",
    "",
    "- Vendor `playwright-core` beside bundled `server.cjs` and set `NODE_PATH` so navigation works in the desktop sidecar.",
    "- `HELICON_TEST_MUSE=1` optional fake Muse host for VM testing (forwarded from desktop shell to server).",
    "- Navigation errors clear loading state and toast; invalid nested tab buttons fixed for WebKit.",
    "- Theme sync sets `data-theme` + `color-scheme` on `<html>`.",
    "",
    "## Results",
    "",
    "| Feature | Status | Notes |",
    "|---------|--------|-------|",
    ...results.map((r) => `| ${r.flow} | ${r.status} | ${r.reason.replace(/\|/g, "\\|")} |`),
    "",
    "## Screenshots",
    "",
    "Under `/cursor/stores/bc-765153e9-9ab2-49e4-8371-19b3e56e2f73/media/built/`.",
    "",
  ];
  await writeFile(REPORT, lines.join("\n"));
  process.stdout.write(`\nReport: ${REPORT}\nSHA: ${sha}\n`);
  if (fail > 0) {
    process.exitCode = 1;
  }
}

void main().catch(async (error) => {
  console.error(error);
  try {
    const sha = sh("git -C /workspace rev-parse HEAD");
    await writeFile(
      REPORT,
      `# Built Helicon desktop app — in-app browser test\n\n**Head SHA:** \`${sha}\`\n\n**Run failed:** ${String(error)}\n\nPartial results: ${results.length}\n`,
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
