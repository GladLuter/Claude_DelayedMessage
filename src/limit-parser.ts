export interface LimitInfo {
  limited: boolean;
  resetAt?: Date;
}

/**
 * Распознаёт ответ о лимите СТРУКТУРНО. Реальный формат: JSON с
 * "is_error":true и "api_error_status":429 (текст "hit your session limit ·
 * resets <time>"). Успешный ответ (is_error:false), даже если цитирует фразу
 * про лимит, лимитом НЕ считается. 401 — это auth, не лимит.
 */
export function parseLimitOutput(output: string): LimitInfo {
  const statusM = output.match(/"api_error_status"\s*:\s*(\d+)/);
  const status = statusM ? Number(statusM[1]) : undefined;
  if (status === 401) return { limited: false }; // auth, обрабатывается отдельно
  const isError = /"is_error"\s*:\s*true/.test(output);
  const phrase = /hit your (?:session|usage) limit|usage limit reached|limit reached|limit · resets/i.test(output);
  const limited = isError && (status === 429 || phrase);
  if (!limited) return { limited: false };
  return { limited: true, resetAt: parseResetAt(output) };
}

/** Best-effort: реальный "resets 5:20am (tz)" или старый "...|<unix-ts>". */
function parseResetAt(output: string): Date | undefined {
  const ts = output.match(/reached\|(\d{10,13})/i);
  if (ts) {
    const n = Number(ts[1]);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const hm = output.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (hm) {
    let h = Number(hm[1]) % 12;
    if (/pm/i.test(hm[3])) h += 12;
    const now = new Date();
    const d = new Date(now);
    d.setHours(h, Number(hm[2] ?? 0), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // следующее наступление
    return d;
  }
  return undefined;
}
