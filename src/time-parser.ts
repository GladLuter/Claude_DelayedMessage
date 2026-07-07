/** Разбор --at. Возвращает локальное Date строго в будущем. */
export function parseAt(input: string, now: Date = new Date()): Date {
  const s = input.trim().toLowerCase();

  const tomorrow = /^(?:завтра|tomorrow)\s+(.+)$/.exec(s);
  if (tomorrow) {
    const t = parseClock(tomorrow[1]);
    if (t) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(t.h, t.m, 0, 0);
      return d;
    }
  } else {
    const t = parseClock(s);
    if (t) {
      const d = new Date(now);
      d.setHours(t.h, t.m, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    }
    const iso = new Date(input);
    if (!Number.isNaN(iso.getTime())) {
      if (iso <= now) throw new Error(`Время уже в прошлом: "${input}"`);
      return iso;
    }
  }
  throw new Error(
    `Не понимаю время: "${input}". Примеры: "09:00", "завтра 9:00", "tomorrow 9am", "2026-07-08T09:00"`,
  );
}

function parseClock(s: string): { h: number; m: number } | undefined {
  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(s);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === "pm") h += 12;
    return { h, m: Number(ampm[2] ?? 0) };
  }
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hm) return { h: Number(hm[1]), m: Number(hm[2]) };
  return undefined;
}
