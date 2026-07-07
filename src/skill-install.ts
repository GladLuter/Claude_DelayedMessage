import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function skillSource(): string {
  // dist/skill-install.js -> <packageRoot>/skill/SKILL.md
  return fileURLToPath(new URL("../skill/SKILL.md", import.meta.url));
}

function skillTargetDir(): string {
  const home = process.env.CDM_CLAUDE_HOME ?? path.join(os.homedir(), ".claude");
  return path.join(home, "skills", "delay");
}

export function installSkill(): string {
  const target = path.join(skillTargetDir(), "SKILL.md");
  fs.mkdirSync(skillTargetDir(), { recursive: true });
  fs.copyFileSync(skillSource(), target);
  return target;
}

export function uninstallSkill(): void {
  fs.rmSync(skillTargetDir(), { recursive: true, force: true });
}
