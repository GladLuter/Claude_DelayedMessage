import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureDirs, quarantineDir, queueDir } from "./paths.js";
import type { QueueItem, Trigger } from "./types.js";

export function itemPath(id: string): string {
  return path.join(queueDir(), `${id}.json`);
}

export function writeItem(item: QueueItem): void {
  ensureDirs();
  fs.writeFileSync(itemPath(item.id), JSON.stringify(item, null, 2));
}

export function addItem(input: {
  sessionId: string;
  projectDir: string;
  message: string;
  trigger: Trigger;
}): QueueItem {
  const item: QueueItem = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    ...input,
  };
  writeItem(item);
  return item;
}

export function listItems(): QueueItem[] {
  ensureDirs();
  const items: QueueItem[] = [];
  for (const f of fs.readdirSync(queueDir()).filter((n) => n.endsWith(".json"))) {
    const full = path.join(queueDir(), f);
    try {
      const parsed = JSON.parse(fs.readFileSync(full, "utf8")) as QueueItem;
      if (typeof parsed.id !== "string" || typeof parsed.message !== "string" || !parsed.trigger) {
        throw new Error("schema mismatch");
      }
      items.push(parsed);
    } catch {
      fs.renameSync(full, path.join(quarantineDir(), `${Date.now()}-${f}`));
    }
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getItem(id: string): QueueItem | undefined {
  return listItems().find((i) => i.id === id);
}

export function pending(items?: QueueItem[]): QueueItem[] {
  return (items ?? listItems()).filter((i) => i.status === "pending");
}
