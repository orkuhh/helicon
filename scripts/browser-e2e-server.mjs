/**
 * Helicon server with fake Muse host for browser panel manual/E2E testing (no Muse binary required).
 */
import { mkdirSync } from "node:fs";
import { HeliconServer } from "../packages/server/dist/src/server.js";

class FakeConnection {
  replies = new Map();
  async command(method, params = {}) {
    const reply = this.replies.get(method);
    if (reply instanceof Error) throw reply;
    if (typeof reply === "function") return reply(params);
    return reply ?? { ok: true };
  }
  async request() {
    return { ok: true };
  }
  onNotification() {}
}

function fakeFactory(connection) {
  return () => ({
    start: async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { initializeResult: { serverInfo: { name: "muse", version: "1.1.1" } } };
    },
    connection,
    close: async () => ({ code: 0, signal: null }),
    onExit: () => {},
  });
}

const connection = new FakeConnection();
connection.replies.set("session/start", { session: { sessionId: "s1", modelId: "muse-spark-1.3" } });

const useFake = process.env["HELICON_BROWSER_FAKE"] === "1";
const port = Number(process.env["HELICON_PORT"] ?? 3127);
const dataDir = process.env["HELICON_DATA_DIR"] ?? "/tmp/helicon-browser-e2e";
mkdirSync(dataDir, { recursive: true });

const server = new HeliconServer({
  port,
  host: "127.0.0.1",
  dataDir,
  platform: "linux",
  musePath: "muse",
  browserUseFakeEngine: useFake,
  hostFactory: fakeFactory(connection),
  exec: async (command, args) => {
    if (command === "sh" && args[0] === "-lc" && String(args[1]).includes("command -v muse")) {
      return { stdout: "/usr/bin/muse\n", exitCode: 0 };
    }
    return { stdout: "", exitCode: 127 };
  },
  allowOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
});

const bound = await server.listen();
process.stdout.write(`browser-e2e-server http://${bound.host}:${bound.port} fakeBrowser=${useFake}\n`);

const shutdown = () => {
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
