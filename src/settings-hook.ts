import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function settingsFile(): string {
  const home = process.env.CDM_CLAUDE_HOME ?? path.join(os.homedir(), ".claude");
  return path.join(home, "settings.json");
}

function toFwd(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Команда хука; cliPath используется как маркер для идемпотентности. */
function hookCommand(nodePath: string, cliPath: string): string {
  return `"${toFwd(nodePath)}" "${toFwd(cliPath)}" hook`;
}

interface HookGroup {
  hooks?: Array<{ type?: string; command?: string }>;
}

interface HooksSection {
  UserPromptExpansion?: HookGroup[];
}

function loadSettings(): Record<string, unknown> {
  let raw: string;
  try {
    raw = fs.readFileSync(settingsFile(), "utf8");
  } catch {
    return {}; // файла нет — свежая установка
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Битый settings.json молча перезаписывать нельзя — сотрутся настройки пользователя.
    throw new Error(`settings.json is corrupt (${settingsFile()}) — fix it manually and re-run cdm install`);
  }
}

function isOurs(group: HookGroup, cliMarker: string): boolean {
  return (group.hooks ?? []).some((h) => (h.command ?? "").includes(cliMarker));
}

export function installHook(nodePath: string, cliPath: string): void {
  const settings = loadSettings();
  const hooks = (settings.hooks ??= {}) as HooksSection;
  const list = (hooks.UserPromptExpansion ??= []);
  const marker = `${toFwd(cliPath)}" hook`;
  const kept = list.filter((g) => !isOurs(g, marker));
  kept.push({ hooks: [{ type: "command", command: hookCommand(nodePath, cliPath) }] });
  hooks.UserPromptExpansion = kept;
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

export function uninstallHook(cliPath: string): void {
  const settings = loadSettings();
  const hooks = settings.hooks as HooksSection | undefined;
  if (!hooks?.UserPromptExpansion) return;
  const marker = `${toFwd(cliPath)}" hook`;
  hooks.UserPromptExpansion = hooks.UserPromptExpansion.filter((g) => !isOurs(g, marker));
  if (hooks.UserPromptExpansion.length === 0) delete hooks.UserPromptExpansion;
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}
