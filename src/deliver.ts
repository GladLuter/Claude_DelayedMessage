import path from "node:path";
import { runClaude } from "./claude-runner.js";
import { appendLog } from "./delivery-log.js";
import { parseLimitOutput } from "./limit-parser.js";
import { notify } from "./notify.js";
import { writeItem } from "./queue.js";
import type { Config, QueueItem } from "./types.js";

export type DeliverOutcome = "sent" | "limited" | "error";

// Только hex и дефисы: не содержит shell-метасимволов, безопасно для shell:true.
const SESSION_ID_RE = /^[0-9a-f][0-9a-f-]{6,34}[0-9a-f]$/i;

export async function deliverItem(item: QueueItem, cfg: Config): Promise<DeliverOutcome> {
  if (!SESSION_ID_RE.test(item.sessionId)) {
    item.status = "failed";
    item.result = `invalid sessionId: ${item.sessionId}`;
    writeItem(item);
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "failed", detail: item.result });
    return "error";
  }

  const res = await runClaude(["-p", "--resume", item.sessionId, "--output-format", "json"], {
    cwd: item.projectDir,
    input: item.message,
    timeoutMs: cfg.deliveryTimeoutMinutes * 60_000,
    claudePath: cfg.claudePath,
  });
  const out = `${res.stdout}\n${res.stderr}`;
  const project = path.basename(item.projectDir);

  // Успех определяем по коду возврата ПЕРЕД проверкой лимит-фразы: ответ
  // claude может процитировать "usage limit reached" (если сообщение было
  // о лимитах), а настоящая ошибка лимита всегда даёт ненулевой exitCode.
  if (res.exitCode === 0 && !res.timedOut) {
    item.status = "sent";
    item.result = res.stdout.slice(0, 2000);
    writeItem(item);
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "sent", project });
    notify(cfg, "DelayedMessage", `Сообщение доставлено: ${project}`);
    return "sent";
  }

  const limit = parseLimitOutput(out);
  if (limit.limited) {
    if (limit.resetAt) item.expectedResetAt = limit.resetAt.toISOString();
    writeItem(item); // attempts НЕ увеличиваем — лимит не ошибка
    appendLog({ ts: new Date().toISOString(), id: item.id, outcome: "limited" });
    return "limited";
  }

  item.attempts += 1;
  const detail = (res.timedOut ? "timeout; " : "") + out.slice(0, 2000);
  if (item.attempts >= cfg.maxAttempts) {
    item.status = "failed";
    item.result = detail;
    notify(cfg, "DelayedMessage", `Доставка провалена (${project}): ${item.id}`);
  }
  writeItem(item);
  appendLog({
    ts: new Date().toISOString(),
    id: item.id,
    outcome: item.status === "failed" ? "failed" : "retry",
    attempt: item.attempts,
    detail: detail.slice(0, 500),
  });
  return "error";
}
