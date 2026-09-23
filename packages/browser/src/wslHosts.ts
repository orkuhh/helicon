type ExecFn = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>;

/** Build host candidates for environment-port resolution (Windows + WSL union). */
export async function buildWslHostUnion(exec?: ExecFn): Promise<string[]> {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  if (process.platform !== "win32") {
    return [...hosts];
  }
  if (!exec) {
    return [...hosts];
  }
  try {
    const { stdout, code } = await exec("wsl.exe", ["hostname", "-I"]);
    if (code === 0) {
      for (const part of stdout.trim().split(/\s+/)) {
        if (part) {
          hosts.add(part);
        }
      }
    }
  } catch {
    /* WSL not available */
  }
  return [...hosts];
}
