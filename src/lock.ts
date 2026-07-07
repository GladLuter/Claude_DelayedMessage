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
      if (age > staleMs) {
        fs.unlinkSync(lockFile());
        fs.writeFileSync(lockFile(), String(process.pid), { flag: "wx" });
        return true;
      }
    } catch {
      /* гонка при перехвате — уступаем */
    }
    return false;
  }
}

export function releaseLock(): void {
  try {
    fs.unlinkSync(lockFile());
  } catch {
    /* уже снят */
  }
}
