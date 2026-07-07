import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tempDataDir } from "./helpers.js";
import { addItem, getItem, listItems, pending, writeItem } from "../src/queue.js";
import { loadConfig } from "../src/config.js";
import { acquireLock, releaseLock } from "../src/lock.js";
import { lockFile, quarantineDir, queueDir } from "../src/paths.js";

let dir: string;
beforeEach(() => {
  dir = tempDataDir();
});

describe("queue", () => {
  const input = {
    sessionId: "e8de3900-fcc5-4e11-af38-545ab0393d44",
    projectDir: "C:\\_git\\Demo",
    message: "продолжай",
    trigger: { type: "limits-reset" as const },
  };

  it("добавляет элемент со схемой спеки и находит его", () => {
    const item = addItem(input);
    expect(item.status).toBe("pending");
    expect(item.attempts).toBe(0);
    expect(item.id).toMatch(/^[0-9a-f]{8}$/);
    expect(getItem(item.id)?.message).toBe("продолжай");
  });

  it("сортирует FIFO по createdAt", () => {
    const a = addItem({ ...input, message: "first" });
    const b = { ...addItem({ ...input, message: "second" }), createdAt: "2000-01-01T00:00:00.000Z" };
    writeItem(b);
    expect(listItems().map((i) => i.message)).toEqual(["second", "first"]);
  });

  it("уводит повреждённый JSON в quarantine, не теряя остальные", () => {
    addItem(input);
    fs.writeFileSync(path.join(queueDir(), "bad.json"), "{not json");
    const items = listItems();
    expect(items).toHaveLength(1);
    expect(fs.readdirSync(quarantineDir())).toHaveLength(1);
    expect(fs.existsSync(path.join(queueDir(), "bad.json"))).toBe(false);
  });

  it("уводит валидный JSON без обязательных полей в quarantine", () => {
    addItem(input);
    fs.writeFileSync(path.join(queueDir(), "no-schema.json"), JSON.stringify({ foo: 1 }));
    const items = listItems();
    expect(items).toHaveLength(1);
    expect(fs.readdirSync(quarantineDir())).toHaveLength(1);
    expect(fs.existsSync(path.join(queueDir(), "no-schema.json"))).toBe(false);
  });

  it("pending() отфильтровывает canceled/sent", () => {
    const a = addItem(input);
    a.status = "canceled";
    writeItem(a);
    addItem({ ...input, message: "live" });
    expect(pending().map((i) => i.message)).toEqual(["live"]);
  });
});

describe("config", () => {
  it("создаёт дефолтный config.json и мерджит частичный", () => {
    const cfg = loadConfig();
    expect(cfg.tickIntervalMinutes).toBe(10);
    expect(cfg.maxAttempts).toBe(3);
    expect(cfg.deliveryTimeoutMinutes).toBe(60);
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ tickIntervalMinutes: 5 }));
    expect(loadConfig().tickIntervalMinutes).toBe(5);
    expect(loadConfig().claudePath).toBe("claude");
  });
});

describe("lock", () => {
  it("свежий lock блокирует, release освобождает", () => {
    expect(acquireLock(60_000)).toBe(true);
    expect(acquireLock(60_000)).toBe(false);
    releaseLock();
    expect(acquireLock(60_000)).toBe(true);
    releaseLock();
  });

  it("stale lock перехватывается", () => {
    expect(acquireLock(60_000)).toBe(true);
    const old = Date.now() / 1000 - 3600;
    fs.utimesSync(lockFile(), old, old);
    expect(acquireLock(60_000)).toBe(true);
    releaseLock();
  });
});
