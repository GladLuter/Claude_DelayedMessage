import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Каталог ~/.claude (CDM_CLAUDE_HOME — для тестов). */
function claudeHome(): string {
  return process.env.CDM_CLAUDE_HOME ?? path.join(os.homedir(), ".claude");
}

/** Кодировка пути проекта как в Claude Code: всё, кроме [a-zA-Z0-9], -> "-". */
export function encodeProjectDir(projectDir: string): string {
  return projectDir.replace(/[^a-zA-Z0-9]/g, "-");
}

export function detectSessionId(projectDir: string): string | undefined {
  const fromEnv = process.env.CLAUDE_SESSION_ID;
  if (fromEnv) return fromEnv;
  const dir = path.join(claudeHome(), "projects", encodeProjectDir(projectDir));
  try {
    const newest = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m)[0];
    return newest ? path.basename(newest.f, ".jsonl") : undefined;
  } catch {
    return undefined;
  }
}
