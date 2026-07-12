import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dataDir, ensureDirs } from "../paths.js";

export const TASK_NAME = "ClaudeDelayedMessage";

export function vbsLauncherPath(): string {
  return path.join(dataDir(), "run-hidden.vbs");
}

function wscriptPath(): string {
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "wscript.exe");
}

/**
 * Прямой запуск node из schtasks создаёт консольное окно и крадёт фокус
 * каждые tickInterval минут. wscript — GUI-хост: окна нет вообще; третий
 * аргумент Run(…, 0, False) прячет и дочернее окно node.
 */
export function buildVbsLauncher(nodePath: string, cliPath: string): string {
  return `' claude-delayed-message: тик без консольного окна и кражи фокуса.\r\nCreateObject("WScript.Shell").Run """${nodePath}"" ""${cliPath}"" run-once", 0, False\r\n`;
}

export function buildCreateArgs(intervalMinutes: number, wscript: string, vbsPath: string): string[] {
  const tr = `"${wscript}" //B "${vbsPath}"`;
  return ["/Create", "/F", "/TN", TASK_NAME, "/SC", "MINUTE", "/MO", String(intervalMinutes), "/TR", tr];
}

export function buildQueryArgs(): string[] {
  return ["/Query", "/TN", TASK_NAME];
}

export function buildDeleteArgs(): string[] {
  return ["/Delete", "/TN", TASK_NAME, "/F"];
}

export function install(intervalMinutes: number, nodePath: string, cliPath: string): void {
  ensureDirs();
  fs.writeFileSync(vbsLauncherPath(), buildVbsLauncher(nodePath, cliPath));
  const r = spawnSync("schtasks", buildCreateArgs(intervalMinutes, wscriptPath(), vbsLauncherPath()), {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`schtasks /Create failed: ${r.stderr || r.stdout}`);
}

export function uninstall(): void {
  spawnSync("schtasks", buildDeleteArgs(), { encoding: "utf8" });
  try {
    fs.unlinkSync(vbsLauncherPath());
  } catch {
    /* нет файла */
  }
}

export function isInstalled(): boolean {
  return spawnSync("schtasks", buildQueryArgs(), { encoding: "utf8" }).status === 0;
}
