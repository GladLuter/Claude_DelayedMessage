import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tempDataDir } from "./helpers.js";
import { runClaude } from "../src/claude-runner.js";

let dir: string;
beforeEach(() => {
  dir = tempDataDir();
});

/** Фейк, мгновенно выходящий с кодом 3, НЕ читая stdin (репро EPIPE). */
function makeFastExitFake(d: string): string {
  const js = path.join(d, "fast-exit.cjs");
  fs.writeFileSync(js, "process.exit(3);\n");
  if (process.platform === "win32") {
    const cmd = path.join(d, "fast-exit.cmd");
    fs.writeFileSync(cmd, `@echo off\r\nnode "%~dp0fast-exit.cjs" %*\r\n`);
    return cmd;
  }
  const sh = path.join(d, "fast-exit");
  fs.writeFileSync(sh, `#!/bin/sh\nexec node "$(dirname "$0")/fast-exit.cjs" "$@"\n`);
  fs.chmodSync(sh, 0o755);
  return sh;
}

/** Фейк, спящий 30с (репро зомби при таймауте). */
function makeSleepFake(d: string): string {
  const js = path.join(d, "sleeper.cjs");
  fs.writeFileSync(js, "try { require('node:fs').readFileSync(0); } catch {}\nsetTimeout(() => process.exit(0), 30000);\n");
  if (process.platform === "win32") {
    const cmd = path.join(d, "sleeper.cmd");
    fs.writeFileSync(cmd, `@echo off\r\nnode "%~dp0sleeper.cjs" %*\r\n`);
    return cmd;
  }
  const sh = path.join(d, "sleeper");
  fs.writeFileSync(sh, `#!/bin/sh\nexec node "$(dirname "$0")/sleeper.cjs" "$@"\n`);
  fs.chmodSync(sh, 0o755);
  return sh;
}

describe("runClaude", () => {
  it("не падает EPIPE, когда процесс умирает не читая stdin", async () => {
    const fake = makeFastExitFake(dir);
    const r = await runClaude(["-p"], { claudePath: fake, input: "x".repeat(1024 * 1024) });
    expect(r.exitCode).not.toBe(0);
    expect(r.timedOut).toBe(false);
  });

  it("таймаут: промис резолвится с timedOut, не дожидаясь ребёнка", async () => {
    const fake = makeSleepFake(dir);
    const start = Date.now();
    const r = await runClaude([], { claudePath: fake, input: "", timeoutMs: 1500 });
    expect(r.timedOut).toBe(true);
    expect(Date.now() - start).toBeLessThan(10_000);
  });
});
