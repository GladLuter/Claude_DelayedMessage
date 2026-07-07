import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Изолирует данные теста; paths.ts читает CDM_DATA_DIR при каждом вызове. */
export function tempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cdm-test-"));
  process.env.CDM_DATA_DIR = dir;
  return dir;
}

export interface FakeScenario {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Фейковый исполняемый claude: пишет вызовы в calls.txt, stdin в stdin.txt,
 * отвечает по scenario.json. Возвращает путь для config.claudePath.
 */
export function makeFakeClaude(dir: string, scenario: FakeScenario): string {
  const js = path.join(dir, "fake-claude.cjs");
  fs.writeFileSync(
    js,
    `const fs = require("node:fs");
const path = require("node:path");
const s = JSON.parse(fs.readFileSync(path.join(__dirname, "scenario.json"), "utf8"));
fs.appendFileSync(path.join(__dirname, "calls.txt"), JSON.stringify(process.argv.slice(2)) + "\\n");
let input = "";
try { input = fs.readFileSync(0, "utf8"); } catch {}
fs.appendFileSync(path.join(__dirname, "stdin.txt"), input + "\\n---\\n");
if (s.stdout) process.stdout.write(s.stdout);
if (s.stderr) process.stderr.write(s.stderr);
process.exit(s.exitCode ?? 0);
`,
  );
  setFakeScenario(dir, scenario);
  if (process.platform === "win32") {
    const cmd = path.join(dir, "fake-claude.cmd");
    fs.writeFileSync(cmd, `@echo off\r\nnode "%~dp0fake-claude.cjs" %*\r\n`);
    return cmd;
  }
  const sh = path.join(dir, "fake-claude");
  fs.writeFileSync(sh, `#!/bin/sh\nexec node "$(dirname "$0")/fake-claude.cjs" "$@"\n`);
  fs.chmodSync(sh, 0o755);
  return sh;
}

export function setFakeScenario(dir: string, scenario: FakeScenario): void {
  fs.writeFileSync(path.join(dir, "scenario.json"), JSON.stringify({ exitCode: 0, ...scenario }));
}

export function fakeCalls(dir: string): string[][] {
  try {
    return fs
      .readFileSync(path.join(dir, "calls.txt"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export function fakeStdin(dir: string): string {
  try {
    return fs.readFileSync(path.join(dir, "stdin.txt"), "utf8");
  } catch {
    return "";
  }
}
