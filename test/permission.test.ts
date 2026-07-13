import { describe, expect, it } from "vitest";
import { isPermissionMode } from "../src/permission.js";

describe("isPermissionMode", () => {
  it.each(["default", "acceptEdits", "bypassPermissions", "auto", "dontAsk", "plan"])(
    "%s — валидный режим",
    (mode) => {
      expect(isPermissionMode(mode)).toBe(true);
    },
  );

  it.each(["", "bogus", "bypassPermissions; rm -rf", undefined, 123])(
    "%s — невалидное значение",
    (v) => {
      expect(isPermissionMode(v)).toBe(false);
    },
  );
});
