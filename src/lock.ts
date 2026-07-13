import crypto from "node:crypto";
import fs from "node:fs";
import { ensureDirs, lockFile } from "./paths.js";

let heldToken: string | undefined;

export function acquireLock(staleMs: number): boolean {
  ensureDirs();
  const token = `${process.pid}:${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(lockFile(), token, { flag: "wx" });
    heldToken = token;
    return true;
  } catch {
    try {
      const age = Date.now() - fs.statSync(lockFile()).mtimeMs;
      if (age <= staleMs) return false;
      // Атомарный перехват устаревшего lock: renameSync выигрывает ровно один процесс.
      const claimed = `${lockFile()}.stale-${process.pid}-${crypto.randomUUID().slice(0, 4)}`;
      fs.renameSync(lockFile(), claimed);
      fs.unlinkSync(claimed);
      fs.writeFileSync(lockFile(), token, { flag: "wx" });
      heldToken = token;
      return true;
    } catch {
      return false;
    }
  }
}

/** Удаляет lock ТОЛЬКО если он всё ещё наш (за долгую доставку его мог перехватить другой тик). */
export function releaseLock(): void {
  try {
    if (heldToken !== undefined && fs.readFileSync(lockFile(), "utf8") === heldToken) {
      fs.unlinkSync(lockFile());
    }
  } catch {
    /* нет файла или гонка — ничего не удаляем */
  }
  heldToken = undefined;
}
