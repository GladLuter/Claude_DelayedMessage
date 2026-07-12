import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installHook, uninstallHook } from "../src/settings-hook.js";

let home: string;
const saved = process.env.CDM_CLAUDE_HOME;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "cdm-settings-hook-"));
  process.env.CDM_CLAUDE_HOME = home;
});

afterEach(() => {
  process.env.CDM_CLAUDE_HOME = saved;
  if (!saved) delete process.env.CDM_CLAUDE_HOME;
});

function settingsFile(): string {
  return path.join(home, "settings.json");
}

function readSettings(): any {
  return JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
}

const nodePath = "C:\\node.exe";
const cliPath = "C:\\_git\\Claude_DelayedMessage\\dist\\cli.js";

describe("installHook", () => {
  it("записывает settings.json с hooks.UserPromptExpansion", () => {
    installHook(nodePath, cliPath);
    const settings = readSettings();
    const groups = settings.hooks.UserPromptExpansion;
    expect(groups).toHaveLength(1);
    const command = groups[0].hooks[0].command;
    expect(command).toContain("cli.js");
    expect(command.trim().endsWith("hook")).toBe(true);
  });

  it("идемпотентен: повторный install даёт одну запись", () => {
    installHook(nodePath, cliPath);
    installHook(nodePath, cliPath);
    const settings = readSettings();
    expect(settings.hooks.UserPromptExpansion).toHaveLength(1);
  });

  it("сохраняет посторонние настройки", () => {
    fs.writeFileSync(settingsFile(), JSON.stringify({ theme: "x" }));
    installHook(nodePath, cliPath);
    const settings = readSettings();
    expect(settings.theme).toBe("x");
    expect(settings.hooks.UserPromptExpansion).toHaveLength(1);
  });

  it("битый settings.json не перезаписывается — install бросает ошибку", () => {
    fs.writeFileSync(settingsFile(), "{broken json");
    expect(() => installHook(nodePath, cliPath)).toThrow(/corrupt/);
    expect(fs.readFileSync(settingsFile(), "utf8")).toBe("{broken json");
  });
});

describe("uninstallHook", () => {
  it("удаляет нашу запись и ключ UserPromptExpansion, сохраняя прочее", () => {
    fs.writeFileSync(settingsFile(), JSON.stringify({ theme: "x" }));
    installHook(nodePath, cliPath);
    uninstallHook(cliPath);
    const settings = readSettings();
    expect(settings.theme).toBe("x");
    expect(settings.hooks?.UserPromptExpansion).toBeUndefined();
  });

  it("не падает, если settings.json нет хуков вовсе", () => {
    fs.writeFileSync(settingsFile(), JSON.stringify({ theme: "x" }));
    expect(() => uninstallHook(cliPath)).not.toThrow();
  });
});
