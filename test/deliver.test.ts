import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fakeCalls, fakeStdin, makeFakeClaude, setFakeScenario, tempDataDir } from "./helpers.js";
import { deliverItem } from "../src/deliver.js";
import { addItem, getItem } from "../src/queue.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { logDir } from "../src/paths.js";
import type { Config, QueueItem } from "../src/types.js";

let dir: string;
let cfg: Config;
let item: QueueItem;

beforeEach(() => {
  dir = tempDataDir();
  item = addItem({
    sessionId: "e8de3900-fcc5-4e11-af38-545ab0393d44",
    projectDir: dir,
    message: "продолжай работу",
    trigger: { type: "limits-reset" },
  });
});

describe("deliverItem", () => {
  it("успех: sent + журнал + resume-аргументы + stdin", async () => {
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: '{"result":"done"}' }), notifications: false };
    expect(await deliverItem(item, cfg)).toBe("sent");
    expect(getItem(item.id)?.status).toBe("sent");
    expect(fakeCalls(dir)[0].join(" ")).toContain(`--resume ${item.sessionId}`);
    expect(fakeStdin(dir)).toContain("продолжай работу");
    const log = fs.readFileSync(path.join(logDir(), "deliveries.jsonl"), "utf8");
    expect(log).toContain(item.id);
  });

  it("лимит: limited, attempts не растёт, expectedResetAt обновлён", async () => {
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: "Claude AI usage limit reached|1751900000", exitCode: 1 }), notifications: false };
    expect(await deliverItem(item, cfg)).toBe("limited");
    const after = getItem(item.id)!;
    expect(after.status).toBe("pending");
    expect(after.attempts).toBe(0);
    expect(after.expectedResetAt).toBe(new Date(1751900000000).toISOString());
  });

  it("прочая ошибка трижды -> failed", async () => {
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stderr: "boom", exitCode: 2 }), notifications: false, maxAttempts: 3 };
    expect(await deliverItem(item, cfg)).toBe("error");
    expect(await deliverItem(getItem(item.id)!, cfg)).toBe("error");
    expect(await deliverItem(getItem(item.id)!, cfg)).toBe("error");
    const after = getItem(item.id)!;
    expect(after.status).toBe("failed");
    expect(after.attempts).toBe(3);
  });

  it("невалидный sessionId -> failed без запуска claude", async () => {
    const bad = addItem({ sessionId: "bad; rm -rf /", projectDir: dir, message: "x", trigger: { type: "limits-reset" } });
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: "should not run" }), notifications: false };
    expect(await deliverItem(bad, cfg)).toBe("error");
    expect(getItem(bad.id)?.status).toBe("failed");
  });
});

describe("delivery-log rotation", () => {
  it("ротирует файл больше 5МБ", async () => {
    tempDataDir();
    const { appendLog } = await import("../src/delivery-log.js");
    const file = path.join(logDir(), "deliveries.jsonl");
    fs.mkdirSync(logDir(), { recursive: true });
    fs.writeFileSync(file, "x".repeat(5 * 1024 * 1024 + 1));
    appendLog({ ts: "now" });
    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.statSync(file).size).toBeLessThan(1024);
  });
});
