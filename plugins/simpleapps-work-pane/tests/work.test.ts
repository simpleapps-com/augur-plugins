import type { CommandRunInput, McpToolResult, On, ProcessRunResult } from "claude-code";
import type { MockClock } from "claude-code/testing";
import { expect, mock, test } from "claude-code/testing";

import {
  CONNECTOR,
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
  status: Status | undefined;
  calls: string[];
  /** Every server `$.mcp.connect` was asked for. */
  connects: string[];
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
    status: STATUS,
    calls: [] as string[],
    connects: [] as string[],
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
    if (e.path !== "/p/.mcp.json" || world.mcpFile === undefined) throw new Error("ENOENT");
    return { value: world.mcpFile };
  });
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
      value: world.connected
        ? { isConnected: true, server: CONNECTOR }
        : { isConnected: false, reason: "unlisted", message: "not listed" },
    };
  });
  on("mcp.call", (_$, e) => {
    world.calls.push(e.tool);
    if (e.tool === "count_my_todos")
      return { value: text({ open: 1, complete: true, fingerprint: "f1" }) };
    if (e.tool === "list_my_todo_index") return { value: text(INDEX) };
    if (e.tool === "list_todos") return { value: text({ items: [] }) };
    return { value: text({ id: e.args?.todo_id, completed: e.args?.todo_id === 5 }) };
  });
  on("session.start", () => ({ cwd: "/p" }));
  on("command.register", () => ({ value: { command: "work" } }));
  on("ui.open", () => ({ value: { isPlaced: true } }));
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
