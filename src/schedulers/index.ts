import { fileURLToPath } from "node:url";
import * as win from "./windows.js";
import * as mac from "./macos.js";
import * as linux from "./linux.js";
import type { Config } from "../types.js";
import { resolveClaudePath } from "../claude-locate.js";
import { saveConfig } from "../config.js";

/** dist/schedulers/index.js -> dist/cli.js */
export function cliEntryPath(): string {
  return fileURLToPath(new URL("../cli.js", import.meta.url));
}

function impl() {
  if (process.platform === "win32") return win;
  if (process.platform === "darwin") return mac;
  return linux;
}

export function installScheduler(cfg: Config): void {
  // Планировщик запускает tick без пользовательского PATH — резолвим claude в
  // абсолютный путь сейчас (PATH ещё доступен) и персистим, чтобы tick его нашёл.
  const claudePath = resolveClaudePath(cfg.claudePath);
  if (claudePath !== cfg.claudePath) saveConfig({ ...cfg, claudePath });
  impl().install(cfg.tickIntervalMinutes, process.execPath, cliEntryPath());
}

export function uninstallScheduler(): void {
  impl().uninstall();
}

export function schedulerInstalled(): boolean {
  return impl().isInstalled();
}
