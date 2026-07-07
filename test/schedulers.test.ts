import { describe, expect, it } from "vitest";
import { TASK_NAME, buildCreateArgs, buildDeleteArgs, buildQueryArgs } from "../src/schedulers/windows.js";
import { LABEL, buildPlist } from "../src/schedulers/macos.js";
import { CRON_MARKER, buildCronLine, buildServiceUnit, buildTimerUnit } from "../src/schedulers/linux.js";

const node = "/usr/bin/node";
const cli = "/opt/cdm/dist/cli.js";

describe("windows schtasks", () => {
  it("генерирует create/query/delete", () => {
    const args = buildCreateArgs(10, node, cli);
    expect(args).toContain("/SC");
    expect(args[args.indexOf("/SC") + 1]).toBe("MINUTE");
    expect(args[args.indexOf("/MO") + 1]).toBe("10");
    const tr = args[args.indexOf("/TR") + 1];
    expect(tr).toContain(node);
    expect(tr).toContain(cli);
    expect(tr).toContain("run-once");
    expect(buildQueryArgs()).toEqual(["/Query", "/TN", TASK_NAME]);
    expect(buildDeleteArgs()).toEqual(["/Delete", "/TN", TASK_NAME, "/F"]);
  });
});

describe("macos launchd", () => {
  it("plist содержит label, аргументы и интервал в секундах", () => {
    const plist = buildPlist(10, node, cli);
    expect(plist).toContain(`<string>${LABEL}</string>`);
    expect(plist).toContain(`<string>${node}</string>`);
    expect(plist).toContain(`<string>${cli}</string>`);
    expect(plist).toContain("<string>run-once</string>");
    expect(plist).toContain("<integer>600</integer>");
  });
});

describe("linux systemd/cron", () => {
  it("service+timer юниты", () => {
    const service = buildServiceUnit(node, cli);
    expect(service).toContain(`ExecStart=${node} ${cli} run-once`);
    const timer = buildTimerUnit(10);
    expect(timer).toContain("OnUnitActiveSec=10min");
    expect(timer).toContain("OnBootSec=1min");
  });

  it("cron-строка с маркером", () => {
    const line = buildCronLine(10, node, cli);
    expect(line).toBe(`*/10 * * * * "${node}" "${cli}" run-once ${CRON_MARKER}`);
  });
});
