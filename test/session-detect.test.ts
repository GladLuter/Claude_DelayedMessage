import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectSessionId, encodeProjectDir } from "../src/session-detect.js";

let home: string;
const saved = { sid: process.env.CLAUDE_SESSION_ID, home: process.env.CDM_CLAUDE_HOME };

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "cdm-home-"));
  process.env.CDM_CLAUDE_HOME = home;
  delete process.env.CLAUDE_SESSION_ID;
});

afterEach(() => {
  process.env.CLAUDE_SESSION_ID = saved.sid;
  process.env.CDM_CLAUDE_HOME = saved.home;
  if (!saved.sid) delete process.env.CLAUDE_SESSION_ID;
  if (!saved.home) delete process.env.CDM_CLAUDE_HOME;
});

describe("encodeProjectDir", () => {
  it("кодирует как Claude Code", () => {
    expect(encodeProjectDir("C:\\_git\\Claude_DelayedMessage")).toBe("C---git-Claude-DelayedMessage");
  });
});

describe("detectSessionId", () => {
  it("env CLAUDE_SESSION_ID приоритетнее", () => {
    process.env.CLAUDE_SESSION_ID = "env-session-id";
    expect(detectSessionId("C:\\_git\\X")).toBe("env-session-id");
  });

  it("fallback: самый свежий jsonl проекта", () => {
    const dir = path.join(home, "projects", "C---git-X");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "old-session.jsonl"), "{}");
    const past = Date.now() / 1000 - 3600;
    fs.utimesSync(path.join(dir, "old-session.jsonl"), past, past);
    fs.writeFileSync(path.join(dir, "new-session.jsonl"), "{}");
    expect(detectSessionId("C:\\_git\\X")).toBe("new-session");
  });

  it("нет каталога — undefined", () => {
    expect(detectSessionId("C:\\_git\\Nothing")).toBeUndefined();
  });
});
