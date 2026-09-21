#!/usr/bin/env node
import { PREVIEW_TOOL_NAMES } from "./mcpPreview.js";

const TOOLS = new Set<string>(PREVIEW_TOOL_NAMES);

interface CliConfig {
  host: string;
  port: number;
  token: string | null;
  sessionId: string | null;
}

function usage(): string {
  return [
    "helicon-browser: argv-parsed proxy to Helicon preview_* tools (POST /mcp).",
    "",
    "Usage:",
    "  helicon-browser --session <id> [options] <tool> [--key value ...]",
    "",
    "Options:",
    "  --host <addr>     daemon host (default 127.0.0.1)",
    "  --port <n>        daemon port (default 3127)",
    "  --token <value>   auth token when required",
    "  --session <id>    session id (required)",
    "  --tab <tabId>     tab id (optional; passed as tabId argument)",
    "  --json <text>     raw JSON arguments object",
    "",
    "Tools:",
    `  ${PREVIEW_TOOL_NAMES.join(", ")}`,
    "",
    "Examples:",
    "  helicon-browser --session abc preview_status",
    "  helicon-browser --session abc preview_navigate --url http://localhost:5173",
    "  helicon-browser --session abc preview_navigate --json '{\"kind\":\"environment-port\",\"port\":5173}'",
  ].join("\n");
}

function parseArgv(argv: string[]): { config: CliConfig; tool: string | null; args: Record<string, unknown> } {
  const config: CliConfig = { host: "127.0.0.1", port: 3127, token: null, sessionId: null };
  let tabId: string | null = null;
  let jsonArgs: Record<string, unknown> | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (a === "--host" && argv[i + 1]) {
      config.host = argv[++i] as string;
      continue;
    }
    if (a === "--port" && argv[i + 1]) {
      config.port = Number.parseInt(argv[++i] as string, 10);
      continue;
    }
    if (a === "--token" && argv[i + 1]) {
      config.token = argv[++i] as string;
      continue;
    }
    if (a === "--session" && argv[i + 1]) {
      config.sessionId = argv[++i] as string;
      continue;
    }
    if (a === "--tab" && argv[i + 1]) {
      tabId = argv[++i] as string;
      continue;
    }
    if (a === "--json" && argv[i + 1]) {
      jsonArgs = JSON.parse(argv[++i] as string) as Record<string, unknown>;
      continue;
    }
    if (a.startsWith("--")) {
      throw new Error(`Unknown flag: ${a}`);
    }
    positional.push(a);
  }
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

async function main(): Promise<void> {
  const { config, tool, args } = parseArgv(process.argv.slice(2));
  if (!tool) {
    process.stderr.write("tool name is required.\n");
    process.stderr.write(usage() + "\n");
    process.exit(2);
  }
  if (!TOOLS.has(tool)) {
    process.stderr.write(`Unknown tool: ${tool}\n`);
    process.exit(2);
  }
  if (!config.sessionId) {
    process.stderr.write("--session is required.\n");
    process.exit(2);
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.token) {
    headers["authorization"] = `Bearer ${config.token}`;
  }
  const url = `http://${config.host}:${config.port}/mcp`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId: config.sessionId, name: tool, arguments: args }),
  });
  const text = await res.text();
  if (!res.ok) {
    process.stderr.write(text + "\n");
    process.exit(1);
  }
  process.stdout.write(text + "\n");
}

void main().catch((error) => {
  process.stderr.write(String(error) + "\n");
  process.exit(1);
});
