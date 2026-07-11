import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function dataDir(): string {
  return process.env.CDM_DATA_DIR ?? path.join(os.homedir(), ".claude-delayed-message");
}
export function queueDir(): string {
  return path.join(dataDir(), "queue");
}
export function quarantineDir(): string {
  return path.join(dataDir(), "quarantine");
}
export function logDir(): string {
  return path.join(dataDir(), "log");
}
export function lockFile(): string {
  return path.join(dataDir(), "tick.lock");
}
export function configFile(): string {
  return path.join(dataDir(), "config.json");
}
export function lastTickFile(): string {
  return path.join(dataDir(), "last-tick.txt");
}
export function lastProbeErrorFile(): string {
  return path.join(dataDir(), "last-probe-error.txt");
}
export function probeStateFile(): string {
  return path.join(dataDir(), "probe-state.json");
}

export function ensureDirs(): void {
  for (const d of [dataDir(), queueDir(), quarantineDir(), logDir()]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
