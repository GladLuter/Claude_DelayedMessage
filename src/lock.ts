import crypto from "node:crypto";
import fs from "node:fs";
import { ensureDirs, lockFile } from "./paths.js";

export function acquireLock(staleMs: number): boolean {
  ensureDirs();
  try {
    fs.writeFileSync(lockFile(), String(process.pid), { flag: "wx" });
    return true;
  } catch {
    try {
      const age = Date.now() - fs.statSync(lockFile()).mtimeMs;
      if (age <= staleMs) return false;
      // Атомарный перехват: rename одного источника выигрывает ровно один
      // процесс; проигравший получает ENOENT и уступает.
      const claimed = `${lockFile()}.stale-${process.pid}-${crypto.randomUUID().slice(0, 4)}`;
      fs.renameSync(lockFile(), claimed);
      fs.unlinkSync(claimed);
      fs.writeFileSync(lockFile(), String(process.pid), { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }
}

export function releaseLock(): void {
  try {
    fs.unlinkSync(lockFile());
  } catch {
    /* уже снят */
  }
}
