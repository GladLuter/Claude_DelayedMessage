import { beforeEach, describe, expect, it } from "vitest";
import { tempDataDir } from "./helpers.js";
import { handleHookPayload } from "../src/hook.js";
import { listItems } from "../src/queue.js";

let dir: string;
const sessionId = "e8de3900-fcc5-4e11-af38-545ab0393d44";

beforeEach(() => {
  dir = tempDataDir();
});

describe("handleHookPayload", () => {
  it("пропускает чужие команды", () => {
    const res = handleHookPayload({ command_name: "other", command_args: "x", session_id: sessionId, cwd: dir });
    expect(res.block).toBe(false);
    expect(listItems()).toHaveLength(0);
  });

  it("простой текст ставится в очередь с триггером limits-reset", () => {
    const res = handleHookPayload({
      command_name: "delay",
      command_args: "продолжай завтра",
      session_id: sessionId,
      cwd: dir,
    });
    expect(res.block).toBe(true);
    expect(res.reason).toContain("after limits reset");
    const items = listItems();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("pending");
    expect(items[0].sessionId).toBe(sessionId);
    expect(items[0].message).toBe("продолжай завтра");
    expect(items[0].trigger).toEqual({ type: "limits-reset" });
    expect(res.reason).toContain(items[0].id);
  });

  it("list на пустой очереди", () => {
    const res = handleHookPayload({ command_name: "delay", command_args: "list", session_id: sessionId, cwd: dir });
    expect(res.block).toBe(true);
    expect(res.reason).toContain("queue is empty");
  });

  it("list на пустой очереди — русский язык", () => {
    const res = handleHookPayload(
      { command_name: "delay", command_args: "list", session_id: sessionId, cwd: dir },
      "ru",
    );
    expect(res.block).toBe(true);
    expect(res.reason).toContain("очередь пуста");
  });

  it("list после добавления показывает элемент", () => {
    handleHookPayload({ command_name: "delay", command_args: "hello", session_id: sessionId, cwd: dir });
    const res = handleHookPayload({ command_name: "delay", command_args: "list", session_id: sessionId, cwd: dir });
    expect(res.block).toBe(true);
    expect(res.reason).toContain("hello");
  });

  it("cancel <id> отменяет элемент", () => {
    const add = handleHookPayload({ command_name: "delay", command_args: "hello", session_id: sessionId, cwd: dir });
    const id = listItems()[0].id;
    const res = handleHookPayload({
      command_name: "delay",
      command_args: `cancel ${id}`,
      session_id: sessionId,
      cwd: dir,
    });
    expect(res.block).toBe(true);
    expect(listItems()[0].status).toBe("canceled");
    expect(add.block).toBe(true);
  });

  it("edit <id> <текст> меняет сообщение", () => {
    handleHookPayload({ command_name: "delay", command_args: "hello", session_id: sessionId, cwd: dir });
    const id = listItems()[0].id;
    const res = handleHookPayload({
      command_name: "delay",
      command_args: `edit ${id} новый текст`,
      session_id: sessionId,
      cwd: dir,
    });
    expect(res.block).toBe(true);
    expect(listItems()[0].message).toBe("новый текст");
  });

  it('at "tomorrow 9:00" текст ставит триггер at', () => {
    const res = handleHookPayload({
      command_name: "delay",
      command_args: 'at "tomorrow 9:00" do it',
      session_id: sessionId,
      cwd: dir,
    });
    expect(res.block).toBe(true);
    const items = listItems();
    expect(items).toHaveLength(1);
    expect(items[0].trigger.type).toBe("at");
    expect(items[0].message).toBe("do it");
  });

  it("без валидного session_id — не ставит в очередь, объясняет причину", () => {
    const res = handleHookPayload({ command_name: "delay", command_args: "hello", session_id: "", cwd: dir });
    expect(res.block).toBe(true);
    expect(res.reason).toContain("could not determine the session");
    expect(listItems()).toHaveLength(0);
  });

  it("захватывает permission_mode из payload в элемент", () => {
    handleHookPayload({ command_name: "delay", command_args: "hello", session_id: sessionId, cwd: dir, permission_mode: "bypassPermissions" } as any);
    const item = listItems().find((i) => i.message === "hello")!;
    expect(item.permissionMode).toBe("bypassPermissions");
  });
});
