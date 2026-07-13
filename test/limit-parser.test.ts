import { describe, expect, it } from "vitest";
import { parseLimitOutput } from "../src/limit-parser.js";

describe("parseLimitOutput", () => {
  it("реальный формат: is_error:true + api_error_status:429 + 'resets 5:20am' -> limited, resetAt — Date", () => {
    const r = parseLimitOutput(
      '{"is_error":true,"api_error_status":429,"result":"You\'ve hit your session limit · resets 5:20am (Europe/Kiev)"}',
    );
    expect(r.limited).toBe(true);
    expect(r.resetAt).toBeInstanceOf(Date);
  });

  it("401 (api_error_status:401) -> limited:false (это auth, не лимит)", () => {
    const r = parseLimitOutput(
      '{"is_error":true,"api_error_status":401,"result":"Failed to authenticate. API Error: 401 Invalid authentication credentials"}',
    );
    expect(r.limited).toBe(false);
  });

  it("успешный ответ (is_error:false), цитирующий фразу про лимит, не считается лимитом", () => {
    const r = parseLimitOutput('{"is_error":false,"result":"discussing usage limit reached error"}');
    expect(r.limited).toBe(false);
  });

  it("старый формат unix-ts (reached|<ts>) с is_error:true -> resetAt из ts", () => {
    const r = parseLimitOutput('{"is_error":true,"api_error_status":429,"result":"usage limit reached|1751900000"}');
    expect(r.limited).toBe(true);
    expect(r.resetAt?.getTime()).toBe(1751900000 * 1000);
  });

  it("пустая строка -> limited:false", () => {
    expect(parseLimitOutput("").limited).toBe(false);
  });

  it("429 в тексте успешного ответа (is_error:false) — НЕ лимит", () => {
    expect(
      parseLimitOutput('{"is_error":false,"api_error_status":429,"result":"объясняю ошибку api_error_status 429"}')
        .limited,
    ).toBe(false);
  });
});
