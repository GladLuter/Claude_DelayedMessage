import fs from "node:fs";
import path from "node:path";
import { ensureDirs, logDir } from "./paths.js";

const MAX_BYTES = 5 * 1024 * 1024;

function logFile(): string {
  return path.join(logDir(), "deliveries.jsonl");
}

export function appendLog(entry: Record<string, unknown>): void {
  ensureDirs();
  const file = logFile();
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) {
      fs.rmSync(`${file}.1`, { force: true });
      fs.renameSync(file, `${file}.1`);
    }
  } catch {
    /* ротация не критична */
  }
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

export function readLog(limit = 50): string[] {
  try {
    return fs.readFileSync(logFile(), "utf8").trim().split("\n").slice(-limit);
  } catch {
    return [];
  }
}
