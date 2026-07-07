import os from "node:os";
import { runClaude } from "./claude-runner.js";
import { parseLimitOutput } from "./limit-parser.js";
import type { Config } from "./types.js";

export type ProbeOutcome =
  | { kind: "available" }
  | { kind: "limited"; resetAt?: Date }
  | { kind: "error"; detail: string };

/** Минимальный запрос на haiku. Вызывать ТОЛЬКО при непустой очереди. */
export async function probeLimits(cfg: Config): Promise<ProbeOutcome> {
  const res = await runClaude(
    ["-p", "--model", "haiku", "--output-format", "json", "--no-session-persistence"],
    { input: "Reply with exactly: ok", cwd: os.tmpdir(), timeoutMs: 120_000, claudePath: cfg.claudePath },
  );
  const out = `${res.stdout}\n${res.stderr}`;
  const limit = parseLimitOutput(out);
  if (limit.limited) return { kind: "limited", resetAt: limit.resetAt };
  if (res.exitCode === 0 && !res.timedOut) return { kind: "available" };
  return { kind: "error", detail: out.slice(0, 500) };
}
