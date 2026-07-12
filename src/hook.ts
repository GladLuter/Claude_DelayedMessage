import path from "node:path";
import { messages } from "./i18n.js";
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

function fmt(item: QueueItem, m: ReturnType<typeof messages>): string {
  const when =
    item.trigger.type === "at"
      ? m.fmtAt(new Date(item.trigger.at!).toLocaleString())
      : m.fmtLimits + (item.expectedResetAt ? m.fmtExpect(new Date(item.expectedResetAt).toLocaleString()) : "");
  const preview = item.message.length > 60 ? `${item.message.slice(0, 60)}…` : item.message;
  return `[${item.id}] ${item.status} ${when} — "${preview}"`;
}

/**
 * Обрабатывает событие UserPromptExpansion. Возвращает block=false для чужих команд
 * (пусть разворачиваются как обычно). Для /delay выполняет операцию с очередью и
 * возвращает block=true с текстом-подтверждением (модель НЕ вызывается).
 */
export function handleHookPayload(payload: HookPayload, lang: string = "en"): HookResult {
  const m = messages(lang);
  if (payload.command_name !== "delay") return { block: false };
  const args = (payload.command_args ?? "").trim();
  const sessionId = payload.session_id ?? "";
  const projectDir = payload.cwd ?? process.cwd();

  // list
  if (args === "list") {
    const items = listItems();
    return { block: true, reason: items.length ? items.map((i) => fmt(i, m)).join("\n") : m.hkQueueEmpty };
  }

  // cancel <id>
  const cancelM = /^cancel\s+(\S+)$/.exec(args);
  if (cancelM) {
    const item = getItem(cancelM[1]);
    if (!item) return { block: true, reason: m.hkNoItem(cancelM[1]) };
    if (item.status !== "pending") return { block: true, reason: m.hkItemAlready(item.id, item.status) };
    item.status = "canceled";
    writeItem(item);
    return { block: true, reason: m.hkCanceled(item.id) };
  }

  // edit <id> <новый текст>
  const editM = /^edit\s+(\S+)\s+([\s\S]+)$/.exec(args);
  if (editM) {
    const item = getItem(editM[1]);
    if (!item) return { block: true, reason: m.hkNoItem(editM[1]) };
    if (item.status !== "pending") return { block: true, reason: m.hkItemAlready(item.id, item.status) };
    item.message = editM[2].trim();
    writeItem(item);
    return { block: true, reason: m.hkUpdated(fmt(item, m)) };
  }

  // at "<время>" <текст>
  const atM = /^at\s+["']([^"']+)["']\s+([\s\S]+)$/.exec(args);
  let trigger: QueueItem["trigger"] = { type: "limits-reset" };
  let message = args;
  if (atM) {
    try {
      trigger = { type: "at", at: parseAt(atM[1]).toISOString() };
    } catch (e) {
      return { block: true, reason: m.hkError(e instanceof Error ? e.message : String(e)) };
    }
    message = atM[2].trim();
  }

  if (!message) return { block: true, reason: m.hkEmptyMessage };
  if (!SESSION_ID_RE.test(sessionId)) {
    return { block: true, reason: m.hkNoSession };
  }

  const item = addItem({ sessionId, projectDir, message, trigger });
  const cond = item.trigger.type === "at" ? m.hkCondAt(new Date(item.trigger.at!).toLocaleString()) : m.hkCondReset;
  return {
    block: true,
    reason: m.hkQueued(item.id, cond, path.basename(projectDir)),
  };
}
