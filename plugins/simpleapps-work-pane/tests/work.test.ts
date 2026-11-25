import type { CommandRunInput, McpToolResult, On, ProcessRunResult } from "claude-code";
import type { MockClock } from "claude-code/testing";
import { expect, mock, test } from "claude-code/testing";

import {
  BASECAMP_KEY,
  CONNECTOR,
  HELP,
  NOT_WORK,
  briefProjectIds,
  changedSinceArgv,
  checkSummary,
  completedIds,
  countColor,
  duplicateServers,
  failedParts,
  hasChangesOf,
  inWatchedRepo,
  indexTodos,
  isDueTick,
  issueCountArgv,
  label,
  linkedTargets,
  listFrom,
  listKeys,
  mcpJson,
  mcpProblem,
  parseCount,
  parseIssueCount,
  pendingLabel,
  rememberClosed,
  skipClosed,
  stdoutJson,
  syncResult,
  todosToFetch,
  tracked,
  trackedRows,
  withBriefProblem,
} from "../hooks/register";
import type { Status } from "../types";

const NOW = Date.parse("2026-11-22T14:00:00Z");
const DAY = 86_400_000;
const PANE = {
  plugin: "simpleapps-work-pane",
  component: "Pane",
  requestId: "work",
  props: {
    title: "Work",
    isFocused: false,
    bodyColumns: 28,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const;

const result = (body: string | undefined, isError = false): McpToolResult => ({
  content: body === undefined ? [] : [{ type: "text", text: body }],
  isError,
});
const text = (value: unknown): McpToolResult => result(JSON.stringify(value));

const STATUS: Status = {
  org: "simpleapps-com",
  watch_repos: ["site", "acme/tool"],
  auto_sync: false,
  sync_minutes: 5,
  last_sync: null,
  items: [
    {
      id: "bc-todo-11",
      source: "basecamp",
      kind: "todo",
      status: "open",
      updated: "2026-11-01T00:00:00Z",
      project: "22",
      mine: true,
    },
    {
      id: "bc-todo-12",
      source: "basecamp",
      kind: "todo",
      status: "open",
      updated: "2026-11-01T00:00:00Z",
      project: "22",
      mine: false,
    },
    {
      id: "gh-site-1",
      source: "github",
      kind: "issue",
      status: "open",
      updated: "x",
      project: null,
      mine: false,
    },
    {
      id: "gh-site-2",
      source: "github",
      kind: "pull",
      status: "open",
      updated: "x",
      project: null,
      mine: false,
    },
    {
      id: "gh-other-3",
      source: "github",
      kind: "issue",
      status: "open",
      updated: "x",
      project: null,
      mine: false,
    },
  ],
  briefs: [{ hub: "site", projects: ["22", "22", "0"] }],
};

const INDEX = {
  lists: [
    {
      project_id: 22,
      project_name: "Site",
      todolist_name: "Bugs",
      todos: [
        { id: 11, updated_at: "2026-11-01T00:00:00Z" },
        { id: 13, updated_at: "2026-11-20T00:00:00Z" },
      ],
    },
  ],
  fingerprint: "f1",
};

test("labels, colours and parsing", async () => {
  expect(label(undefined)).toBe("?");
  expect(label({ open: 3, complete: false })).toBe("3+");
  expect(countColor(0)).toBe("green");
  expect(countColor(0, false)).toBeUndefined();
  expect(countColor(11)).toBe("red");
  expect(countColor(null)).toBeUndefined();
  expect(mcpJson(text({ a: 1 }))).toEqual({ a: 1 });
  expect(mcpJson(result("not json"))).toBeUndefined();
  expect(mcpJson(result(undefined, true))).toBeUndefined();
  expect(mcpJson(result(undefined))).toBeUndefined();
  expect(parseCount(text({ open: 2, complete: false, fingerprint: "f" }))).toEqual({
    open: 2,
    complete: false,
    fingerprint: "f",
  });
  expect(parseCount(text({ open: "x" }))).toBeUndefined();
  expect(parseIssueCount({ stdout: "7\n" })).toBe(7);
  expect(parseIssueCount(undefined)).toBeUndefined();
  expect(stdoutJson({ stdout: '{"ok":true}' })).toEqual({ ok: true });
  expect(stdoutJson(undefined)).toBeUndefined();
  expect(mcpProblem(undefined, new Error("no connected MCP tool x"))).toMatch(/tool not loaded/);
  expect(mcpProblem(undefined, "boom")).toBe("call failed: boom");
  expect(mcpProblem(result("bad", true))).toBe("error: bad");
  expect(mcpProblem(result(undefined))).toBe("no text in the result");
  expect(mcpProblem(result("plain"))).toBe("not JSON (5 chars): plain");
});

test("what is tracked, and the search arguments", async () => {
  expect(inWatchedRepo("gh-site-1", ["site"])).toBe(true);
  expect(inWatchedRepo("GH-Site-1", ["acme/Site"])).toBe(true);
  expect(inWatchedRepo("gh-sites-1", ["site"])).toBe(false);
  expect(tracked(STATUS)).toEqual({ basecamp: 1, github: 1 });
  expect(trackedRows(undefined)).toEqual([]);
  expect(trackedRows({ basecamp: 1, github: 2 })[0]).toEqual(["Tracking 3", true]);
  expect(issueCountArgv("site", "org").at(-3)).toBe("q=repo:org/site is:issue is:open");
  expect(issueCountArgv("acme/tool", "org").at(-3)).toBe("q=repo:acme/tool is:issue is:open");
  expect(changedSinceArgv(["site", "acme/tool"], "org", "2026").at(-3)).toBe(
    "q=repo:org/site repo:acme/tool updated:>=2026",
  );
});

test("change detection: edited, new and departed todos, linked ones, closed ones", async () => {
  const remote = indexTodos(INDEX);
  expect(remote.map((t) => t.id)).toEqual([11, 13]);
  expect(indexTodos({}).length).toBe(0);
  // 13 is new; 11 is unchanged; 12 left the list but is not mine
  expect(todosToFetch(remote, STATUS, false).map((t) => t.id)).toEqual([13]);
  // On a Sync every departed local todo is read again
  expect(todosToFetch(remote, STATUS, true).map((t) => t.id)).toEqual([13, 12]);
  // A malformed local id parses to NaN and is skipped, never fetched as departed
  const malformed = {
    ...STATUS,
    items: [{ ...STATUS.items[0], id: "bc-todo-x" } as Status["items"][number]],
  };
  expect(todosToFetch([], malformed, true)).toEqual([]);
  expect(
    linkedTargets({
      ok: true,
      locked: false,
      failed: null,
      basecamp: [
        { id: "bc-todo-5", project: "22" },
        { id: "bc-todo-6", project: null },
      ],
    }),
  ).toEqual([{ id: 5, project_id: 22, project_name: "", list: "" }]);
  expect(linkedTargets(undefined)).toEqual([]);
  expect(
    completedIds([
      { id: 1, basecamp: { completed: true } },
      { id: 2, basecamp: {} },
      { basecamp: { completed: true } },
    ]),
  ).toEqual([1]);
  const targets = [
    { id: 1, project_id: 1, project_name: "", list: "" },
    { id: 2, project_id: 1, project_name: "", list: "" },
  ];
  expect(skipClosed(targets, { "1": NOW - DAY }, NOW).map((t) => t.id)).toEqual([2]);
  expect(skipClosed(targets, { "1": NOW - 8 * DAY }, NOW).map((t) => t.id)).toEqual([1, 2]);
  expect(rememberClosed({ "1": NOW - 8 * DAY, "2": NOW - DAY }, [3], NOW)).toEqual({
    "2": NOW - DAY,
    "3": NOW,
  });
  expect(briefProjectIds(STATUS)).toEqual([22]);
  expect(briefProjectIds(undefined)).toEqual([]);
});

test("pending, due, results and the check line", async () => {
  expect(pendingLabel(undefined)).toBe("not checked yet");
  expect(pendingLabel({ basecamp: 0, github: 0, neverSynced: true })).toBe("never synced");
  expect(pendingLabel({ basecamp: 0, github: 0, neverSynced: false })).toBe("up to date");
  expect(pendingLabel({ basecamp: 2, github: 1, neverSynced: false })).toBe(
    "2 Basecamp · 1 GitHub changed",
  );
  expect(pendingLabel({ basecamp: 0, github: 4, neverSynced: false })).toBe("4 GitHub changed");
  expect(hasChangesOf(undefined)).toBe(false);
  expect(hasChangesOf({ basecamp: 1, github: 0, neverSynced: false })).toBe(true);
  expect(isDueTick(undefined, NOW, 5)).toBe(true);
  expect(isDueTick(NOW - 60_000, NOW, 5)).toBe(false);
  expect(syncResult(undefined, NOW).detail).toBe("work refresh did not run");
  expect(syncResult({ ok: false, locked: true, failed: null, basecamp: [] }, NOW).detail).toBe(
    "another sync is running",
  );
  expect(
    syncResult(
      { ok: false, locked: false, failed: { step: "follow", detail: "x" }, basecamp: [] },
      NOW,
    ).detail,
  ).toBe("failed at follow: x");
  const ok = syncResult({ ok: true, locked: false, failed: null, basecamp: [] }, NOW);
  expect(ok).toEqual({ at: NOW, ok: true, detail: "synced" });
  expect(withBriefProblem(ok, "p").detail).toBe("synced; briefs kept their last Basecamp read (p)");
  expect(withBriefProblem(ok, undefined)).toBe(ok);
  expect(failedParts("a", "b", ["site", "tool"], [1, undefined], undefined)).toEqual([
    "Basecamp count (a)",
    "Basecamp index (b)",
    "tool",
    "GitHub changes",
  ]);
  expect(
    checkSummary(
      { open: 2, complete: true, fingerprint: "f" },
      { basecamp: 0, github: 0, neverSynced: true },
      { site: 3, tool: null },
      [],
      { basecamp: 1, github: 1 },
    ),
  ).toBe(
    "tracking 2 (1 Basecamp, 1 GitHub); 2 open Basecamp todos (fingerprint f); never synced; site: 3, tool: ?; check ok",
  );
  expect(
    checkSummary(undefined, { basecamp: 0, github: 0, neverSynced: false }, {}, ["x"], {
      basecamp: 0,
      github: 0,
    }),
  ).toBe(
    "tracking 0 (0 Basecamp, 0 GitHub); ? open Basecamp todos; up to date; no repos; check failed: x",
  );
});

// ---------------------------------------------------------------- the pane in a session

interface World {
  store: Map<string, unknown>;
  runs: string[][];
  writes: Map<string, string>;
  hasNode: boolean;
  ghSignedIn: boolean;
  connected: boolean;
  /** The project's .mcp.json, or none. */
  mcpFile: string | undefined;
  /** The session root holds work/README.md: a simpleapps-work project. */
  hasWork: boolean;
  /** Every pane open. */
  opens: number;
  /** How many connect calls fail as "still connecting" first: a fresh `claude -p` run. */
  slowConnects: number;
  /** How many tool calls fail as "no connected MCP tool" first, though connected. */
  toolFails: number;
  status: Status | undefined;
  calls: string[];
  /** Every server `$.mcp.connect` was asked for. */
  connects: string[];
  /** work/list.json, or none. */
  listFile: string | undefined;
  /** Every text `$.ui.copy` was asked to copy, with its surface. */
  copies: string[];
}

const ran = (exitCode: number, stdout: string): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false },
});

const REFRESHED = {
  ok: true,
  locked: false,
  failed: null,
  basecamp: [{ id: "bc-todo-5", project: "22" }],
  steps: [],
};

function stubs(on: On, overrides: Partial<World> = {}): World & { clock: MockClock } {
  const world = {
    store: new Map(),
    runs: [],
    writes: new Map(),
    hasNode: true,
    ghSignedIn: true,
    connected: true,
    mcpFile: undefined,
    hasWork: true,
    opens: 0,
    slowConnects: 0,
    toolFails: 0,
    status: STATUS,
    calls: [] as string[],
    connects: [] as string[],
    listFile: undefined,
    copies: [] as string[],
    ...overrides,
    clock: mock.clock(on, { now: NOW }),
  };
  on("session.root", () => ({ value: "/p" }));
  on("session.machine", () => ({
    value: {
      sysname: "Darwin",
      release: "24",
      machine: "arm64",
      packageManagers: [],
      runtimes: world.hasNode ? ["node"] : [],
    },
  }));
  on("store.get", (_$, e) => ({ value: world.store.get(e.key) }));
  on("store.set", (_$, e) => {
    world.store.set(e.key, e.value);
    return { value: undefined };
  });
  on("fs.read", (_$, e) => {
    const file = e.path === "/p/.mcp.json" ? world.mcpFile : undefined;
    const read = file ?? (e.path === "/p/work/list.json" ? world.listFile : undefined);
    if (read === undefined) throw new Error("ENOENT");
    return { value: read };
  });
  on("ui.copy", (_$, e) => {
    world.copies.push(`${e.text}@${e.surface}`);
    return { value: { isCopied: true } };
  });
  on("fs.exists", (_$, e) => ({ value: world.hasWork && e.path === "/p/work/README.md" }));
  on("fs.write", (_$, e) => {
    world.writes.set(e.path, e.text);
    return { value: undefined };
  });
  on("process.run", (_$, e) => {
    const argv = [...e.argv];
    world.runs.push(argv);
    if (argv[0] === "gh" && argv[1] === "auth") return ran(world.ghSignedIn ? 0 : 1, "");
    if (argv[0] === "gh") return ran(0, "3\n");
    if (argv.includes("status"))
      return world.status ? ran(0, JSON.stringify(world.status)) : ran(1, "");
    return ran(0, JSON.stringify(REFRESHED));
  });
  on("mcp.connect", (_$, e) => {
    world.connects.push(e.server);
    return {
      value:
        world.connected && world.connects.length > world.slowConnects
          ? { isConnected: true, server: CONNECTOR }
          : { isConnected: false, reason: "unlisted", message: "not listed" },
    };
  });
  on("mcp.call", (_$, e) => {
    world.calls.push(e.tool);
    // Connected, but the tools not callable yet: what a fresh session can see for a moment
    if (world.toolFails > 0) {
      world.toolFails--;
      return { deny: `no connected MCP tool ${e.tool}` };
    }
    if (e.tool === "count_my_todos")
      return { value: text({ open: 1, complete: true, fingerprint: "f1" }) };
    if (e.tool === "list_my_todo_index") return { value: text(INDEX) };
    if (e.tool === "list_todos") return { value: text({ items: [] }) };
    return { value: text({ id: e.args?.todo_id, completed: e.args?.todo_id === 5 }) };
  });
  on("session.start", () => ({ cwd: "/p" }));
  on("command.register", () => ({ value: { command: "work" } }));
  on("ui.open", () => {
    world.opens++;
    return { value: { isPlaced: true } };
  });
  on("ui.toast", () => ({ value: undefined }));
  return world;
}

const work = (args: string): CommandRunInput => ({
  command: "work",
  args,
  origin: { kind: "composer" },
  presentation: { isFullscreen: false, columns: 120 },
});

const START = { surface: "terminal", isInteractive: true, cwd: "/p" } as const;

test("/work check counts what you track, and the pane shows it", async ($, on) => {
  const world = stubs(on);
  await $.session.start(START);
  const answer = await $.command.run(work("check"));
  expect(answer.text).toBe(
    "tracking 2 (1 Basecamp, 1 GitHub); 1 open Basecamp todos (fingerprint f1); never synced; acme/tool: 3, site: 3; check ok",
  );
  // The work command runs from the plugin, on the project's work/
  const status = world.runs.find((argv) => argv[0] === "node" && argv.includes("status"));
  expect(String(status?.[1])).toMatch(/\/scripts\/work\.ts$/);
  expect(status?.slice(2, 4)).toEqual(["--root", "/p/work"]);
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ type: "Text", text: "Tracking 2" })).toBeDefined();
    expect(await ui.find({ type: "Text", text: "never synced" })).toBeDefined();
    await ui.unmount();
  }
});

test("outside a work project the pane stays idle: no pane, no gh, no checks", async ($, on) => {
  const world = stubs(on, { hasWork: false });
  await $.session.start(START);
  await world.clock.advance(30 * 60_000);
  expect(world.runs).toEqual([]);
  expect(world.calls).toEqual([]);
  expect(world.connects).toEqual([]);
  expect(world.opens).toBe(0);
  // /work still answers, and says where the pane runs
  for (const args of ["", "check", "sync"]) {
    expect((await $.command.run(work(args))).text).toBe(NOT_WORK);
  }
  // /work help explains the command here too
  expect((await $.command.run(work("help"))).text).toBe(HELP);
  expect(world.runs).toEqual([]);
  expect(world.opens).toBe(0);
});

test("/work help explains the command and opens, syncs and checks nothing", async ($, on) => {
  const world = stubs(on);
  await $.session.start(START);
  const runs = world.runs.length;
  const opens = world.opens;
  const answer = await $.command.run(work(" help "));
  expect(answer.text).toBe(HELP);
  expect(answer.text).toContain("/work sync");
  expect(world.runs.length).toBe(runs);
  expect(world.opens).toBe(opens);
  // Let the session's opening check finish before the test ends
  await $.command.run(work("check"));
});

const logs = (world: World) => world.runs.filter((argv) => argv.includes("log-check"));
const outcomeOf = (argv: string[] | undefined) => argv?.[(argv?.indexOf("--outcome") ?? -2) + 1];

test("each check that runs is logged once, with whether it started a sync; a tick that is not due is not (GH #34)", async ($, on) => {
  const world = stubs(on);
  await $.session.start(START);
  await $.command.run(work("check"));
  // One line: `/work check` waited for the opening check and used its reading (commandChecks)
  const before = logs(world).length;
  expect(before).toBe(1);
  for (const argv of logs(world)) {
    expect(outcomeOf(argv)).toBe("ok");
    expect(String(argv.at(-1))).toMatch(/ · no sync$/);
    // Written by the scripts, on the project's work/
    expect(argv.slice(2, 4)).toEqual(["--root", "/p/work"]);
  }
  // A tick inside the interval is not due: no line
  await world.clock.advance(60_000);
  expect(logs(world).length).toBe(before);
  // Past the interval the timer checks, and logs once
  await world.clock.advance(5 * 60_000);
  expect(logs(world).length).toBe(before + 1);
  expect(logs(world).at(-1)).toContain("timer");
});

test("a check that starts a sync says so (GH #34)", async ($, on) => {
  const world = stubs(on, { status: { ...STATUS, auto_sync: true } });
  // Synced before, so GitHub's changes since then are pending; no session start, so the
  // command's own check is the one that starts the sync, and the command waits for it
  world.store.set("lastSyncAt", "2026-11-22T00:00:00Z");
  await $.command.run(work(""));
  expect(logs(world).some((argv) => String(argv.at(-1)).endsWith(" · sync started"))).toBe(true);
  expect(world.runs.some((argv) => argv.includes("refresh"))).toBe(true);
});

test("a failed check is logged as failed, and over a stale record the pane shows stale in red (GH #34)", async ($, on) => {
  const world = stubs(on, { connected: false, status: { ...STATUS, stale: true } });
  await $.session.start(START);
  await $.command.run(work(""));
  expect(outcomeOf(logs(world).at(-1))).toBe("failed");
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(
    await ui.find({ type: "Text", text: "stale: no ok check or sync in 15 min" }),
  ).toBeDefined();
  await ui.unmount();
});

test("when work status cannot run, the check is still logged as failed (GH #34)", async ($, on) => {
  const world = stubs(on, { status: undefined });
  await $.session.start(START);
  await $.command.run(work(""));
  const last = logs(world).at(-1);
  expect(outcomeOf(last)).toBe("failed");
  expect(String(last?.at(-1))).toBe("work status · no sync");
});

test("cycle refuted design: a failing work status is logged once per interval, not every tick", async ($, on) => {
  // WorkPane OldLoggedTicksNotDue: the due test comes before work status
  const world = stubs(on, { status: undefined });
  await $.session.start(START);
  await $.command.run(work(""));
  const opened = logs(world).length;
  for (let i = 0; i < 3; i++) await world.clock.advance(60_000);
  expect(logs(world).length).toBe(opened);
  await world.clock.advance(3 * 60_000);
  expect(logs(world).length).toBe(opened + 1);
  expect(outcomeOf(logs(world).at(-1))).toBe("failed");
});

test("cycle-3: one sync at a time in a process; the second is turned away", async ($, on) => {
  const world = stubs(on);
  const first = $.command.run(work("sync"));
  const second = $.command.run(work("sync"));
  const answers = [(await first).text, (await second).text];
  expect(answers).toContain("Work sync: already syncing");
  expect(answers).toContain("Work sync: synced");
  expect(
    world.runs.filter((argv) => argv.includes("refresh") && !argv.includes("command+linked"))
      .length,
  ).toBe(1);
});

const refreshes = (world: World) => world.runs.filter((argv) => argv.includes("refresh"));

test("a headless /work sync waits for a connector that is still connecting (GH #35)", async ($, on) => {
  // A fresh `claude -p "/work sync"`: no session start, and the first connect is not ready yet
  const world = stubs(on, { slowConnects: 1 });
  const pending = $.command.run(work("sync"));
  await world.clock.advance(2000);
  expect((await pending).text).toBe("Work sync: synced");
  expect(refreshes(world)[0]).not.toContain("--partial");
  expect(world.store.get("lastSyncAt")).toBe(new Date(NOW).toISOString());
});

test("a sync that cannot read Basecamp refreshes GitHub as partial and records no sync (GH #35)", async ($, on) => {
  const world = stubs(on, { connected: false });
  const pending = $.command.run(work("sync"));
  for (let i = 0; i < 3; i++) await world.clock.advance(2000);
  const answer = await pending;
  expect(answer.text).toMatch(
    /^Work sync: synced, GitHub only; Basecamp skipped \(tool not loaded/,
  );
  // Every refresh is partial, and the linked pass does not run (WorkPane cycle-2: no `ok` line)
  expect(refreshes(world).length).toBe(1);
  expect(refreshes(world).every((argv) => argv.includes("--partial"))).toBe(true);
  expect(world.runs.some((argv) => argv.includes("command+linked"))).toBe(false);
  expect(world.store.get("lastSyncAt")).toBeUndefined();
  expect(world.store.get("lastOkAt")).toBeUndefined();
});

test("cycle-4: a headless /work check waits for the sync the opening check started, and logs one 'sync started'", async ($, on) => {
  const world = stubs(on, { status: { ...STATUS, auto_sync: true } });
  world.store.set("lastSyncAt", "2026-11-22T00:00:00Z");
  await $.session.start(START);
  const answer = await $.command.run(work("check"));
  // The sync finished before the command answered, so `claude -p` cannot exit mid-sync
  expect(refreshes(world).length).toBeGreaterThan(0);
  expect(answer.text).toMatch(/check ok$/);
  const started = logs(world).filter((argv) => String(argv.at(-1)).endsWith(" · sync started"));
  expect(started.length).toBe(1);
});

test("cycle: a stored sync_minutes of 10 makes a 5-minute tick not due", async ($, on) => {
  const world = stubs(on, { status: { ...STATUS, sync_minutes: 10 } });
  await $.session.start(START);
  await $.command.run(work("check"));
  expect(world.store.get("syncMinutes")).toBe(10);
  const before = logs(world).length;
  await world.clock.advance(6 * 60_000);
  expect(logs(world).length).toBe(before);
  await world.clock.advance(5 * 60_000);
  expect(logs(world).length).toBe(before + 1);
});

test("cycle-5: stale clears once a check succeeds", async ($, on) => {
  const world = stubs(on, { connected: false, status: { ...STATUS, stale: true } });
  await $.command.run(work(""));
  const stale = { type: "Text", text: "stale: no ok check or sync in 15 min" } as const;
  let ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await ui.find(stale)).toBeDefined();
  await ui.unmount();
  world.connected = true;
  await $.command.run(work(""));
  expect(world.store.get("lastOkAt")).toBe(NOW);
  ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await ui.findAll(stale)).toEqual([]);
  await ui.unmount();
});

test("cycle-5: with work status unreadable and no ok record, the pane shows stale from its own record", async ($, on) => {
  stubs(on, { status: undefined });
  await $.command.run(work(""));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(
    await ui.find({ type: "Text", text: "stale: no ok check or sync in 15 min" }),
  ).toBeDefined();
  await ui.unmount();
});

test("a connector that never connects logs its failure once, not once per retry", async ($, on) => {
  const world = stubs(on, { connected: false });
  await $.session.start(START);
  // The opening check, then 8 retries 15 s apart: only the opening and the last one are logged
  for (let i = 0; i < 9; i++) await world.clock.advance(15_000);
  const failed = logs(world).filter((argv) => outcomeOf(argv) === "failed");
  expect(failed.length).toBe(2);
  expect(failed[0]).toContain("open");
  expect(failed[1]).toContain("retry");
});

test("/work check looks again when the connector connects before its tools can be called", async ($, on) => {
  const world = stubs(on, { toolFails: 2 });
  const pending = $.command.run(work("check"));
  for (let i = 0; i < 3; i++) await world.clock.advance(2000);
  expect((await pending).text).toMatch(/check ok$/);
});

test("/work sync fetches what changed, refreshes work/, and fetches the linked todos it found", async ($, on) => {
  const world = stubs(on);
  await $.session.start(START);
  const answer = await $.command.run(work("sync"));
  expect(answer.text).toBe("Work sync: synced");
  expect(world.writes.has("/p/tmp/work-sync.json")).toBe(true);
  expect(world.writes.has("/p/tmp/work-brief-todos.json")).toBe(true);
  const refreshes = world.runs.filter((argv) => argv.includes("refresh"));
  expect(refreshes.length).toBe(2);
  expect(refreshes[1]).toContain("command+linked");
  // The linked todo came back completed: it is remembered and skipped for a week
  expect(world.store.get("closedLinked")).toEqual({ "5": NOW });
  expect(world.store.get("lastSyncAt")).toBe(new Date(NOW).toISOString());
});

test("the pane says what is missing: node, a signed-in gh, the connector", async ($, on) => {
  stubs(on, { hasNode: false, ghSignedIn: false, status: undefined });
  await $.session.start(START);
  const answer = await $.command.run(work("check"));
  expect(answer.text).toMatch(/node is not on the PATH/);
  expect(answer.text).toMatch(/gh is missing or signed out/);
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(
    await ui.find({
      type: "Text",
      text: "needs: node is not on the PATH: install Node 22.18 or later",
    }),
  ).toBeDefined();
  await ui.unmount();
});

test("an unconnected connector is named, and the check waits and looks again", async ($, on) => {
  const world = stubs(on, { connected: false });
  await $.session.start(START);
  const pending = $.command.run(work("check"));
  // `/work check` looks again three times, two seconds apart, while the connector is not loaded
  for (let i = 0; i < 3; i++) await world.clock.advance(2000);
  const answer = await pending;
  expect(answer.text).toMatch(/connect SimpleApps Basecamp \(install simpleapps-work and sign in/);
  expect(world.calls).toEqual([]);
});

test("a project server on the connector's URL is a need: named, never connected or called", async ($, on) => {
  const mcpFile = JSON.stringify({
    mcpServers: {
      basecamp2: { type: "http", url: "https://basecamp.augur-mcp.com/mcp" },
      other: { type: "http", url: "https://api.augur-mcp.com/mcp" },
    },
  });
  const world = stubs(on, { connected: false, mcpFile });
  await $.session.start(START);
  // No clock advance: a duplicate never clears on its own, so the check answers without retrying
  const answer = await $.command.run(work("check"));
  const need =
    'remove "basecamp2" from .mcp.json: it has SimpleApps Basecamp\'s URL, so Claude Code drops the connector';
  expect(answer.text).toContain(need);
  expect(answer.text).not.toMatch(/"other"|tool not loaded/);
  // Only the plugin's own connector is ever asked for, and no tool is called
  expect(world.connects.length).toBeGreaterThan(0);
  expect(world.connects.every((server) => server === CONNECTOR)).toBe(true);
  expect(world.calls).toEqual([]);
  // The pane shows it on its needs line
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await ui.find({ type: "Text", text: `needs: ${need}` })).toBeDefined();
  await ui.unmount();
});

test("duplicateServers reads .mcp.json for servers on the connector's URL", async () => {
  const servers = (s: unknown): string => JSON.stringify({ mcpServers: s });
  expect(
    duplicateServers(
      servers({
        a: { url: "https://basecamp.augur-mcp.com/mcp" },
        b: { url: "https://basecamp.augur-mcp.com" },
        c: { url: "https://basecamp.augur-mcp.com.evil.example/mcp" },
        d: { command: "node" },
        e: null,
        f: { url: 3 },
      }),
    ),
  ).toEqual(["a", "b"]);
  expect(duplicateServers("")).toEqual([]);
  expect(duplicateServers("null")).toEqual([]);
  expect(duplicateServers("{}")).toEqual([]);
  expect(duplicateServers(servers("x"))).toEqual([]);
});

// ---------------------------------------------------------------- the List view (GH #47)

const LIST = {
  basecamp: [
    {
      key: "acme",
      rows: [{ ref: "BC101", url: "https://basecamp.example/101", title: "Fix the cart total" }],
    },
    {
      key: "beta",
      rows: [{ ref: "BC102", url: "https://basecamp.example/102", title: "New banner" }],
    },
  ],
  github: [
    {
      key: "site",
      rows: [
        { ref: "site#1", url: "https://github.com/org/site/issues/1", title: "A bug" },
        { ref: "site#2", url: "https://github.com/org/site/issues/2", title: "Another" },
      ],
    },
  ],
};

test("listFrom reads work/list.json, and listKeys gives the filters", async () => {
  expect(listFrom(JSON.stringify(LIST))).toEqual(LIST);
  expect(listFrom("")).toBeUndefined();
  expect(listFrom("null")).toBeUndefined();
  expect(listFrom('{"basecamp":[]}')).toBeUndefined();
  expect(listKeys(LIST)).toEqual([BASECAMP_KEY, "site"]);
  expect(listKeys({ basecamp: [], github: LIST.github })).toEqual(["site"]);
});

/** Pressed on a mounted pane to show the List view. */
const LIST_VIEW = { key: "list" } as const;

test("List shows the list under Basecamp, site and repo headings; ⧉ copies the id", async ($, on) => {
  const world = stubs(on, { listFile: JSON.stringify(LIST) });
  await $.session.start(START);
  await $.command.run(work("check"));
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    await ui.press(LIST_VIEW);
    for (const text of [" acme", " beta", "Fix the cart total", "Another"])
      expect(await ui.find({ type: "Text", text })).toBeDefined();
    // The headings are buttons (the filter); the view showing is bold text, the other a button
    for (const text of ["Basecamp", "site", "Summary"])
      expect(await ui.find({ type: "Button", text })).toBeDefined();
    expect(await ui.find({ type: "Text", text: "List" })).toBeDefined();
    expect(await ui.findAll({ type: "Button", text: "List" })).toEqual([]);
    // The Summary lines are gone
    expect(await ui.findAll({ type: "Text", text: "Tracking 2" })).toEqual([]);
    // The id opens its page with the OS's opener (Darwin: open), as argv, no shell
    await ui.press({ key: "open:site#2" });
    expect(world.runs.at(-1)).toEqual(["open", "https://github.com/org/site/issues/2"]);
    await ui.press({ key: "copy:site#2" });
    expect(world.copies.at(-1)).toBe(`site#2@${surface}`);
    // Every second row is striped, counted across the groups: BC102 and site#2 of the four
    const boxes = await ui.findAll({ type: "Box" });
    expect(boxes.filter((box) => box.props?.backgroundColor === "rgb(40,40,40)").length).toBe(2);
    await ui.press({ key: "summary" });
    expect(await ui.find({ type: "Text", text: "Tracking 2" })).toBeDefined();
    await ui.unmount();
  }
});

test("clicking Basecamp or a repo heading lists only its items; clicking it again lists all", async ($, on) => {
  stubs(on, { listFile: JSON.stringify(LIST) });
  await $.command.run(work("check"));
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press(LIST_VIEW);
  await ui.press({ key: "heading:site" });
  expect(await ui.findAll({ type: "Text", text: "Fix the cart total" })).toEqual([]);
  expect(await ui.findAll({ type: "Button", text: "Basecamp" })).toEqual([]);
  expect(await ui.find({ type: "Text", text: "A bug" })).toBeDefined();
  await ui.press({ key: "heading:site" });
  expect(await ui.find({ type: "Text", text: "Fix the cart total" })).toBeDefined();
  await ui.press({ key: `heading:${BASECAMP_KEY}` });
  expect(await ui.findAll({ type: "Text", text: "A bug" })).toEqual([]);
  expect(await ui.find({ type: "Text", text: "New banner" })).toBeDefined();
  await ui.press({ key: `heading:${BASECAMP_KEY}` });
  expect(await ui.find({ type: "Text", text: "A bug" })).toBeDefined();
  await ui.unmount();
});

test("a filter whose group a sync emptied shows the whole list", async ($, on) => {
  const world = stubs(on, { listFile: JSON.stringify(LIST) });
  await $.command.run(work("check"));
  let ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press(LIST_VIEW);
  await ui.press({ key: "heading:site" });
  await ui.unmount();
  world.listFile = JSON.stringify({ ...LIST, github: [] });
  await $.command.run(work("check"));
  ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await ui.find({ type: "Text", text: "Fix the cart total" })).toBeDefined();
  await ui.unmount();
});

test("List says when there is no list yet, and when it is empty", async ($, on) => {
  const world = stubs(on);
  await $.command.run(work("check"));
  let ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press(LIST_VIEW);
  expect(await ui.find({ type: "Text", text: "no list yet: press Sync" })).toBeDefined();
  await ui.unmount();
  world.listFile = JSON.stringify({ basecamp: [], github: [] });
  await $.command.run(work("check"));
  ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  expect(await ui.find({ type: "Text", text: "nothing on your list" })).toBeDefined();
  await ui.unmount();
});
