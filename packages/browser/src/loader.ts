import type { BrowserEngine, BrowserEngineOptions } from "./engine.js";

/** Load the Playwright-backed engine without pulling playwright-core into every consumer bundle. */
export async function loadPlaywrightEngine(options: BrowserEngineOptions): Promise<BrowserEngine> {
  const mod = await import("./playwrightEngine.js");
  return await mod.createPlaywrightEngine(options);
}
