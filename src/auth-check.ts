import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CliTokenInfo {
  expiresAt?: Date;
  expired?: boolean;
}

/**
 * Срок access-токена standalone CLI (~/.claude/.credentials.json).
 * Headless `-p` не обновляет истёкший токен (десктоп — обновляет свой сам),
 * поэтому протухание = молчаливые 401 у зонда. Формат файла недокументирован —
 * любой сбой чтения даёт {} (status просто не покажет строку). Читаем ТОЛЬКО
 * expiresAt; сами креденшалы не читаются и не логируются.
 */
export function cliTokenInfo(): CliTokenInfo {
  try {
    const home = process.env.CDM_CLAUDE_HOME ?? path.join(os.homedir(), ".claude");
    const raw = JSON.parse(fs.readFileSync(path.join(home, ".credentials.json"), "utf8")) as {
      claudeAiOauth?: { expiresAt?: number };
    };
    const ms = raw.claudeAiOauth?.expiresAt;
    // 0 = CLI не публикует срок (наблюдалось с 2026-08) — это «неизвестно», не «истёк в 1970».
    if (typeof ms !== "number" || ms <= 0) return {};
    const expiresAt = new Date(ms);
    return { expiresAt, expired: expiresAt.getTime() < Date.now() };
  } catch {
    return {};
  }
}
