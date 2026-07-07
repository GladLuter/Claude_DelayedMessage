import { spawnSync } from "node:child_process";

/** Абсолютный путь исполняемого в PATH текущей (интерактивной) оболочки, или undefined. */
export function which(cmd: string): string | undefined {
  const finder = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(finder, [cmd], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) return undefined;
  const first = r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || undefined;
}

/**
 * Планировщик/cron запускают tick без пользовательского PATH, поэтому bare "claude"
 * там не найдётся. На install (в интерактивной оболочке с PATH) резолвим абсолютный
 * путь. Кастомный путь (не дефолт) и неуспешный поиск возвращаются как есть.
 */
export function resolveClaudePath(current: string): string {
  if (current !== "claude") return current;
  return which("claude") ?? current;
}
