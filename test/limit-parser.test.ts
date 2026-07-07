import { describe, expect, it } from "vitest";
import { parseLimitOutput } from "../src/limit-parser.js";

describe("parseLimitOutput", () => {
  it("распознаёт лимит с unix-ts в секундах", () => {
    const r = parseLimitOutput("Claude AI usage limit reached|1751900000");
    expect(r.limited).toBe(true);
    expect(r.resetAt?.getTime()).toBe(1751900000 * 1000);
  });

  it("распознаёт лимит с ts в миллисекундах", () => {
    const r = parseLimitOutput("usage limit reached|1751900000000");
    expect(r.resetAt?.getTime()).toBe(1751900000000);
  });

  it("лимит без ts — limited, resetAt отсутствует", () => {
    const r = parseLimitOutput('{"result":"Usage limit reached, try later"}');
    expect(r.limited).toBe(true);
    expect(r.resetAt).toBeUndefined();
  });

  it("обычный ответ — не лимит", () => {
    expect(parseLimitOutput('{"type":"result","result":"ok"}').limited).toBe(false);
  });

  it("пустой ввод не роняет", () => {
    expect(parseLimitOutput("").limited).toBe(false);
  });
});
