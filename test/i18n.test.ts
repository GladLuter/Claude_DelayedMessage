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
});
