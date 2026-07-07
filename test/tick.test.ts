import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { tempDataDir } from "./helpers.js";
import { runOnce } from "../src/tick.js";
import { addItem, getItem, writeItem } from "../src/queue.js";
import { acquireLock, releaseLock } from "../src/lock.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { lastTickFile, lockFile } from "../src/paths.js";
import type { QueueItem } from "../src/types.js";

let dir: string;
const cfg = { ...DEFAULT_CONFIG, notifications: false };

function add(over: Partial<Parameters<typeof addItem>[0]> & { trigger?: QueueItem["trigger"] } = {}): QueueItem {
  return addItem({
    sessionId: "e8de3900-fcc5-4e11-af38-545ab0393d44",
    projectDir: dir,
    message: "m",
    trigger: { type: "limits-reset" },
    ...over,
  });
}

beforeEach(() => {
  dir = tempDataDir();
});

describe("runOnce", () => {
  it("пустая очередь: зонд не вызывается, last-tick пишется", async () => {
    const probe = vi.fn();
    const deliver = vi.fn();
    await runOnce(cfg, { probe, deliver });
    expect(probe).not.toHaveBeenCalled();
    expect(fs.existsSync(lastTickFile())).toBe(true);
  });

  it("due at-элемент доставляется без зонда", async () => {
    add({ trigger: { type: "at", at: new Date(Date.now() - 1000).toISOString() } });
    const probe = vi.fn();
    const deliver = vi.fn(async (i: QueueItem) => {
      i.status = "sent";
      writeItem(i);
      return "sent" as const;
    });
    await runOnce(cfg, { probe, deliver });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(probe).not.toHaveBeenCalled();
  });

  it("не-due at-элемент не трогается и зонд не нужен", async () => {
    add({ trigger: { type: "at", at: new Date(Date.now() + 3_600_000).toISOString() } });
    const probe = vi.fn();
    const deliver = vi.fn();
    await runOnce(cfg, { probe, deliver });
    expect(deliver).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
  });

  it("at-элемент при limited переходит в limits-reset с fallbackFromAt", async () => {
    const item = add({ trigger: { type: "at", at: new Date(Date.now() - 1000).toISOString() } });
    const probe = vi.fn(async () => ({ kind: "limited" as const }));
    const deliver = vi.fn(async () => "limited" as const);
    await runOnce(cfg, { probe, deliver });
    const after = getItem(item.id)!;
    expect(after.trigger.type).toBe("limits-reset");
    expect(after.fallbackFromAt).toBe(true);
  });

  it("probe limited: expectedResetAt проставлен, доставки нет", async () => {
    const item = add();
    const resetAt = new Date(Date.now() + 3_600_000);
    const probe = vi.fn(async () => ({ kind: "limited" as const, resetAt }));
    const deliver = vi.fn();
    await runOnce(cfg, { probe, deliver });
    expect(deliver).not.toHaveBeenCalled();
    expect(getItem(item.id)?.expectedResetAt).toBe(resetAt.toISOString());
  });

  it("probe available: доставка FIFO", async () => {
    const a = add({ message: "first" });
    const b = add({ message: "second" });
    const probe = vi.fn(async () => ({ kind: "available" as const }));
    const order: string[] = [];
    const deliver = vi.fn(async (i: QueueItem) => {
      order.push(i.message);
      i.status = "sent";
      writeItem(i);
      return "sent" as const;
    });
    await runOnce(cfg, { probe, deliver });
    expect(order).toEqual(["first", "second"]);
    expect([a.id, b.id].map((id) => getItem(id)?.status)).toEqual(["sent", "sent"]);
  });

  it("захваченный lock: выход без работы", async () => {
    add();
    expect(acquireLock(600_000)).toBe(true);
    const probe = vi.fn();
    const deliver = vi.fn();
    await runOnce(cfg, { probe, deliver });
    expect(probe).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    expect(fs.existsSync(lockFile())).toBe(true); // чужой lock не снят
    releaseLock();
  });
});
