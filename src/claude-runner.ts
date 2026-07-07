import { spawn } from "node:child_process";

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  claudePath?: string;
}

/**
 * Сообщение передаётся ТОЛЬКО через stdin. Аргументы — статические флаги
 * и провалидированный sessionId, поэтому shell:true на Windows безопасен
 * (нужен для разрешения .cmd-шимов). Путь с пробелами оборачиваем в кавычки.
 */
export function runClaude(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const useShell = process.platform === "win32";
    let cmd = opts.claudePath ?? "claude";
    if (useShell && /\s/.test(cmd)) cmd = `"${cmd}"`;
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      shell: useShell,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, opts.timeoutMs)
      : undefined;
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: -1, stdout, stderr: `${stderr}\n${String(err)}`, timedOut });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr, timedOut });
    });
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
  });
}
