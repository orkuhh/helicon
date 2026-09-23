import type { ApprovalMode } from "@helicon/daemon";

const READONLY_TOOLS = new Set([
  "preview_status",
  "preview_snapshot",
  "preview_wait_for",
  "preview_resize",
  "preview_set_appearance",
]);

const DESTRUCTIVE_TOOLS = new Set([
  "preview_click",
  "preview_type",
  "preview_press",
  "preview_evaluate",
]);

const OPEN_WORLD_TOOLS = new Set(["preview_open", "preview_navigate"]);

export function isLoopbackUrl(url: string): boolean {
  if (!url || url === "about:blank") {
    return true;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function urlFromToolDetail(tool: string, detail: Record<string, unknown>, tabUrl?: string): string {
  if (typeof detail["url"] === "string") {
    return detail["url"];
  }
  if (tool === "preview_navigate" && detail["kind"] === "environment-port") {
    return `http://localhost:${String(detail["port"] ?? "")}`;
  }
  return tabUrl ?? "";
}

/**
 * D9: loopback navigate/snapshot/wait/status/resize auto-allow; destructive/open-world follow session mode.
 * Returns true when the tool may run without an extra gate.
 */
export function previewToolAllowed(
  mode: ApprovalMode,
  tool: string,
  detail: Record<string, unknown>,
  options: { yolo?: boolean; tabUrl?: string } = {},
): boolean {
  if (options.yolo || mode === "allowAll") {
    return true;
  }
  if (READONLY_TOOLS.has(tool)) {
    return true;
  }
  const url = urlFromToolDetail(tool, detail, options.tabUrl);
  const loopback = isLoopbackUrl(url);
  if (loopback && (tool === "preview_navigate" || tool === "preview_open")) {
    return true;
  }
  if (mode === "denyUnmatched") {
    if (DESTRUCTIVE_TOOLS.has(tool) || OPEN_WORLD_TOOLS.has(tool)) {
      return loopback && (tool === "preview_navigate" || tool === "preview_open");
    }
    return true;
  }
  if (mode === "promptUnmatched" || mode === "onRequest") {
    if (DESTRUCTIVE_TOOLS.has(tool)) {
      return false;
    }
    if (OPEN_WORLD_TOOLS.has(tool)) {
      return loopback;
    }
    return true;
  }
  return true;
}
