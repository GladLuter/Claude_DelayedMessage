import fs from "node:fs";
import { acquireLock, releaseLock } from "./lock.js";
import { appendLog } from "./delivery-log.js";
import { messages } from "./i18n.js";
import { ensureDirs, lastProbeErrorFile, lastTickFile, probeStateFile } from "./paths.js";
import { deliverItem, type DeliverOutcome } from "./deliver.js";
import { notify } from "./notify.js";
import { probeLimits, type ProbeOutcome } from "./probe.js";
import { pending, writeItem } from "./queue.js";
import type { Config, QueueItem } from "./types.js";

export interface TickDeps {
  probe: (cfg: Config) => Promise<ProbeOutcome>;
  deliver: (item: QueueItem, cfg: Config) => Promise<DeliverOutcome>;
}

const REAL_DEPS: TickDeps = { probe: probeLimits, deliver: deliverItem };

interface ProbeErrorState {
  count: number;
}

function readProbeState(): ProbeErrorState {
  try {
    return JSON.parse(fs.readFileSync(probeStateFile(), "utf8")) as ProbeErrorState;
  } catch {
    return { count: 0 };
  }
}

/** Успешный зонд (available/limited) сбрасывает состояние ошибок. */
function clearProbeErrors(): void {
  try {
    fs.unlinkSync(probeStateFile());
  } catch {
    /* нет файла */
  }
  try {
    fs.unlinkSync(lastProbeErrorFile());
  } catch {
    /* нет файла */
  }
}

/**
 * 11 часов молчаливого отказа зонда — недопустимо. Пишем след (файл + журнал)
 * и уведомляем: auth-ошибка — сразу (пользователь должен перелогинить CLI),
 * прочие — с 3-го подряд тика; далее напоминание каждые 36 тиков (~6 ч).
 */
function recordProbeError(cfg: Config, probe: { detail: string; authError: boolean }): void {
  const m = messages(cfg.lang);
  const state = readProbeState();
  state.count += 1;
  fs.writeFileSync(probeStateFile(), JSON.stringify(state));
  fs.writeFileSync(
    lastProbeErrorFile(),
    `${new Date().toISOString()} ${probe.authError ? "[AUTH] " : ""}${probe.detail.slice(0, 500)}`,
  );
  appendLog({
    ts: new Date().toISOString(),
    outcome: "probe-error",
    auth: probe.authError,
    consecutive: state.count,
    detail: probe.detail.slice(0, 300),
  });
  const notifyNow = probe.authError
    ? state.count === 1 || state.count % 36 === 0
    : state.count === 3 || state.count % 36 === 0;
  if (notifyNow) {
    notify(cfg, "DelayedMessage", probe.authError ? m.ntAuth : m.ntProbeFail(state.count));
  }
}

export async function runOnce(cfg: Config, deps: TickDeps = REAL_DEPS): Promise<void> {
  ensureDirs();
  fs.writeFileSync(lastTickFile(), new Date().toISOString());
  if (!acquireLock(cfg.tickIntervalMinutes * 60_000 * 2)) return;
  try {
    const items = pending();
    if (items.length === 0) return; // зонд при пустой очереди запрещён (спека §5.3)

    const now = new Date();
    for (const item of items.filter((i) => i.trigger.type === "at" && new Date(i.trigger.at!) <= now)) {
      try {
        const outcome = await deps.deliver(item, cfg);
        if (outcome === "limited") {
          item.trigger = { type: "limits-reset" };
          item.fallbackFromAt = true;
          writeItem(item);
          notify(cfg, "DelayedMessage", messages(cfg.lang).ntFallback(item.id));
        }
      } catch (err) {
        // Сбой одного элемента не должен блокировать остальные; следующий тик повторит.
        notify(cfg, "DelayedMessage", `Ошибка доставки ${item.id}: ${String(err)}`);
      }
    }

    const waiting = pending().filter((i) => i.trigger.type === "limits-reset");
    if (waiting.length === 0) return;

    const probe = await deps.probe(cfg);
    if (probe.kind === "error") {
      recordProbeError(cfg, probe);
      return; // временный сбой — следующий тик повторит
    }
    clearProbeErrors(); // зонд ответил осмысленно
    if (probe.kind === "limited") {
      if (probe.resetAt) {
        for (const item of waiting) {
          item.expectedResetAt = probe.resetAt.toISOString();
          writeItem(item);
        }
      }
      return;
    }

    for (const item of waiting) {
      try {
        await deps.deliver(item, cfg);
      } catch (err) {
        // Изоляция сбоя элемента; остальные доставляются, следующий тик повторит.
        notify(cfg, "DelayedMessage", `Ошибка доставки ${item.id}: ${String(err)}`);
      }
    }
  } finally {
    releaseLock();
  }
}
