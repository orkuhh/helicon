#!/usr/bin/env node
import { PREVIEW_TOOL_NAMES } from "./mcpPreview.js";
import { parseBrowserCliArgv } from "./browserCliParse.js";

const TOOLS = new Set<string>(PREVIEW_TOOL_NAMES);

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

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(usage() + "\n");
    process.exit(0);
  }
  const { config, tool, args } = parseBrowserCliArgv(process.argv.slice(2));
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
