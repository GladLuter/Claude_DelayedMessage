import { spawnSync } from "node:child_process";

export const TASK_NAME = "ClaudeDelayedMessage";

export function buildCreateArgs(intervalMinutes: number, nodePath: string, cliPath: string): string[] {
  // schtasks сам оборачивает /TR при передаче массивом; внутренние кавычки
  // нужны из-за пробелов в путях (Program Files).
  const tr = `"${nodePath}" "${cliPath}" run-once`;
  return ["/Create", "/F", "/TN", TASK_NAME, "/SC", "MINUTE", "/MO", String(intervalMinutes), "/TR", tr];
}

export function buildQueryArgs(): string[] {
  return ["/Query", "/TN", TASK_NAME];
}

export function buildDeleteArgs(): string[] {
  return ["/Delete", "/TN", TASK_NAME, "/F"];
}

export function install(intervalMinutes: number, nodePath: string, cliPath: string): void {
  const r = spawnSync("schtasks", buildCreateArgs(intervalMinutes, nodePath, cliPath), { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`schtasks /Create failed: ${r.stderr || r.stdout}`);
}

export function uninstall(): void {
  spawnSync("schtasks", buildDeleteArgs(), { encoding: "utf8" });
}

export function isInstalled(): boolean {
  return spawnSync("schtasks", buildQueryArgs(), { encoding: "utf8" }).status === 0;
}
