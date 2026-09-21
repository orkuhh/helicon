import type { DiscoveredServer } from "./types.js";

export const COMMON_DEV_PORTS = [3000, 3001, 4321, 4173, 5173, 5174, 8080, 8000, 4200, 5000, 8888] as const;

const CACHE_MS = 15_000;

export interface PortScannerOptions {
  exec?: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>;
  configuredUrls?: string[];
  now?: () => number;
}

interface CacheEntry {
  at: number;
  servers: DiscoveredServer[];
}

let cache: CacheEntry | null = null;

export async function discoverLocalServers(options: PortScannerOptions = {}): Promise<DiscoveredServer[]> {
  const now = options.now ?? (() => Date.now());
  if (cache && now() - cache.at < CACHE_MS) {
    return cache.servers;
  }
  const configured = (options.configuredUrls ?? []).slice(0, 32);
  const fromLsof = await scanLsof(options.exec);
  const fromProbe = await probePorts(COMMON_DEV_PORTS, options.exec);
  const fromConfigured = await probeUrls(configured, options.exec);
  const seen = new Set<string>();
  const servers: DiscoveredServer[] = [];
  for (const s of [...fromLsof, ...fromProbe, ...fromConfigured]) {
    if (seen.has(s.url)) {
      continue;
    }
    seen.add(s.url);
    servers.push(s);
  }
  cache = { at: now(), servers };
  return servers;
}

async function scanWslLsof(exec?: PortScannerOptions["exec"]): Promise<DiscoveredServer[]> {
  if (!exec || process.platform !== "win32") {
    return [];
  }
  try {
    const { stdout, code } = await exec("wsl.exe", ["-e", "lsof", "-iTCP", "-sTCP:LISTEN", "-P", "-n"]);
    if (code !== 0) {
      return [];
    }
    const out: DiscoveredServer[] = [];
    for (const line of stdout.split("\n")) {
      const m = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (!m) {
        continue;
      }
      const port = Number(m[1]);
      out.push({ url: `http://localhost:${port}`, title: null, port, source: "lsof" });
    }
    return out;
  } catch {
    return [];
  }
}

async function scanLsof(
  exec?: PortScannerOptions["exec"],
): Promise<DiscoveredServer[]> {
  if (!exec) {
    return [];
  }
  if (process.platform === "win32") {
    return scanWslLsof(exec);
  }
  try {
    const { stdout, code } = await exec("lsof", ["-iTCP", "-sTCP:LISTEN", "-P", "-n"]);
    if (code !== 0) {
      return [];
    }
    const out: DiscoveredServer[] = [];
    for (const line of stdout.split("\n")) {
      const m = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (!m) {
        continue;
      }
      const port = Number(m[1]);
      if (!Number.isFinite(port)) {
        continue;
      }
      const url = `http://localhost:${port}`;
      out.push({ url, title: null, port, source: "lsof" });
    }
    return out;
  } catch {
    return [];
  }
}

async function probePorts(
  ports: readonly number[],
  exec?: PortScannerOptions["exec"],
): Promise<DiscoveredServer[]> {
  const out: DiscoveredServer[] = [];
  for (const port of ports) {
    const url = `http://localhost:${port}`;
    if (await htmlProbe(url, exec)) {
      out.push({ url, title: await fetchTitle(url, exec), port, source: "probe" });
    }
  }
  return out;
}

async function probeUrls(urls: string[], exec?: PortScannerOptions["exec"]): Promise<DiscoveredServer[]> {
  const out: DiscoveredServer[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) {
      continue;
    }
    try {
      const u = new URL(url.startsWith("http") ? url : `http://${url}`);
      if (await htmlProbe(u.toString(), exec)) {
        out.push({
          url: u.toString(),
          title: await fetchTitle(u.toString(), exec),
          port: u.port ? Number(u.port) : 80,
          source: "configured",
        });
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

async function htmlProbe(url: string, exec?: PortScannerOptions["exec"]): Promise<boolean> {
  if (exec && process.platform === "win32") {
    try {
      const { stdout, code } = await exec("curl", ["-sS", "-m", "2", "-o", "/dev/null", "-w", "%{http_code}", url]);
      return code === 0 && stdout.trim().startsWith("2");
    } catch {
      return false;
    }
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && type.includes("text/html");
  } catch {
    return false;
  }
}

async function fetchTitle(url: string, exec?: PortScannerOptions["exec"]): Promise<string | null> {
  try {
    let body: string;
    if (exec && process.platform === "win32") {
      const { stdout, code } = await exec("curl", ["-sS", "-m", "2", url]);
      if (code !== 0) {
        return null;
      }
      body = stdout;
    } else {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      body = await res.text();
    }
    const m = body.match(/<title[^>]*>([^<]*)<\/title>/i);
    return m ? m[1].trim().slice(0, 512) : null;
  } catch {
    return null;
  }
}

/** Test helper: clear discovery cache. */
export function resetPortScannerCache(): void {
  cache = null;
}
