import { describe, expect, it } from "vitest";
import { resolveClaudePath, which } from "../src/claude-locate.js";

describe("which", () => {
  it("находит node (есть в PATH при разработке)", () => {
    const p = which("node");
    expect(p).toBeTruthy();
    expect(p!.toLowerCase()).toContain("node");
  });

  it("несуществующая команда → undefined", () => {
    expect(which("no_such_cmd_xyz_9999")).toBeUndefined();
  });
});

describe("resolveClaudePath", () => {
  it("кастомный путь возвращается без изменений (без запуска which)", () => {
    expect(resolveClaudePath("C:/custom/claude.exe")).toBe("C:/custom/claude.exe");
  });

  it("дефолтный 'claude' не роняет функцию (резолвит или откатывается к 'claude')", () => {
    expect(typeof resolveClaudePath("claude")).toBe("string");
  });
});
