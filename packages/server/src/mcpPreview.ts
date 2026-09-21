import type { BrowserHost } from "@helicon/daemon";

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** Minimal MCP-style handler for preview_* tools (HTTP POST /mcp). */
export class PreviewMcpToolkit {
  constructor(
    private readonly resolveSessionId: () => string | null,
    private readonly host: BrowserHost,
    private readonly onWorkLog?: (verb: string, detail: Record<string, unknown>) => void,
  ) {}

  async invoke(call: McpToolCall): Promise<McpToolResult> {
    const sessionId = this.resolveSessionId();
    if (!sessionId) {
      return { content: [{ type: "text", text: "No active session for browser automation." }], isError: true };
    }
    const engine = this.host.engineForAutomation();
    const tabId = typeof call.arguments["tabId"] === "string" ? call.arguments["tabId"] : undefined;
    const tabs = await this.host.listTabs(sessionId);
    const active = tabId ?? tabs[0]?.tabId;
    if (!active) {
      return { content: [{ type: "text", text: "No browser tab open." }], isError: true };
    }
    this.onWorkLog?.(call.name, { tabId: active, ...call.arguments });

    switch (call.name) {
      case "preview_status": {
        const tab = tabs.find((t) => t.tabId === active) ?? tabs[0];
        return { content: [{ type: "text", text: JSON.stringify(tab) }] };
      }
      case "preview_open": {
        const url = typeof call.arguments["url"] === "string" ? call.arguments["url"] : undefined;
        const tab = await this.host.openTab(sessionId, url);
        return { content: [{ type: "text", text: JSON.stringify(tab) }] };
      }
      case "preview_navigate": {
        const tab = await this.host.navigate(sessionId, active, {
          url: typeof call.arguments["url"] === "string" ? call.arguments["url"] : undefined,
          environmentPort:
            call.arguments["kind"] === "environment-port"
              ? { port: Number(call.arguments["port"]), path: typeof call.arguments["path"] === "string" ? call.arguments["path"] : undefined }
              : undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(tab) }] };
      }
      case "preview_snapshot": {
        const snap = await engine.captureSnapshot(active);
        return {
          content: [
            { type: "text", text: JSON.stringify({ ...snap, pngBase64: `[${snap.pngBase64.length} bytes]` }) },
          ],
        };
      }
      case "preview_click":
        await engine.click(active, call.arguments as never);
        return { content: [{ type: "text", text: "ok" }] };
      case "preview_type":
        await engine.type(active, call.arguments as never);
        return { content: [{ type: "text", text: "ok" }] };
      case "preview_press":
        await engine.press(active, call.arguments as never);
        return { content: [{ type: "text", text: "ok" }] };
      case "preview_scroll":
        await engine.scroll(active, call.arguments as never);
        return { content: [{ type: "text", text: "ok" }] };
      case "preview_evaluate":
        const result = await engine.evaluate(active, call.arguments as never);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      case "preview_wait_for":
        await engine.waitFor(active, call.arguments as never);
        return { content: [{ type: "text", text: "ok" }] };
      case "preview_resize": {
        const tab = await engine.setViewport(active, call.arguments["viewport"] as never);
        return { content: [{ type: "text", text: JSON.stringify(tab) }] };
      }
      case "preview_set_appearance": {
        const tab = await engine.setColorScheme(active, call.arguments["appearance"] as never);
        return { content: [{ type: "text", text: JSON.stringify(tab) }] };
      }
      case "preview_recording_start":
        await engine.startRecording(active);
        return { content: [{ type: "text", text: "recording" }] };
      case "preview_recording_stop": {
        const rec = await engine.stopRecording(active);
        return { content: [{ type: "text", text: JSON.stringify(rec) }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool ${call.name}` }], isError: true };
    }
  }
}

export const PREVIEW_TOOL_NAMES = [
  "preview_status",
  "preview_open",
  "preview_navigate",
  "preview_resize",
  "preview_set_appearance",
  "preview_snapshot",
  "preview_click",
  "preview_type",
  "preview_press",
  "preview_scroll",
  "preview_evaluate",
  "preview_wait_for",
  "preview_recording_start",
  "preview_recording_stop",
] as const;
