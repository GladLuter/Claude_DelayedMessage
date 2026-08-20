import path from "node:path";
import { runClaude } from "./claude-runner.js";
import { appendLog } from "./delivery-log.js";
import { messages } from "./i18n.js";
import { parseLimitOutput } from "./limit-parser.js";
import { notify } from "./notify.js";
import { isPermissionMode } from "./permission.js";
import { writeItem } from "./queue.js";
import type { Config, QueueItem } from "./types.js";

export type DeliverOutcome = "sent" | "limited" | "error";

// Только hex и дефисы: не содержит shell-метасимволов, безопасно для shell:true.
const SESSION_ID_RE = /^[0-9a-f][0-9a-f-]{6,34}[0-9a-f]$/i;

/** Число из JSON-вывода claude (0, если поля нет). */
function num(out: string, key: string): number {
  return Number(out.match(new RegExp(`"${key}"\\s*:\\s*([\\d.]+)`))?.[1] ?? 0);
}

/**
 * Отличает 429 «отклонён на входе» (num_turns=1, cost=0 — работа не начиналась)
 * от 429 «прерван в середине прогона» (были ходы/траты — сообщение уже в сессии).
 */
function workStarted(out: string): boolean {
  return num(out, "total_cost_usd") > 0 || num(out, "num_turns") > 1;
}

export async function deliverItem(item: QueueItem, cfg: Config): Promise<DeliverOutcome> {
  const m = messages(cfg.lang);
  if (!SESSION_ID_RE.test(item.sessionId)) {
    item.status = "failed";
    item.result = `invalid sessionId: ${item.sessionId}`;
    writeItem(item);
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "failed", detail: item.result });
    return "error";
  }

  // Заявка ДО запуска: помечаем "delivering", чтобы параллельный тик (устаревший
  // lock) не перезапустил ту же — возможно многочасовую — доставку.
  item.status = "delivering";
  item.claimedAt = new Date().toISOString();
  writeItem(item);

  const mode = item.permissionMode ?? cfg.deliveryPermissionMode;
  const permArgs = mode && isPermissionMode(mode) && mode !== "default" ? ["--permission-mode", mode] : [];

  const res = await runClaude(["-p", "--resume", item.sessionId, "--output-format", "json", ...permArgs], {
    cwd: item.projectDir,
    input: item.message,
    timeoutMs: cfg.deliveryTimeoutMinutes * 60_000,
    claudePath: cfg.claudePath,
  });
  const out = `${res.stdout}\n${res.stderr}`;
  const project = path.basename(item.projectDir);

  // Лимит определяем СТРУКТУРНО (api_error_status/is_error), поэтому проверяем
  // раньше success: настоящий 429 не спутать с успешным ответом.
  const limit = parseLimitOutput(out);
  if (limit.limited) {
    if (limit.resetAt) item.expectedResetAt = limit.resetAt.toISOString();
    item.claimedAt = undefined;
    if (workStarted(out)) {
      // Лимит выбил прогон В СЕРЕДИНЕ: ход уже в сессии и часть работы сделана.
      // Повтор запустил бы её заново и сжёг следующее окно целиком.
      item.status = "sent";
      item.result = `interrupted by usage limit after partial work: ${out.slice(0, 500)}`;
      writeItem(item);
      appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "sent-partial", project });
      notify(cfg, "DelayedMessage", m.ntPartial(project, item.id));
      return "limited"; // батчу всё равно стоп — лимиты кончились
    }
    item.status = "pending"; // отклонён на входе, работа не начиналась — честный повтор
    writeItem(item); // attempts НЕ увеличиваем — лимит не ошибка
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "limited" });
    return "limited";
  }

  if (res.exitCode === 0 && !res.timedOut) {
    item.status = "sent";
    item.result = res.stdout.slice(0, 2000);
    item.claimedAt = undefined;
    writeItem(item);
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "sent", project });
    notify(cfg, "DelayedMessage", m.ntDelivered(project));
    return "sent";
  }

  if (res.timedOut) {
    // Сообщение уже впрыснуто в сессию и прогон шёл — повтор ДУБЛИРОВАЛ бы работу
    // и жёг лимиты. Терминально, БЕЗ retry.
    item.status = "failed";
    item.result = `timed out after ${cfg.deliveryTimeoutMinutes} min (delivered; completion unconfirmed)`;
    item.claimedAt = undefined;
    writeItem(item);
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "timeout", detail: item.result });
    notify(cfg, "DelayedMessage", m.ntTimedOut(project, item.id));
    return "error";
  }

  // Прочая ошибка — retry с ограничением maxAttempts.
  item.attempts += 1;
  item.status = item.attempts >= cfg.maxAttempts ? "failed" : "pending";
  item.claimedAt = undefined;
  item.result = out.slice(0, 2000);
  writeItem(item);
  appendLog({
    ts: new Date().toISOString(),
    id: item.id,
    outcome: item.status === "failed" ? "failed" : "retry",
    attempt: item.attempts,
    detail: out.slice(0, 500),
  });
  if (item.status === "failed") notify(cfg, "DelayedMessage", m.ntFailed(project, item.id));
  return "error";
}
