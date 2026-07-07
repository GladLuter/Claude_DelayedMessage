import { describe, expect, it } from "vitest";
import { parseAt } from "../src/time-parser.js";

const now = new Date(2026, 6, 7, 15, 0, 0); // 7 июля 2026, 15:00 локального

describe("parseAt", () => {
  it("HH:MM в будущем — сегодня", () => {
    const d = parseAt("16:30", now);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([7, 16, 30]);
  });

  it("HH:MM в прошлом — завтра", () => {
    const d = parseAt("09:00", now);
    expect([d.getDate(), d.getHours()]).toEqual([8, 9]);
  });

  it("завтра 9:00", () => {
    const d = parseAt("завтра 9:00", now);
    expect([d.getDate(), d.getHours()]).toEqual([8, 9]);
  });

  it("tomorrow 9am / 12:30pm", () => {
    expect(parseAt("tomorrow 9am", now).getHours()).toBe(9);
    const d = parseAt("tomorrow 12:30pm", now);
    expect([d.getHours(), d.getMinutes()]).toEqual([12, 30]);
  });

  it("ISO в будущем проходит, в прошлом — ошибка", () => {
    expect(parseAt("2026-07-08T09:00", now).getHours()).toBe(9);
    expect(() => parseAt("2020-01-01T00:00", now)).toThrow(/прошл/i);
  });

  it("мусор — понятная ошибка с примерами", () => {
    expect(() => parseAt("когда-нибудь", now)).toThrow(/Примеры/);
  });
});
