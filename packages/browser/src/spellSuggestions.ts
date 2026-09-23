import { spawn } from "node:child_process";

/** Best-effort OS spell suggestions (aspell/hunspell) when Chromium does not expose a dictionary. */
export async function osSpellSuggestions(word: string): Promise<string[]> {
  const trimmed = word.trim();
  if (trimmed.length < 2) {
    return [];
  }
  const fromAspell = await runSpellChecker("aspell", trimmed);
  if (fromAspell.length > 0) {
    return fromAspell;
  }
  return await runSpellChecker("hunspell", trimmed);
}

function runSpellChecker(command: string, word: string): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn(command, ["-a"], { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", () => resolve([]));
    child.on("close", () => resolve(parseAspellOutput(stdout)));
    child.stdin.write(`^${word}\n`);
    child.stdin.end();
  });
}

function parseAspellOutput(stdout: string): string[] {
  const out: string[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("&")) {
      continue;
    }
    const colon = line.indexOf(":");
    if (colon < 0) {
      continue;
    }
    const tail = line.slice(colon + 1);
    for (const part of tail.split(",")) {
      const s = part.trim();
      if (s) {
        out.push(s);
      }
    }
  }
  return out.slice(0, 8);
}
