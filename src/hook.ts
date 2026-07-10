import path from "node:path";
import { addItem, getItem, listItems, writeItem } from "./queue.js";
import { parseAt } from "./time-parser.js";
import type { QueueItem } from "./types.js";

export interface HookPayload {
  command_name?: string;
  command_args?: string;
  session_id?: string;
  cwd?: string;
}

export interface HookResult {
  block: boolean;
  reason?: string;
}

const SESSION_ID_RE = /^[0-9a-f][0-9a-f-]{6,34}[0-9a-f]$/i;

function fmt(item: QueueItem): string {
  const when =
    item.trigger.type === "at"
      ? `в ${new Date(item.trigger.at!).toLocaleString()}`
      : `после сброса лимитов${item.expectedResetAt ? ` (ожидаем ~${new Date(item.expectedResetAt).toLocaleString()})` : ""}`;
  const preview = item.message.length > 60 ? `${item.message.slice(0, 60)}…` : item.message;
  return `[${item.id}] ${item.status} ${when} — "${preview}"`;
}

/**
 * Обрабатывает событие UserPromptExpansion. Возвращает block=false для чужих команд
 * (пусть разворачиваются как обычно). Для /delay выполняет операцию с очередью и
 * возвращает block=true с текстом-подтверждением (модель НЕ вызывается).
 */
export function handleHookPayload(payload: HookPayload): HookResult {
  if (payload.command_name !== "delay") return { block: false };
  const args = (payload.command_args ?? "").trim();
  const sessionId = payload.session_id ?? "";
  const projectDir = payload.cwd ?? process.cwd();

  // list
  if (args === "list") {
    const items = listItems();
    return { block: true, reason: items.length ? items.map(fmt).join("\n") : "DelayedMessage: очередь пуста." };
  }

  // cancel <id>
  const cancelM = /^cancel\s+(\S+)$/.exec(args);
  if (cancelM) {
    const item = getItem(cancelM[1]);
    if (!item) return { block: true, reason: `DelayedMessage: нет элемента ${cancelM[1]}.` };
    if (item.status !== "pending") return { block: true, reason: `DelayedMessage: [${item.id}] уже ${item.status}.` };
    item.status = "canceled";
    writeItem(item);
    return { block: true, reason: `DelayedMessage: отменено [${item.id}].` };
  }

  // edit <id> <новый текст>
  const editM = /^edit\s+(\S+)\s+([\s\S]+)$/.exec(args);
  if (editM) {
    const item = getItem(editM[1]);
    if (!item) return { block: true, reason: `DelayedMessage: нет элемента ${editM[1]}.` };
    if (item.status !== "pending") return { block: true, reason: `DelayedMessage: [${item.id}] уже ${item.status}.` };
    item.message = editM[2].trim();
    writeItem(item);
    return { block: true, reason: `DelayedMessage: обновлено ${fmt(item)}` };
  }

  // at "<время>" <текст>
  const atM = /^at\s+["']([^"']+)["']\s+([\s\S]+)$/.exec(args);
  let trigger: QueueItem["trigger"] = { type: "limits-reset" };
  let message = args;
  if (atM) {
    try {
      trigger = { type: "at", at: parseAt(atM[1]).toISOString() };
    } catch (e) {
      return { block: true, reason: `DelayedMessage: ${e instanceof Error ? e.message : String(e)}` };
    }
    message = atM[2].trim();
  }

  if (!message) return { block: true, reason: "DelayedMessage: пустое сообщение — нечего ставить в очередь." };
  if (!SESSION_ID_RE.test(sessionId)) {
    return { block: true, reason: "DelayedMessage: не удалось определить сессию (session_id отсутствует)." };
  }

  const item = addItem({ sessionId, projectDir, message, trigger });
  const cond = item.trigger.type === "at" ? `к ${new Date(item.trigger.at!).toLocaleString()}` : "после сброса лимитов";
  return {
    block: true,
    reason: `DelayedMessage: поставлено в очередь [${item.id}] ${cond} → ${path.basename(projectDir)}. Отменить: /delay cancel ${item.id} · Очередь: /delay list`,
  };
}
