import fs from "node:fs";
import { configFile, ensureDirs } from "./paths.js";
import type { Config } from "./types.js";

export const DEFAULT_CONFIG: Config = {
  tickIntervalMinutes: 10,
  claudePath: "claude",
  maxAttempts: 3,
  deliveryTimeoutMinutes: 60,
  notifications: true,
};

export function loadConfig(): Config {
  ensureDirs();
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), "utf8")) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    fs.writeFileSync(configFile(), JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
}
