import { normalizePreviewUrl } from "./url.js";

export interface EnvironmentPortTarget {
  kind: "environment-port";
  port: number;
  path?: string;
}

export interface ResolveEnvironmentPortInput {
  port: number;
  path?: string;
  /** Candidate base hosts, e.g. Windows localhost and WSL IP. */
  hosts: string[];
  probeHtml?: (url: string) => Promise<boolean>;
}

/** Pick the first host that serves HTML for the given dev port (WSL union). */
export async function resolveEnvironmentPortUrl(input: ResolveEnvironmentPortInput): Promise<string | null> {
  const path = input.path?.startsWith("/") ? input.path : `/${input.path ?? ""}`;
  const probe = input.probeHtml ?? defaultProbe;
  for (const host of input.hosts) {
    const base = host.includes("://") ? host : `http://${host}:${input.port}`;
    const candidate = normalizePreviewUrl(`${base.replace(/\/$/, "")}${path}`);
    if (!candidate) {
      continue;
    }
    if (await probe(candidate)) {
      return candidate;
    }
  }
  const fallback = normalizePreviewUrl(`http://localhost:${input.port}${path}`);
  return fallback;
}

async function defaultProbe(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    const type = res.headers.get("content-type") ?? "";
    return res.ok && (type.includes("text/html") || type.includes("application/json"));
  } catch {
    return false;
  }
}
