import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cliTokenInfo } from "../src/auth-check.js";

let home: string;
const saved = process.env.CDM_CLAUDE_HOME;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "cdm-auth-"));
  process.env.CDM_CLAUDE_HOME = home;
});

afterEach(() => {
  process.env.CDM_CLAUDE_HOME = saved;
  if (!saved) delete process.env.CDM_CLAUDE_HOME;
});

function writeCreds(expiresAt: unknown): void {
  fs.writeFileSync(path.join(home, ".credentials.json"), JSON.stringify({ claudeAiOauth: { expiresAt } }));
}

describe("cliTokenInfo", () => {
  it("свежий токен: expired=false", () => {
    writeCreds(Date.now() + 3_600_000);
    const t = cliTokenInfo();
    expect(t.expired).toBe(false);
    expect(t.expiresAt).toBeInstanceOf(Date);
  });

  it("истёкший токен: expired=true", () => {
    writeCreds(Date.now() - 3_600_000);
    expect(cliTokenInfo().expired).toBe(true);
  });

  it("нет файла — пустой результат", () => {
    expect(cliTokenInfo()).toEqual({});
  });

  it("expiresAt=0 (CLI не публикует срок) — пустой результат, не 'истёк 1970'", () => {
    writeCreds(0);
    expect(cliTokenInfo()).toEqual({});
  });

  it("битый JSON/нет поля — пустой результат", () => {
    fs.writeFileSync(path.join(home, ".credentials.json"), "{broken");
    expect(cliTokenInfo()).toEqual({});
    writeCreds("not-a-number");
    expect(cliTokenInfo()).toEqual({});
  });
});
