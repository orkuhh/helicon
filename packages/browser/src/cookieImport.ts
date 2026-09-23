import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type ImportSource = "firefox" | "chrome" | "edge" | "brave" | "unsupported";

export interface CookieImportResult {
  imported: number;
  skipped: number;
  skippedDomains: string[];
  reason?: string;
}

export interface NetscapeCookie {
  domain: string;
  path: string;
  secure: boolean;
  expires: number;
  name: string;
  value: string;
}

/** Firefox cookies.sqlite is plaintext on all platforms when the browser is quit. */
export function firefoxProfileDir(): string | null {
  const base =
    process.platform === "darwin"
      ? join(homedir(), "Library/Application Support/Firefox/Profiles")
      : process.platform === "win32"
        ? join(process.env["APPDATA"] ?? homedir(), "Mozilla/Firefox/Profiles")
        : join(homedir(), ".mozilla/firefox");
  return base;
}

export async function listImportSources(): Promise<{ id: ImportSource; name: string; available: boolean; reason?: string }[]> {
  const sources: { id: ImportSource; name: string; available: boolean; reason?: string }[] = [
    { id: "firefox", name: "Firefox", available: Boolean(firefoxProfileDir()) },
  ];
  if (process.platform === "win32") {
    sources.push({
      id: "chrome",
      name: "Google Chrome",
      available: false,
      reason: "unsupportedPlatform",
    });
    sources.push({
      id: "edge",
      name: "Microsoft Edge",
      available: false,
      reason: "unsupportedPlatform",
    });
  } else {
    sources.push({ id: "chrome", name: "Google Chrome", available: true });
    sources.push({ id: "brave", name: "Brave", available: true });
  }
  return sources;
}

/** Parse Netscape cookies.txt format (exported cookies). */
export function parseNetscapeCookies(text: string): NetscapeCookie[] {
  const out: NetscapeCookie[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const parts = line.split("\t");
    if (parts.length < 7) {
      continue;
    }
    out.push({
      domain: parts[0],
      path: parts[2],
      secure: parts[3] === "TRUE",
      expires: Number.parseInt(parts[4], 10),
      name: parts[5],
      value: parts[6],
    });
  }
  return out;
}

export async function importCookiesFromNetscapeFile(filePath: string): Promise<CookieImportResult> {
  const text = await readFile(filePath, "utf8");
  const cookies = parseNetscapeCookies(text);
  return { imported: cookies.length, skipped: 0, skippedDomains: [] };
}
