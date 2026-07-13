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

  it("лимит: реальный 429 JSON -> limited, attempts не растёт, статус вернулся в pending, expectedResetAt проставлен", async () => {
    cfg = {
      ...DEFAULT_CONFIG,
      claudePath: makeFakeClaude(dir, {
        stdout: '{"is_error":true,"api_error_status":429,"result":"You\'ve hit your session limit · resets 5:20am (Europe/Kiev)"}',
        exitCode: 1,
      }),
      notifications: false,
    };
    expect(await deliverItem(item, cfg)).toBe("limited");
    const after = getItem(item.id)!;
    expect(after.status).toBe("pending"); // не "delivering" — заявка снята
    expect(after.attempts).toBe(0);
    expect(after.expectedResetAt).toBeDefined();
    expect(after.claimedAt).toBeUndefined();
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

  it("таймаут: терминально failed без retry, attempts не растёт, claimedAt очищен", async () => {
    cfg = {
      ...DEFAULT_CONFIG,
      claudePath: makeFakeClaude(dir, { stdout: '{"result":"done"}', delayMs: 1500 }),
      notifications: false,
      deliveryTimeoutMinutes: 150 / 60_000, // ~150ms
    };
    expect(await deliverItem(item, cfg)).toBe("error");
    const after = getItem(item.id)!;
    expect(after.status).toBe("failed");
    expect(after.attempts).toBe(0); // таймаут — не retry-путь
    expect(after.claimedAt).toBeUndefined();
    expect(after.result).toContain("timed out");
  }, 15000);

  it("заявка перед запуском: статус синхронно становится delivering с claimedAt; успех очищает claimedAt", async () => {
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: '{"result":"done"}' }), notifications: false };
    const promise = deliverItem(item, cfg);
    // item.status = "delivering" выставляется синхронно ДО await runClaude —
    // проверяем это сразу после вызова, до того как промис разрешится.
    const mid = getItem(item.id)!;
    expect(mid.status).toBe("delivering");
    expect(mid.claimedAt).toBeDefined();
    await promise;
    const after = getItem(item.id)!;
    expect(after.status).toBe("sent");
    expect(after.claimedAt).toBeUndefined();
  });

  it("невалидный sessionId -> failed без запуска claude", async () => {
    const bad = addItem({ sessionId: "bad; rm -rf /", projectDir: dir, message: "x", trigger: { type: "limits-reset" } });
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: "should not run" }), notifications: false };
    expect(await deliverItem(bad, cfg)).toBe("error");
    expect(getItem(bad.id)?.status).toBe("failed");
    expect(fakeCalls(dir)).toHaveLength(0); // claude не должен запускаться при инъекции
  });

  it("успешный ответ, цитирующий фразу лимита, считается sent", async () => {
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: '{"result":"объясняю ошибку usage limit reached"}', exitCode: 0 }), notifications: false };
    expect(await deliverItem(item, cfg)).toBe("sent");
    expect(getItem(item.id)?.status).toBe("sent");
  });

  it("передаёт --permission-mode из permissionMode элемента", async () => {
    const it2 = addItem({ sessionId: "e8de3900-fcc5-4e11-af38-545ab0393d44", projectDir: dir, message: "x", trigger: { type: "limits-reset" }, permissionMode: "bypassPermissions" });
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: '{"result":"ok"}' }), notifications: false };
    await deliverItem(it2, cfg);
    expect(fakeCalls(dir)[0].join(" ")).toContain("--permission-mode bypassPermissions");
  });

  it("без permissionMode флаг не добавляется", async () => {
    cfg = { ...DEFAULT_CONFIG, claudePath: makeFakeClaude(dir, { stdout: '{"result":"ok"}' }), notifications: false };
    await deliverItem(item, cfg);
    expect(fakeCalls(dir)[0].join(" ")).not.toContain("--permission-mode");
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

  it("повторная ротация не застревает", async () => {
    tempDataDir();
    const { appendLog } = await import("../src/delivery-log.js");
    const file = path.join(logDir(), "deliveries.jsonl");
    fs.mkdirSync(logDir(), { recursive: true });
    fs.writeFileSync(file, "x".repeat(5 * 1024 * 1024 + 1));
    appendLog({ ts: "1" });
    fs.writeFileSync(file, "y".repeat(5 * 1024 * 1024 + 1));
    appendLog({ ts: "2" });
    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.statSync(file).size).toBeLessThan(1024);
  });
});
