import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CRON_MARKER = "# claude-delayed-message";
const UNIT = "claude-delayed-message";

function unitDir(): string {
  return path.join(os.homedir(), ".config", "systemd", "user");
}

export function buildServiceUnit(nodePath: string, cliPath: string): string {
  return `[Unit]
Description=claude-delayed-message tick

[Service]
Type=oneshot
ExecStart=${nodePath} ${cliPath} run-once
`;
}

export function buildTimerUnit(intervalMinutes: number): string {
  return `[Unit]
Description=claude-delayed-message periodic tick

[Timer]
OnBootSec=1min
OnUnitActiveSec=${intervalMinutes}min

[Install]
WantedBy=timers.target
`;
}

export function buildCronLine(intervalMinutes: number, nodePath: string, cliPath: string): string {
  return `*/${intervalMinutes} * * * * "${nodePath}" "${cliPath}" run-once ${CRON_MARKER}`;
}

function hasSystemd(): boolean {
  return spawnSync("systemctl", ["--user", "--version"], { encoding: "utf8" }).status === 0;
}

export function install(intervalMinutes: number, nodePath: string, cliPath: string): void {
  if (hasSystemd()) {
    fs.mkdirSync(unitDir(), { recursive: true });
    fs.writeFileSync(path.join(unitDir(), `${UNIT}.service`), buildServiceUnit(nodePath, cliPath));
    fs.writeFileSync(path.join(unitDir(), `${UNIT}.timer`), buildTimerUnit(intervalMinutes));
    spawnSync("systemctl", ["--user", "daemon-reload"], { encoding: "utf8" });
    const r = spawnSync("systemctl", ["--user", "enable", "--now", `${UNIT}.timer`], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`systemctl enable failed: ${r.stderr || r.stdout}`);
    return;
  }
  const current = spawnSync("crontab", ["-l"], { encoding: "utf8" }).stdout || "";
  const kept = current.split("\n").filter((l) => l.trim() && !l.includes(CRON_MARKER));
  kept.push(buildCronLine(intervalMinutes, nodePath, cliPath));
  const r = spawnSync("crontab", ["-"], { input: `${kept.join("\n")}\n`, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`crontab update failed: ${r.stderr}`);
}

export function uninstall(): void {
  if (hasSystemd()) {
    spawnSync("systemctl", ["--user", "disable", "--now", `${UNIT}.timer`], { encoding: "utf8" });
    for (const f of [`${UNIT}.service`, `${UNIT}.timer`]) {
      try {
        fs.unlinkSync(path.join(unitDir(), f));
      } catch {
        /* нет файла */
      }
    }
    spawnSync("systemctl", ["--user", "daemon-reload"], { encoding: "utf8" });
    return;
  }
  const current = spawnSync("crontab", ["-l"], { encoding: "utf8" }).stdout || "";
  const kept = current.split("\n").filter((l) => l.trim() && !l.includes(CRON_MARKER));
  spawnSync("crontab", ["-"], { input: kept.length ? `${kept.join("\n")}\n` : "", encoding: "utf8" });
}

export function isInstalled(): boolean {
  if (hasSystemd()) {
    return spawnSync("systemctl", ["--user", "is-enabled", `${UNIT}.timer`], { encoding: "utf8" }).status === 0;
  }
  return (spawnSync("crontab", ["-l"], { encoding: "utf8" }).stdout || "").includes(CRON_MARKER);
}
