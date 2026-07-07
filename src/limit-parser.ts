export interface LimitInfo {
  limited: boolean;
  resetAt?: Date;
}

/**
 * Формат ошибки лимита НЕ документирован (наблюдался как
 * "Claude AI usage limit reached|<unix-ts>"). Парсер обязан переживать
 * его изменение: тогда limited определяется по фразе, resetAt опускается.
 */
export function parseLimitOutput(output: string): LimitInfo {
  if (!/usage limit reached/i.test(output)) return { limited: false };
  const m = output.match(/limit reached\|(\d{10,13})/i);
  if (m) {
    const n = Number(m[1]);
    // n < 1e12: 10-значный unix-ts в секундах (1e12 мс ≈ 2001 год; секунды 10 знаками — до 2286-го)
    return { limited: true, resetAt: new Date(n < 1e12 ? n * 1000 : n) };
  }
  return { limited: true };
}
