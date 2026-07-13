#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { cliTokenInfo } from "./auth-check.js";
import { loadConfig, saveConfig } from "./config.js";
import { readLog } from "./delivery-log.js";
import { handleHookPayload } from "./hook.js";
import { isLang, LANGS, messages } from "./i18n.js";
import { lastProbeErrorFile, lastTickFile } from "./paths.js";
import { isPermissionMode, type PermissionMode } from "./permission.js";
import { addItem, getItem, listItems, pending, writeItem } from "./queue.js";
import { cliEntryPath, installScheduler, schedulerInstalled, uninstallScheduler } from "./schedulers/index.js";
import { detectSessionId } from "./session-detect.js";
import { installHook, uninstallHook } from "./settings-hook.js";
import { installSkill, uninstallSkill } from "./skill-install.js";
import { runOnce } from "./tick.js";
import { parseAt } from "./time-parser.js";
import type { QueueItem, Trigger } from "./types.js";

const program = new Command();
program.name("cdm").description("Delayed messages for Claude Code sessions");

const m = messages(loadConfig().lang);

function fail(msg: string): never {
  console.error(`${m.errorPrefix}${msg}`);
  process.exit(1);
}

function readMessage(opts: { message?: string; messageFile?: string }): string {
  if (opts.message) return opts.message;
  if (opts.messageFile) return fs.readFileSync(opts.messageFile, "utf8").trim();
  // Без -m/--message-file читаем stdin; но на интерактивном TTY (нет пайпа)
  // readFileSync(0) завис бы навсегда — сразу подсказываем.
  if (process.stdin.isTTY) {
    fail(m.noMessageText);
  }
  try {
    const stdin = fs.readFileSync(0, "utf8").trim();
    if (stdin) return stdin;
  } catch {
    /* нет stdin */
  }
  fail(m.noMessageTextStdin);
}

function fmt(item: QueueItem): string {
  const when =
    item.trigger.type === "at"
      ? m.fmtAt(new Date(item.trigger.at!).toLocaleString())
      : `${m.fmtLimits}${item.expectedResetAt ? m.fmtExpect(new Date(item.expectedResetAt).toLocaleString()) : ""}${item.fallbackFromAt ? m.fmtFallback : ""}`;
  const preview = item.message.length > 60 ? `${item.message.slice(0, 60)}…` : item.message;
  const perm = item.permissionMode && item.permissionMode !== "default" ? ` ${m.fmtPerm(item.permissionMode)}` : "";
  return `[${item.id}] ${item.status.padEnd(8)} ${when}  ${path.basename(item.projectDir)}  "${preview}"${perm}`;
}

program
  .command("add")
  .description("Queue a message")
  .option("-m, --message <text>", "message text")
  .option("-f, --message-file <path>", "file with message text")
  .option("--at <time>", 'delivery time: "09:00", "tomorrow 9:00", "tomorrow 9am", ISO')
  .option(
    "--session <id>",
    "session id or auto (auto = most recent session for the project; with several active sessions pass the id explicitly)",
    "auto",
  )
  .option("--project <dir>", "project directory", process.cwd())
  .option(
    "--permission-mode <mode>",
    "permission mode for the delivered run (default, acceptEdits, bypassPermissions, auto, dontAsk, plan)",
  )
  .action((opts) => {
    const projectDir = path.resolve(opts.project);
    const sessionId = opts.session === "auto" ? detectSessionId(projectDir) : opts.session;
    if (!sessionId) fail(m.sessionUndetected(projectDir));
    let trigger: Trigger = { type: "limits-reset" };
    if (opts.at) {
      try {
        trigger = { type: "at", at: parseAt(opts.at).toISOString() };
      } catch (e) {
        fail(String(e instanceof Error ? e.message : e));
      }
    }
    let permissionMode: PermissionMode | undefined;
    if (opts.permissionMode !== undefined) {
      if (!isPermissionMode(opts.permissionMode)) fail(`unknown permission mode: ${opts.permissionMode}`);
      permissionMode = opts.permissionMode;
    }
    const item = addItem({ sessionId, projectDir, message: readMessage(opts), trigger, permissionMode });
    console.log(m.added(fmt(item)));
  });

program
  .command("list")
  .description("Show the queue")
  .action(() => {
    const items = listItems();
    if (items.length === 0) {
      console.log(m.queueEmpty);
      return;
    }
    for (const i of items) console.log(fmt(i));
  });

program
  .command("edit <id>")
  .description("Edit text and/or time of a pending message")
  .option("-m, --message <text>", "new text")
  .option("-f, --message-file <path>", "file with new text")
  .option("--at <time>", "new time (switches trigger to at)")
  .option("--on-reset", "switch trigger to 'after limits reset'")
  .action((id, opts) => {
    const item = getItem(id) ?? fail(m.noItem(id));
    if (item.status !== "pending") fail(m.itemAlready(id, item.status));
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
    console.log(m.updated(fmt(item)));
  });

program
  .command("cancel <id>")
  .description("Cancel a pending message")
  .action((id) => {
    const item = getItem(id) ?? fail(m.noItem(id));
    if (item.status !== "pending") fail(m.itemAlready(id, item.status));
    item.status = "canceled";
    writeItem(item);
    console.log(m.canceled(item.id));
  });

program
  .command("log")
  .description("Delivery history")
  .action(() => {
    const lines = readLog(50);
    console.log(lines.length ? lines.join("\n") : m.logEmpty);
  });

program
  .command("run-once")
  .description("One watcher tick (invoked by the scheduler)")
  .action(async () => {
    await runOnce(loadConfig());
  });

program
  .command("hook")
  .description("Internal: UserPromptExpansion handler for /delay")
  .action(() => {
    let raw = "";
    try {
      raw = fs.readFileSync(0, "utf8");
    } catch {
      process.exit(0);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      process.exit(0);
    }
    const res = handleHookPayload(payload as Parameters<typeof handleHookPayload>[0], loadConfig().lang);
    if (res.block) {
      process.stdout.write(JSON.stringify({ decision: "block", reason: res.reason ?? "" }));
    }
    process.exit(0);
  });

program
  .command("install")
  .description("Register the OS scheduler, the /delay skill and hook")
  .option("--no-scheduler", "do not register the scheduler")
  .option("--no-skill", "do not install the skill")
  .action((opts) => {
    const cfg = loadConfig();
    if (opts.scheduler) {
      installScheduler(cfg);
      console.log(m.schedulerRegistered(cfg.tickIntervalMinutes));
    }
    if (opts.skill) {
      console.log(m.skillInstalled(installSkill()));
      installHook(process.execPath, cliEntryPath());
      console.log(m.hookRegistered);
    }
  });

program
  .command("uninstall")
  .description("Remove scheduler, skill and hook")
  .action(() => {
    uninstallScheduler();
    uninstallSkill();
    uninstallHook(cliEntryPath());
    console.log(m.uninstalled);
  });

program
  .command("status")
  .description("Diagnostics")
  .action(() => {
    const items = listItems();
    const cfg = loadConfig();
    let lastTick = m.statusNever;
    try {
      lastTick = fs.readFileSync(lastTickFile(), "utf8").trim();
    } catch {
      /* ещё не было тика */
    }
    console.log(m.statusScheduler(schedulerInstalled()));
    console.log(m.statusTickCli(cliEntryPath()));
    console.log(m.statusClaude(cfg.claudePath));
    const token = cliTokenInfo();
    if (token.expiresAt) {
      console.log(
        token.expired ? m.statusTokenExpired(token.expiresAt.toLocaleString()) : m.statusTokenFresh(token.expiresAt.toLocaleString()),
      );
    }
    console.log(m.statusLastTick(lastTick));
    try {
      console.log(m.statusProbeError(fs.readFileSync(lastProbeErrorFile(), "utf8").trim()));
    } catch {
      /* зонд не ошибался */
    }
    console.log(m.statusQueue(pending(items).length, items.length));
  });

program
  .command("lang [code]")
  .description("Show or set the output language (en, ru)")
  .action((code) => {
    const cfg = loadConfig();
    if (!code) {
      console.log(m.langCurrent(cfg.lang, LANGS.join(", ")));
      return;
    }
    if (!isLang(code)) fail(m.langUnknown(code, LANGS.join(", ")));
    saveConfig({ ...cfg, lang: code });
    console.log(messages(code).langSet(code)); // подтверждаем уже на новом языке
  });

program.parseAsync(process.argv).catch((e) => fail(String(e instanceof Error ? e.message : e)));
