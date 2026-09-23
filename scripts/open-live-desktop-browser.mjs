import { chromium } from "playwright-core";

const WEB = "http://127.0.0.1:5173";
const SESSION_ID = "s1";
const FIXTURE = "http://127.0.0.1:9911/index.html";

const browser = await chromium.launch({
  headless: false,
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-first-run", "--disable-session-crashed-bubble", "--start-maximized"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${WEB}#/t/${encodeURIComponent(SESSION_ID)}`, {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await page.waitForTimeout(2500);

const browserBtn = page.getByRole("button", { name: /Show browser|Hide browser/i }).first();
if (await browserBtn.isVisible().catch(() => false)) {
  const name = (await browserBtn.getAttribute("aria-label")) ?? "";
  if (/show browser/i.test(name)) {
    await browserBtn.click();
    await page.waitForTimeout(1500);
  }
}

const urlInput = page.locator('aside input[placeholder="https://"]');
if (await urlInput.isVisible().catch(() => false)) {
  await urlInput.fill(FIXTURE);
  await page.getByRole("button", { name: "Go" }).click();
  await page.waitForTimeout(3000);
}

await page.bringToFront();
await new Promise(() => {});
