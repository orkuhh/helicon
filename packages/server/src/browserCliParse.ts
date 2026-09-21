import { PREVIEW_TOOL_NAMES } from "./mcpPreview.js";

export const PREVIEW_TOOLS = new Set<string>(PREVIEW_TOOL_NAMES);

export interface CliConfig {
  host: string;
  port: number;
  token: string | null;
  sessionId: string | null;
}

const GLOBAL_FLAGS_WITH_VALUE = new Set(["--host", "--port", "--token", "--session", "--tab", "--json"]);

export function parseBrowserCliArgv(argv: string[]): { config: CliConfig; tool: string | null; args: Record<string, unknown> } {
  let toolIndex = -1;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      continue;
    }
    if (GLOBAL_FLAGS_WITH_VALUE.has(a)) {
      i += 1;
      continue;
    }
    if (a.startsWith("--")) {
      throw new Error(`Unknown flag: ${a}`);
    }
    toolIndex = i;
    break;
  }

  const config: CliConfig = { host: "127.0.0.1", port: 3127, token: null, sessionId: null };
  let tabId: string | null = null;
  let jsonArgs: Record<string, unknown> | null = null;
  const prefix = toolIndex >= 0 ? argv.slice(0, toolIndex) : argv;
  for (let i = 0; i < prefix.length; i += 1) {
    const a = prefix[i];
    if (a === "--help" || a === "-h") {
      continue;
    }
    if (a === "--host" && prefix[i + 1]) {
      config.host = prefix[++i] as string;
      continue;
    }
    if (a === "--port" && prefix[i + 1]) {
      config.port = Number.parseInt(prefix[++i] as string, 10);
      continue;
    }
    if (a === "--token" && prefix[i + 1]) {
      config.token = prefix[++i] as string;
      continue;
    }
    if (a === "--session" && prefix[i + 1]) {
      config.sessionId = prefix[++i] as string;
      continue;
    }
    if (a === "--tab" && prefix[i + 1]) {
      tabId = prefix[++i] as string;
      continue;
    }
    if (a === "--json" && prefix[i + 1]) {
      jsonArgs = JSON.parse(prefix[++i] as string) as Record<string, unknown>;
      continue;
    }
    if (a.startsWith("--")) {
      throw new Error(`Unknown flag: ${a}`);
    }
  }

  const positional = toolIndex >= 0 ? argv.slice(toolIndex) : [];
  const tool = positional[0] ?? null;
  const args: Record<string, unknown> = jsonArgs ? { ...jsonArgs } : {};
  if (tabId) {
    args["tabId"] = tabId;
  }
  for (let j = 1; j < positional.length; j += 2) {
    const key = positional[j];
    const val = positional[j + 1];
    if (!key || val === undefined) {
      break;
    }
    if (key.startsWith("--")) {
      args[key.slice(2)] = coerce(val);
    } else {
      args[key] = coerce(val);
    }
  }
  return { config, tool, args };
}

function coerce(raw: string): unknown {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (/^-?\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    return Number.parseFloat(raw);
  }
  return raw;
}
