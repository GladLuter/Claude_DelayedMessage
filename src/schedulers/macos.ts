import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LABEL = "com.claude-delayed-message.tick";

export function plistPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

export function buildPlist(intervalMinutes: number, nodePath: string, cliPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${cliPath}</string>
    <string>run-once</string>
  </array>
  <key>StartInterval</key><integer>${intervalMinutes * 60}</integer>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
`;
}

export function install(intervalMinutes: number, nodePath: string, cliPath: string): void {
  fs.mkdirSync(path.dirname(plistPath()), { recursive: true });
  fs.writeFileSync(plistPath(), buildPlist(intervalMinutes, nodePath, cliPath));
  spawnSync("launchctl", ["unload", plistPath()], { encoding: "utf8" });
  const r = spawnSync("launchctl", ["load", plistPath()], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`launchctl load failed: ${r.stderr || r.stdout}`);
}

export function uninstall(): void {
  spawnSync("launchctl", ["unload", plistPath()], { encoding: "utf8" });
  try {
    fs.unlinkSync(plistPath());
  } catch {
    /* нет файла — уже снято */
  }
}

export function isInstalled(): boolean {
  return fs.existsSync(plistPath());
}
