import fs from "node:fs";
import { configFile, ensureDirs } from "./paths.js";
import type { Config } from "./types.js";

export const DEFAULT_CONFIG: Config = {
  tickIntervalMinutes: 10,
  claudePath: "claude",
  maxAttempts: 3,
  deliveryTimeoutMinutes: 60,
  notifications: true,
  lang: "en",
};

export function loadConfig(): Config {
  ensureDirs();
  let raw: string | undefined;
  try {
    raw = fs.readFileSync(configFile(), "utf8");
  } catch {
    raw = undefined; // первый запуск
  }
  if (raw !== undefined) {
    try {
      return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Config>) };
    } catch {
      // Битый конфиг — сохраняем улику, не теряем правки пользователя молча.
      fs.renameSync(configFile(), `${configFile()}.bad-${Date.now()}`);
    }
  }
  fs.writeFileSync(configFile(), JSON.stringify(DEFAULT_CONFIG, null, 2));
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg: Config): void {
  ensureDirs();
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
}
