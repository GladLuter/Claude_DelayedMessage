import { describe, expect, it } from "vitest";
import { messages, isLang, LANGS } from "../src/i18n.js";

describe("i18n", () => {
  it("английский по умолчанию", () => {
    expect(messages("en").queueEmpty).toBe("Queue is empty.");
  });
  it("русский каталог", () => {
    expect(messages("ru").queueEmpty).toBe("Очередь пуста.");
  });
  it("неизвестный/undefined язык → английский", () => {
    expect(messages("xx").queueEmpty).toBe("Queue is empty.");
    expect(messages(undefined).queueEmpty).toBe("Queue is empty.");
  });
  it("isLang / LANGS", () => {
    expect(isLang("ru")).toBe(true);
    expect(isLang("xx")).toBe(false);
    expect(LANGS).toEqual(["en", "ru"]);
  });

  it("ntTimedOut — функция, возвращает строку с id для en и ru", () => {
    expect(typeof messages("en").ntTimedOut).toBe("function");
    expect(messages("en").ntTimedOut("proj", "abc123")).toContain("abc123");
    expect(typeof messages("ru").ntTimedOut).toBe("function");
    expect(messages("ru").ntTimedOut("proj", "abc123")).toContain("abc123");
  });
});
