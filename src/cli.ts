#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { readLog } from "./delivery-log.js";
import { lastTickFile } from "./paths.js";
import { addItem, getItem, listItems, pending, writeItem } from "./queue.js";
import { cliEntryPath, installScheduler, schedulerInstalled, uninstallScheduler } from "./schedulers/index.js";
import { detectSessionId } from "./session-detect.js";
import { installSkill, uninstallSkill } from "./skill-install.js";
import { runOnce } from "./tick.js";
import { parseAt } from "./time-parser.js";
import type { QueueItem, Trigger } from "./types.js";

const program = new Command();
program.name("cdm").description("Delayed messages for Claude Code sessions");

function fail(msg: string): never {
  console.error(`Ошибка: ${msg}`);
  process.exit(1);
}

function readMessage(opts: { message?: string; messageFile?: string }): string {
  if (opts.message) return opts.message;
  if (opts.messageFile) return fs.readFileSync(opts.messageFile, "utf8").trim();
  // Без -m/--message-file читаем stdin; но на интерактивном TTY (нет пайпа)
  // readFileSync(0) завис бы навсегда — сразу подсказываем.
  if (process.stdin.isTTY) {
    fail("нет текста сообщения: укажите -m <текст> или --message-file <путь>");
  }
  try {
    const stdin = fs.readFileSync(0, "utf8").trim();
    if (stdin) return stdin;
  } catch {
    /* нет stdin */
  }
  fail("нет текста сообщения: укажите -m, --message-file или подайте текст через stdin");
}

function fmt(item: QueueItem): string {
  const when =
    item.trigger.type === "at"
      ? `в ${new Date(item.trigger.at!).toLocaleString()}`
      : `после сброса лимитов${item.expectedResetAt ? ` (ожидаем ~${new Date(item.expectedResetAt).toLocaleString()})` : ""}${item.fallbackFromAt ? " [fallback из at]" : ""}`;
  const preview = item.message.length > 60 ? `${item.message.slice(0, 60)}…` : item.message;
  return `[${item.id}] ${item.status.padEnd(8)} ${when}  ${path.basename(item.projectDir)}  "${preview}"`;
}

program
  .command("add")
  .description("Поставить сообщение в очередь")
  .option("-m, --message <text>", "текст сообщения")
  .option("-f, --message-file <path>", "файл с текстом сообщения")
  .option("--at <time>", 'время доставки: "09:00", "завтра 9:00", "tomorrow 9am", ISO')
  .option("--session <id>", "ID сессии или auto (auto = свежайшая сессия проекта; при нескольких активных сессиях укажите ID явно)", "auto")
  .option("--project <dir>", "папка проекта", process.cwd())
  .action((opts) => {
    const projectDir = path.resolve(opts.project);
    const sessionId = opts.session === "auto" ? detectSessionId(projectDir) : opts.session;
    if (!sessionId) fail(`не удалось определить сессию для ${projectDir}: укажите --session <id>`);
    let trigger: Trigger = { type: "limits-reset" };
    if (opts.at) {
      try {
        trigger = { type: "at", at: parseAt(opts.at).toISOString() };
      } catch (e) {
        fail(String(e instanceof Error ? e.message : e));
      }
    }
    const item = addItem({ sessionId, projectDir, message: readMessage(opts), trigger });
    console.log(`Добавлено: ${fmt(item)}`);
  });

program
  .command("list")
  .description("Показать очередь")
  .action(() => {
    const items = listItems();
    if (items.length === 0) {
      console.log("Очередь пуста.");
      return;
    }
    for (const i of items) console.log(fmt(i));
  });

program
  .command("edit <id>")
  .description("Изменить текст и/или время pending-сообщения")
  .option("-m, --message <text>", "новый текст")
  .option("-f, --message-file <path>", "файл с новым текстом")
  .option("--at <time>", "новое время (переключает триггер на at)")
  .option("--on-reset", "переключить триггер на «после сброса лимитов»")
  .action((id, opts) => {
    const item = getItem(id) ?? fail(`нет элемента ${id}`);
    if (item.status !== "pending") fail(`элемент ${id} уже ${item.status}`);
    if (opts.message || opts.messageFile) item.message = readMessage(opts);
    if (opts.at) {
      try {
        item.trigger = { type: "at", at: parseAt(opts.at).toISOString() };
        item.fallbackFromAt = undefined;
      } catch (e) {
        fail(String(e instanceof Error ? e.message : e));
      }
    }
    if (opts.onReset) item.trigger = { type: "limits-reset" };
    writeItem(item);
    console.log(`Обновлено: ${fmt(item)}`);
  });

program
  .command("cancel <id>")
  .description("Отменить pending-сообщение")
  .action((id) => {
    const item = getItem(id) ?? fail(`нет элемента ${id}`);
    if (item.status !== "pending") fail(`элемент ${id} уже ${item.status}`);
    item.status = "canceled";
    writeItem(item);
    console.log(`Отменено: [${item.id}]`);
  });

program
  .command("log")
  .description("История доставок")
  .action(() => {
    const lines = readLog(50);
    console.log(lines.length ? lines.join("\n") : "Журнал пуст.");
  });

program
  .command("run-once")
  .description("Один тик watcher-а (вызывается планировщиком)")
  .action(async () => {
    await runOnce(loadConfig());
  });

program
  .command("install")
  .description("Зарегистрировать планировщик ОС и установить слэш-скилл /delay")
  .option("--no-scheduler", "не регистрировать планировщик")
  .option("--no-skill", "не устанавливать слэш-скилл")
  .action((opts) => {
    const cfg = loadConfig();
    if (opts.scheduler) {
      installScheduler(cfg);
      console.log(`Планировщик зарегистрирован (тик каждые ${cfg.tickIntervalMinutes} мин).`);
    }
    if (opts.skill) {
      console.log(`Скилл установлен: ${installSkill()}`);
    }
  });

program
  .command("uninstall")
  .description("Снять планировщик и удалить слэш-скилл")
  .action(() => {
    uninstallScheduler();
    uninstallSkill();
    console.log("Планировщик снят, скилл удалён. Данные в ~/.claude-delayed-message сохранены.");
  });

program
  .command("status")
  .description("Диагностика")
  .action(() => {
    const items = listItems();
    const cfg = loadConfig();
    let lastTick = "никогда";
    try {
      lastTick = fs.readFileSync(lastTickFile(), "utf8").trim();
    } catch {
      /* ещё не было тика */
    }
    console.log(`Планировщик: ${schedulerInstalled() ? "зарегистрирован" : "НЕ зарегистрирован"}`);
    console.log(`CLI тика: ${cliEntryPath()}`);
    console.log(`claude: ${cfg.claudePath}`);
    console.log(`Последний тик: ${lastTick}`);
    console.log(`Очередь: ${pending(items).length} pending / ${items.length} всего`);
  });

program.parseAsync(process.argv).catch((e) => fail(String(e instanceof Error ? e.message : e)));
