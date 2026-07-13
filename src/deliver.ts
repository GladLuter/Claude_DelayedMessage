import path from "node:path";
import { runClaude } from "./claude-runner.js";
import { appendLog } from "./delivery-log.js";
import { messages } from "./i18n.js";
import { parseLimitOutput } from "./limit-parser.js";
import { notify } from "./notify.js";
import { writeItem } from "./queue.js";
import type { Config, QueueItem } from "./types.js";

export type DeliverOutcome = "sent" | "limited" | "error";

// Только hex и дефисы: не содержит shell-метасимволов, безопасно для shell:true.
const SESSION_ID_RE = /^[0-9a-f][0-9a-f-]{6,34}[0-9a-f]$/i;

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

  const res = await runClaude(["-p", "--resume", item.sessionId, "--output-format", "json"], {
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
    item.status = "pending"; // вернуть в очередь до следующего сброса
    item.claimedAt = undefined;
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
