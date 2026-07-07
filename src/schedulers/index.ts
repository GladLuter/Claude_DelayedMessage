import { fileURLToPath } from "node:url";
import * as win from "./windows.js";
import * as mac from "./macos.js";
import * as linux from "./linux.js";
import type { Config } from "../types.js";

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
  impl().install(cfg.tickIntervalMinutes, process.execPath, cliEntryPath());
}

export function uninstallScheduler(): void {
  impl().uninstall();
}

export function schedulerInstalled(): boolean {
  return impl().isInstalled();
}
