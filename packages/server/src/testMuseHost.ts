import { randomUUID } from "node:crypto";
import type { HostFactory } from "./server.js";

class FakeConnection {
  replies = new Map<string, unknown | Error | ((params: Record<string, unknown>) => unknown)>();
  async command(method: string, params: Record<string, unknown> = {}) {
    const reply = this.replies.get(method);
    if (reply instanceof Error) {
      throw reply;
    }
    if (typeof reply === "function") {
      return reply(params);
    }
    return reply ?? { ok: true };
  }
  async request() {
    return { ok: true };
  }
  onNotification() {}
}

const connection = new FakeConnection();
connection.replies.set("session/start", () => ({
  session: { sessionId: `s_${randomUUID().slice(0, 8)}`, modelId: "muse-spark-1.3" },
}));

export const testMuseHostFactory: HostFactory = () => ({
  start: async () => {
    await new Promise((r) => setTimeout(r, 5));
    return { initializeResult: { serverInfo: { name: "muse", version: "1.1.1" } }, fingerprintWarning: null };
  },
  connection,
  close: async () => ({ code: 0, signal: null }),
  onExit: () => {},
});

export async function testMuseExec(command: string, args: string[]): Promise<{ stdout: string; exitCode: number }> {
  if (command === "sh" && args[0] === "-lc" && String(args[1]).includes("command -v muse")) {
    return { stdout: "/home/ubuntu/.local/bin/muse\n", exitCode: 0 };
  }
  return { stdout: "", exitCode: 127 };
}
