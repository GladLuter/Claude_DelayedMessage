// Валидные режимы прав claude (--permission-mode). Строгий allowlist —
// защита от инъекции: значение из payload/флага подставляется в argv.
export const PERMISSION_MODES = ["default", "acceptEdits", "bypassPermissions", "auto", "dontAsk", "plan"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

export function isPermissionMode(v: unknown): v is PermissionMode {
  return typeof v === "string" && (PERMISSION_MODES as readonly string[]).includes(v);
}
