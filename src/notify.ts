import notifier from "node-notifier";
import type { Config } from "./types.js";

export function notify(cfg: Config, title: string, message: string): void {
  if (!cfg.notifications) return;
  try {
    notifier.notify({ title, message });
  } catch {
    /* уведомление — best effort */
  }
}
