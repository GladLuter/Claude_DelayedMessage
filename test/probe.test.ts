import { beforeEach, describe, expect, it } from "vitest";
import { fakeCalls, fakeStdin, makeFakeClaude, tempDataDir } from "./helpers.js";
import { probeLimits } from "../src/probe.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { Config } from "../src/types.js";

let dir: string;
beforeEach(() => {
  dir = tempDataDir();
});

function cfgWith(claudePath: string): Config {
  return { ...DEFAULT_CONFIG, claudePath, notifications: false };
}

describe("probeLimits", () => {
  it("limited: реальный 429 JSON", async () => {
    const fake = makeFakeClaude(dir, {
      stdout: '{"is_error":true,"api_error_status":429,"result":"You\'ve hit your session limit · resets 5:20am (Europe/Kiev)"}',
      exitCode: 1,
    });
    const r = await probeLimits(cfgWith(fake));
    expect(r.kind).toBe("limited");
  });

  it("available: успешный ответ, зонд шёл с haiku и без персистентности", async () => {
    const fake = makeFakeClaude(dir, { stdout: '{"type":"result","result":"ok"}', exitCode: 0 });
    const r = await probeLimits(cfgWith(fake));
    expect(r.kind).toBe("available");
    const call = fakeCalls(dir)[0].join(" ");
    expect(call).toContain("--model haiku");
    expect(call).toContain("--no-session-persistence");
    expect(fakeStdin(dir)).toContain("ok");
  });

  it("error: crash подпроцесса", async () => {
    const fake = makeFakeClaude(dir, { stderr: "boom", exitCode: 2 });
    const r = await probeLimits(cfgWith(fake));
    expect(r.kind).toBe("error");
  });

  it("401 классифицируется как auth-ошибка", async () => {
    const fake = makeFakeClaude(dir, {
      stdout: '{"is_error":true,"api_error_status":401,"result":"Failed to authenticate. API Error: 401 Invalid authentication credentials"}',
      exitCode: 1,
    });
    const r = await probeLimits(cfgWith(fake));
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.authError).toBe(true);
  });

  it("прочая ошибка — authError false", async () => {
    const fake = makeFakeClaude(dir, { stderr: "boom", exitCode: 2 });
    const r = await probeLimits(cfgWith(fake));
    if (r.kind === "error") expect(r.authError).toBe(false);
  });
});
