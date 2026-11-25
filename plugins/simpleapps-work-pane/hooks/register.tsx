// Work pane: counts, change detection, and Sync for the project's work/ folder (Summary), and the
// work list from work/list.json with copyable ids (List, GH #47).
// This mod is the sensor and courier: it watches Basecamp and GitHub for changes and fetches changed
// Basecamp todos through the SimpleApps Basecamp connector (only a mod can reach it). Everything
// else, from importing to the chart, is `work refresh` in ../scripts. Every decision about a value,
// every list this file builds, and each step of the check and sync cycle is a proved rule in
// ../scripts/pane-rules.ts or work-rules.ts (model: models/WorkPane.dfy, whose "lists" section
// names the trusted boundary left here: I/O, parsing, words built from numbers). Design: wiki Work-Pane.
import { atom, read, update } from "claude-code";
import type { EngineInterface, McpToolResult, Register } from "claude-code";

import {
  type IndexTodo,
  type PaneTarget,
  briefProjectIds as provedBriefProjectIds,
  checkRuns,
  checkSucceeded,
  commandChecks,
  commandStep,
  completedIds as provedCompletedIds,
  countColour,
  countMark,
  duplicateNames,
  failedParts as provedFailedParts,
  filterKeys,
  hasChanges,
  hasOwner,
  inWatchedNames,
  isDue,
  linkedTargets as provedLinkedTargets,
  logsCheck,
  nextFilter,
  nextRetries,
  pendingOf,
  rememberClosed as provedRememberClosed,
  repoName,
  runsLinkedPass,
  shouldRetry,
  showsGroup,
  skipClosed as provedSkipClosed,
  staleShown,
  startsAutoSync,
  startsPane,
  syncBegins,
  syncResultOf,
  tally,
  todosToFetch as provedTodosToFetch,
  uniqueTodos,
  waitsForConnector,
  withBasecampSkipped as provedWithBasecampSkipped,
  withBriefProblem as provedWithBriefProblem,
} from "../scripts/pane-rules";
import { compareText, isWorkStale, lower, syncMinutesOf } from "../scripts/work-rules";
import type {
  Count,
  Pending,
  RefreshReport,
  Snapshot,
  Status,
  SyncResult,
  Target,
  ListRow,
  TodoIndex,
  Tracked,
  View,
  WorkList,
} from "../types";

/** The marketplace's Basecamp connector, from the simpleapps-work plugin, as /mcp lists it. */
export const CONNECTOR = "plugin:simpleapps-work:SimpleApps Basecamp";
const PANE = "work";
const TITLE = "Work";
const TICK_MS = 60 * 1000;
const BATCH = 5;
const STATUS_TIMEOUT_MS = 60 * 1000;
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;
// The connector can still be connecting when the pane first checks; retry soon, a few times
const NOT_LOADED = "tool not loaded";
export const NOT_WORK =
  "Work: no work/README.md here. The pane runs only in a simpleapps-work project; open a session there.";
const RETRY_MS = 15 * 1000;

const snapshot = atom(
  { plugin: "simpleapps-work-pane", key: "snapshot" } as const,
  { syncing: false, isError: false } as Snapshot,
);

// The List view (GH #47): which view shows, and its filter, a group's key or "" for All
const view = atom({ plugin: "simpleapps-work-pane", key: "view" } as const, "summary" as View);
const filter = atom({ plugin: "simpleapps-work-pane", key: "filter" } as const, "");
/** The Basecamp heading's filter key: a colon is never in a repo name, so it is no repo's key. */
export const BASECAMP_KEY = "basecamp:";

/** work/list.json as `work summary` wrote it; undefined when it is missing or not a list. */
export function listFrom(json: string): WorkList | undefined {
  try {
    const value = JSON.parse(json) as Partial<WorkList> | null;
    return Array.isArray(value?.basecamp) && Array.isArray(value.github)
      ? (value as WorkList)
      : undefined;
  } catch {
    return undefined;
  }
}

/** The List view's filter keys: Basecamp when it has todos, then each repo (proved `filterKeys`). */
export function listKeys(work: WorkList): string[] {
  return filterKeys(
    work.basecamp.length > 0,
    BASECAMP_KEY,
    work.github.map((group) => group.key),
  );
}

/** JSON from an MCP tool's first text block; undefined when the call failed or it isn't JSON. */
export function mcpJson(result: McpToolResult | undefined): unknown {
  if (result === undefined || result.isError) return undefined;
  const block = result.content.find((b) => b.type === "text");
  if (block === undefined || !("text" in block)) return undefined;
  try {
    return JSON.parse(String(block.text));
  } catch {
    return undefined;
  }
}

/** `{ open, complete, fingerprint }` from count_my_todos. */
export const parseCount = (result: McpToolResult | undefined): Count | undefined =>
  countFrom(mcpJson(result));

/** count_my_todos' JSON as a Count; undefined when it has no open count. */
export function countFrom(json: unknown): Count | undefined {
  const value = json as Partial<Count> | undefined;
  if (typeof value?.open !== "number") return undefined;
  const count: Count = { open: value.open, complete: value.complete !== false };
  return typeof value.fingerprint === "string"
    ? { ...count, fingerprint: value.fingerprint }
    : count;
}

/** `+` marks a lower bound (the tool stopped at its page cap), `?` an unknown count. */
export function label(count: Count | undefined): string {
  return count === undefined ? "?" : `${count.open}${countMark(count.complete)}`;
}

/** Green when nothing is open, red over 10; a partial count ("0+") is not nothing. */
export function countColor(
  open: number | null | undefined,
  complete = true,
): "red" | "green" | undefined {
  const colour = countColour(typeof open === "number", open ?? 0, complete);
  return colour === "plain" ? undefined : colour;
}

/** JSON a `work` command printed; undefined when it failed or printed none. */
export function stdoutJson(out: unknown): unknown {
  try {
    return JSON.parse((out as { stdout?: string } | undefined)?.stdout ?? "");
  } catch {
    return undefined;
  }
}

/** The number gh printed; undefined when it failed or printed none. */
export function parseIssueCount(out: unknown): number | undefined {
  const n = Number.parseInt((out as { stdout?: string } | undefined)?.stdout ?? "", 10);
  return Number.isNaN(n) ? undefined : n;
}

const qualify = (repo: string, org: string) => (hasOwner(repo) ? repo : `${org}/${repo}`);

const searchArgv = (q: string) => [
  "gh",
  "api",
  "-X",
  "GET",
  "search/issues",
  "-f",
  `q=${q}`,
  "--jq",
  ".total_count",
];

/** Open issues (not PRs) in one repo; a bare name is in the org. */
export const issueCountArgv = (repo: string, org: string) =>
  searchArgv(`repo:${qualify(repo, org)} is:issue is:open`);

/**
 * Issues and PRs, open or closed, updated since a time, across all watched repos in ONE search:
 * GitHub allows 30 searches a minute, so the change check must not cost one per repo.
 */
export const changedSinceArgv = (repos: string[], org: string, since: string) =>
  searchArgv(`${repos.map((r) => `repo:${qualify(r, org)}`).join(" ")} updated:>=${since}`);

/** Whether a `gh-<repo>-<n>` id is an issue of one of the watched repos (`repo` or `org/repo`). */
export function inWatchedRepo(id: string, watchRepos: string[]): boolean {
  return inWatchedNames(
    lower(id),
    watchRepos.map((repo) => lower(repoName(repo))),
  );
}

/** What you track, as in work/LIST.md: open Basecamp todos assigned to you, and open issues in watched repos. */
export function tracked(status: Status): Tracked {
  return tally(
    status.items.map((item) => ({
      status: item.status ?? "",
      source: item.source,
      kind: item.kind,
      mine: item.mine,
      watched: inWatchedRepo(item.id, status.watch_repos),
    })),
  );
}

/** The tracked totals in one line, for `/work check`. */
export const trackedLabel = (t: Tracked) =>
  `tracking ${t.basecamp + t.github} (${t.basecamp} Basecamp, ${t.github} GitHub)`;

/** The pane's Tracking lines as [text, bold]; none before the first check. */
export function trackedRows(t: Tracked | undefined): [string, boolean][] {
  if (t === undefined) return [];
  return [
    [`Tracking ${t.basecamp + t.github}`, true],
    [` Basecamp todos ${t.basecamp}`, false],
    [` GitHub issues ${t.github}`, false],
    [" ", false],
  ];
}

/** Why an MCP call gave no JSON, in a few words for the pane. */
export function mcpProblem(result: McpToolResult | undefined, failure?: unknown): string {
  // $.mcp.call reaches only connected tools; a server update needs a reconnect
  if (String(failure).includes("no connected MCP tool"))
    return `${NOT_LOADED}: reconnect SimpleApps Basecamp in /mcp`;
  if (result === undefined) return `call failed: ${String(failure ?? "no result").slice(0, 240)}`;
  const block = result.content.find((b) => b.type === "text");
  const text = block !== undefined && "text" in block ? String(block.text) : "";
  if (result.isError) return `error: ${text.slice(0, 80)}`;
  if (text === "") return "no text in the result";
  return `not JSON (${text.length} chars): ${text.slice(0, 60)}`;
}

/** What the pane says about changes waiting. */
export function pendingLabel(p: Pending | undefined): string {
  const state = pendingOf(
    p !== undefined,
    p?.neverSynced ?? false,
    p?.basecamp ?? 0,
    p?.github ?? 0,
  );
  if (state === "not-checked") return "not checked yet";
  if (state === "never-synced") return "never synced";
  if (state === "up-to-date") return "up to date";
  const parts = [p?.basecamp && `${p.basecamp} Basecamp`, p?.github && `${p.github} GitHub`].filter(
    Boolean,
  );
  return `${parts.join(" · ")} changed`;
}

export const hasChangesOf = (p: Pending | undefined) =>
  hasChanges(p !== undefined, p?.neverSynced ?? false, p?.basecamp ?? 0, p?.github ?? 0);

/** One line describing a check, for `/work check` (and for anyone verifying the pane without seeing it). */
export function checkSummary(
  count: Count | undefined,
  pending: Pending,
  issues: Record<string, number | null>,
  failed: string[],
  totals: Tracked,
): string {
  const fingerprint = count?.fingerprint ? ` (fingerprint ${count.fingerprint})` : "";
  const repos = Object.entries(issues)
    .map(([repo, n]) => `${repo}: ${n ?? "?"}`)
    .join(", ");
  const result = failed.length ? `check failed: ${failed.join(", ")}` : "check ok";
  return [
    trackedLabel(totals),
    `${label(count)} open Basecamp todos${fingerprint}`,
    pendingLabel(pending),
    repos || "no repos",
    result,
  ].join("; ");
}

/** The parts of a check that failed, named for the pane; empty when all worked. */
export function failedParts(
  countProblem: string | undefined,
  listProblem: string | undefined,
  repos: string[],
  counts: (number | undefined)[],
  changed: number | undefined | null,
): string[] {
  return provedFailedParts(
    countProblem !== undefined,
    countProblem ?? "",
    listProblem !== undefined,
    listProblem ?? "",
    repos,
    repos.map((_, i) => counts[i] !== undefined),
    changed !== undefined,
  );
}

// The shell's half of each list below: parse the JSON, dates and numbers into the proved rules'
// records, call the rule, and turn its targets back into get_todo's arguments.
const asTarget = (t: PaneTarget): Target => ({
  id: t.id,
  project_id: t.projectId,
  project_name: t.projectName,
  list: t.list,
});
const asPaneTarget = (t: Target): PaneTarget => ({
  id: t.id,
  projectId: t.project_id,
  projectName: t.project_name,
  list: t.list,
});
/** A time as the rules take it: known and its milliseconds, or unknown. */
function parsedTime(text: string | undefined): { known: boolean; ms: number } {
  const ms = Date.parse(text ?? "");
  return Number.isNaN(ms) ? { known: false, ms: 0 } : { known: true, ms };
}

/** Every todo in list_my_todo_index, once each, with the project and list names get_todo lacks. */
export function indexTodos(index: TodoIndex): IndexTodo[] {
  const flat = (index.lists ?? []).flatMap((list) =>
    (list.todos ?? []).map((todo) => {
      const updated = parsedTime(todo.updated_at);
      return {
        id: todo.id,
        projectId: list.project_id ?? 0,
        projectName: list.project_name ?? "",
        list: list.todolist_name ?? "",
        updatedKnown: updated.known,
        updatedMs: updated.ms,
      };
    }),
  );
  return uniqueTodos(flat);
}

const todoNumber = (id: string) => Number(id.replace(/^bc-todo-/, ""));

/**
 * Basecamp todos to fetch. Yours that are new or edited since work/ last saw them, and local ones
 * that left your list (closed or reassigned). With `linked`, also every other local todo, the ones
 * `follow` pulled in, since only a Sync re-reads those.
 */
export function todosToFetch(remote: IndexTodo[], status: Status, linked: boolean): Target[] {
  // A malformed id (`bc-todo-x`) parses to NaN: skipped here, since the rules compare ids with
  // `===` and get_todo could not fetch it anyway
  const local = status.items
    .filter((item) => item.source === "basecamp" && item.kind === "todo")
    .filter((item) => Number.isFinite(todoNumber(item.id)))
    .map((item) => {
      const updated = parsedTime(item.updated);
      return {
        num: todoNumber(item.id),
        updatedKnown: updated.known,
        updatedMs: updated.ms,
        hasProject: item.project !== null,
        projectId: Number(item.project),
        mine: item.mine,
      };
    });
  return provedTodosToFetch(remote, local, linked).map(asTarget);
}

/** Linked todos `follow` found that aren't in work/ yet; those without a known project are skipped. */
export function linkedTargets(report: RefreshReport | undefined): Target[] {
  const found = (report?.basecamp ?? []).map((todo) => ({
    num: todoNumber(todo.id),
    hasProject: todo.project !== null,
    projectId: Number(todo.project),
  }));
  return provedLinkedTargets(found).map(asTarget);
}

/** Ids of fetched `get_todo` records that came back completed. */
export function completedIds(records: unknown[]): number[] {
  return provedCompletedIds(
    (records as { id?: unknown; basecamp?: { completed?: unknown } }[]).map((r) => ({
      hasId: typeof r.id === "number",
      id: typeof r.id === "number" ? r.id : 0,
      completed: r.basecamp?.completed === true,
    })),
  );
}

/** `$.store`'s record of closed linked todos, as the rules' list. */
const closedList = (closed: Record<string, number>) =>
  Object.entries(closed).map(([id, at]) => ({ id: Number(id), at }));

/** Linked todos seen completed within 7 days are not fetched again; a reopen shows within a week. */
export function skipClosed(
  targets: Target[],
  closed: Record<string, number>,
  now: number,
): Target[] {
  return provedSkipClosed(targets.map(asPaneTarget), closedList(closed), now).map(asTarget);
}

/** Add newly completed ids and drop entries older than 7 days. */
export function rememberClosed(
  closed: Record<string, number>,
  ids: number[],
  now: number,
): Record<string, number> {
  return Object.fromEntries(
    provedRememberClosed(closedList(closed), ids, now).map((c) => [String(c.id), c.at]),
  );
}

/** Every Basecamp project a site brief covers, once each. */
export function briefProjectIds(status: Status | undefined): number[] {
  return provedBriefProjectIds((status?.briefs ?? []).flatMap((b) => b.projects.map(Number)));
}

/** Whether a timer tick should check: another session may have checked within the interval. */
export const isDueTick = (lastChecked: number | undefined, now: number, minutes: number) =>
  isDue(lastChecked !== undefined, lastChecked ?? 0, now, minutes);

/** The pane's words for a `work refresh` report (proved `syncResultOf`). */
export function syncResult(report: RefreshReport | undefined, at: number): SyncResult {
  return syncResultOf(
    report !== undefined,
    report?.locked ?? false,
    (report?.failed ?? null) !== null,
    String(report?.failed?.step),
    String(report?.failed?.detail),
    at,
  );
}

/** A sync that could not read Basecamp refreshed GitHub only: partial, not a full sync, so it
    records no last-sync time (proved, GH #35). */
export const withBasecampSkipped = (result: SyncResult, problem: string | undefined): SyncResult =>
  provedWithBasecampSkipped(result, problem !== undefined, problem ?? "");

/** A sync that could not read the briefs' Basecamp todos still synced; it says so (proved). */
export const withBriefProblem = (result: SyncResult, problem: string | undefined): SyncResult =>
  provedWithBriefProblem(result, problem !== undefined, problem ?? "");

function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- the engine side

/** Where things are this session: the project's work/ and tmp/, and the work command. */
interface Place {
  cli: string[];
  syncFile: string;
  briefFile: string;
}

/** This machine's gaps: node, a signed-in gh. Read once a session. */
let setup: string[] = [];
/** The project's config gaps, from the last connect: a server that hides the connector. */
let serverGaps: string[] = [];
let syncing = false;
// Settles when the running sync ends: `/work` waits for it, so a headless run never exits mid-sync
let syncDone: Promise<void> = Promise.resolve();
// The session's opening check, and whether it was still running when `/work` came: `/work` then
// waits for it and uses its reading instead of checking twice (proved `commandChecks`)
let opening: Promise<void> | undefined;
let openingRunning = false;
let retries = 0;
let lastSummary = "not checked yet";
// The fingerprint the Basecamp pending count was last worked out for; a new one means re-diff
let diffedFingerprint: string | undefined;
let diffedPending = 0;

async function placeOf($: EngineInterface): Promise<Place> {
  const root = await $.session.root();
  return {
    cli: ["node", `${$.plugin.root}/scripts/work.ts`, "--root", `${root}/work`],
    // Courier files for fetched todos: client data, so under tmp/ beside work/, never in the plugin
    syncFile: `${root}/tmp/work-sync.json`,
    briefFile: `${root}/tmp/work-brief-todos.json`,
  };
}

async function cli($: EngineInterface, args: string[], timeoutMs: number): Promise<unknown> {
  const place = await placeOf($);
  return stdoutJson(
    await $.process.run([...place.cli, ...args], { timeoutMs }).catch(() => undefined),
  );
}

/** What this machine lacks for the pane: node on the PATH, and a gh that is signed in. */
async function readSetup($: EngineInterface): Promise<string[]> {
  const machine = await $.session.machine().catch(() => undefined);
  const gaps: string[] = [];
  if (machine !== undefined && !machine.runtimes.includes("node"))
    gaps.push("node is not on the PATH: install Node 22.18 or later");
  const gh = await $.process
    .run(["gh", "auth", "status"], { timeoutMs: 10_000 })
    .catch(() => undefined);
  if (gh?.exitCode !== 0) gaps.push("gh is missing or signed out: run `gh auth login`");
  return gaps;
}

/**
 * The project's own servers (its `.mcp.json` text) on the connector's URL. Claude Code drops a
 * plugin's server when a configured one has the same URL, so each of these hides the connector.
 * The pane names them for the person to remove; it never connects to or calls them.
 */
export function duplicateServers(mcpJsonText: string): string[] {
  let servers: unknown;
  try {
    servers = (JSON.parse(mcpJsonText) as { mcpServers?: unknown }).mcpServers;
  } catch {
    return [];
  }
  if (typeof servers !== "object" || servers === null) return [];
  // Parsing is the shell's; which servers hide the connector is the proved `duplicateNames`
  return duplicateNames(
    Object.entries(servers).map(([name, server]) => {
      const url: unknown =
        typeof server === "object" && server !== null
          ? (server as { url?: unknown }).url
          : undefined;
      return { name, hasUrl: typeof url === "string", url: typeof url === "string" ? url : "" };
    }),
  );
}

/** The connector's name for `$.mcp.call`, or the problem connecting it. */
async function connector($: EngineInterface): Promise<{ server?: string; problem?: string }> {
  const result = await $.mcp.connect(CONNECTOR).catch((error: unknown) => ({
    isConnected: false as const,
    message: String(error),
  }));
  serverGaps = [];
  if (result.isConnected) return { server: result.server };
  const root = await $.session.root();
  const duplicates = duplicateServers(await $.fs.read(`${root}/.mcp.json`).catch(() => ""));
  if (duplicates.length > 0) {
    // Not `tool not loaded`: a duplicate never clears on its own, so the check must not retry
    const names = duplicates.map((name) => `"${name}"`).join(", ");
    const gap = `remove ${names} from .mcp.json: it has SimpleApps Basecamp's URL, so Claude Code drops the connector`;
    serverGaps = [gap];
    return { problem: `duplicate server: ${gap}` };
  }
  return {
    problem: `${NOT_LOADED}: connect SimpleApps Basecamp (install simpleapps-work and sign in, /mcp): ${result.message}`,
  };
}

/** One connector tool's JSON, or the problem reading it. */
async function callTool(
  $: EngineInterface,
  tool: string,
  args: Record<string, unknown>,
): Promise<{ value?: unknown; problem?: string }> {
  const c = await connector($);
  if (c.server === undefined) return { problem: c.problem ?? NOT_LOADED };
  let failure: unknown;
  const result = await $.mcp.call(c.server, tool, args).catch((error: unknown) => {
    failure = error;
    return undefined;
  });
  const value = mcpJson(result);
  return value === undefined ? { problem: mcpProblem(result, failure) } : { value };
}

/** Basecamp todos waiting for a sync: re-diffed only when the fingerprint changed. */
async function basecampPending(
  $: EngineInterface,
  count: Count | undefined,
  status: Status,
): Promise<{ pending: number; problem?: string }> {
  if (count?.fingerprint !== undefined && count.fingerprint === diffedFingerprint)
    return { pending: diffedPending };
  const index = await callTool($, "list_my_todo_index", {});
  if (index.value === undefined) return { pending: 0, problem: index.problem ?? "no index" };
  const read = index.value as TodoIndex;
  diffedPending = todosToFetch(indexTodos(read), status, false).length;
  diffedFingerprint = read.fingerprint;
  return { pending: diffedPending };
}

const ghCount = async ($: EngineInterface, argv: string[]) =>
  parseIssueCount(await $.process.run(argv).catch(() => undefined));

async function fetchTodos($: EngineInterface, targets: Target[]): Promise<unknown[]> {
  const records: unknown[] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const raw = await Promise.all(
      batch.map((t) => callTool($, "get_todo", { project_id: t.project_id, todo_id: t.id })),
    );
    raw.forEach((r, j) => {
      if (r.value !== undefined) records.push({ ...batch[j], basecamp: r.value });
    });
  }
  return records;
}

/**
 * Open todos of every project a brief covers, as `--project-todos` arguments. All or nothing: a
 * project missing from the file would read as "every todo resolved", so on any failed call the
 * briefs keep their last Basecamp read instead.
 */
async function briefTodoArgs(
  $: EngineInterface,
  status: Status | undefined,
): Promise<{ args: string[]; problem?: string }> {
  const projects = briefProjectIds(status);
  if (!projects.length) return { args: [] };
  const results = await Promise.all(
    projects.map(async (project_id) => ({
      project_id,
      ...(await callTool($, "list_todos", { project_id, status: "remaining" })),
    })),
  );
  const failed = results.find((r) => r.value === undefined);
  if (failed) return { args: [], problem: `project ${failed.project_id}: ${failed.problem}` };
  const place = await placeOf($);
  await $.fs.write(place.briefFile, JSON.stringify(results.map((r) => r.value)));
  return { args: ["--project-todos", place.briefFile] };
}

async function importAndRefresh(
  $: EngineInterface,
  targets: Target[],
  trigger: string,
  extra: string[] = [],
) {
  const records = await fetchTodos($, targets);
  const place = await placeOf($);
  await $.fs.write(place.syncFile, JSON.stringify(records));
  const args = ["refresh", "--todos", place.syncFile, ...extra, "--json", "--trigger", trigger];
  const report = (await cli($, args, SYNC_TIMEOUT_MS)) as RefreshReport | undefined;
  return { report, completed: completedIds(records) };
}

async function readCount($: EngineInterface, status: Status) {
  const result = await callTool($, "count_my_todos", {});
  const count = countFrom(result.value);
  const countProblem = count === undefined ? (result.problem ?? "no count") : undefined;
  const pending = await basecampPending($, count, status);
  return { count, countProblem, pending: pending.pending, listProblem: pending.problem };
}

/** Check: counts, what changed, and (with auto_sync) a Sync when something did. */
export async function check(
  $: EngineInterface,
  trigger: "timer" | "open" | "retry",
): Promise<void> {
  const now = await $.clock.now();
  // Due first, on the interval the last good status gave (5 before any): a failing `work status`
  // is then checked and logged once per interval, not on every tick (model: WorkPane cycle). A
  // changed `sync_minutes` takes effect from the next check after it is read.
  const lastChecked = (await $.store.get("lastCheckedAt")) as number | undefined;
  const known = (await $.store.get("syncMinutes")) as number | undefined;
  const minutes = syncMinutesOf(known !== undefined, known ?? 0);
  // Not due: another session checked within the interval, so this one writes no log line
  if (!checkRuns(trigger === "timer", isDueTick(lastChecked, now, minutes))) return;
  await $.store.set("lastCheckedAt", now);
  // The pane's own record of the last ok check or full sync, for when `work status` cannot be read
  const lastOk = (await $.store.get("lastOkAt")) as number | undefined;
  const localStale = isWorkStale(lastOk !== undefined, lastOk ?? 0, false, 0, now, minutes);
  const status = (await cli($, ["status", "--json"], STATUS_TIMEOUT_MS)) as Status | undefined;
  if (status === undefined) return statusUnread($, trigger, minutes, localStale);
  if (status.sync_minutes !== minutes) await $.store.set("syncMinutes", status.sync_minutes);
  const lastSync = (await $.store.get("lastSyncAt")) as string | undefined;
  const [basecamp, counts, changed] = await Promise.all([
    readCount($, status),
    Promise.all(status.watch_repos.map((r) => ghCount($, issueCountArgv(r, status.org)))),
    // null: nothing to compare against yet (never synced, or no repos)
    lastSync === undefined || status.watch_repos.length === 0
      ? Promise.resolve(null)
      : ghCount($, changedSinceArgv(status.watch_repos, status.org, lastSync)),
  ]);
  const pending: Pending = {
    basecamp: basecamp.pending,
    github: changed ?? 0,
    neverSynced: lastSync === undefined,
  };
  // null, not undefined: $.state keeps only JSON values, and a dropped key would hide the repo
  // Alphabetical, so each repo keeps its line; the count colours flag the busy ones
  const issues = Object.fromEntries(
    status.watch_repos
      .map((r, i) => [r, counts[i] ?? null] as const)
      .sort(([a], [b]) => compareText(a, b)),
  );
  const failed = failedParts(
    basecamp.countProblem,
    basecamp.listProblem,
    status.watch_repos,
    counts,
    changed,
  );
  const totals = tracked(status);
  // The List view's rows, as the last `work summary` wrote them beside LIST.md
  const workList = listFrom(
    await $.fs.read(`${await $.session.root()}/work/list.json`).catch(() => ""),
  );
  // What the pane's `needs:` lines show: the machine's gaps, then the project's
  const needs = [...setup, ...serverGaps];
  lastSummary = checkSummary(basecamp.count, pending, issues, [...setup, ...failed], totals);
  // The connector still connecting (session start, or just reconnected): check again soon
  const notLoaded = failed.some((part) => part.includes(NOT_LOADED));
  const willRetry = shouldRetry(notLoaded, retries);
  if (willRetry) $.clock.after(RETRY_MS, () => void check($, "retry"));
  retries = nextRetries(notLoaded, retries);
  const checkOk = checkSucceeded(failed.length);
  if (checkOk) await $.store.set("lastOkAt", now);
  // Decide and claim in one step, before any await: `sync` takes `syncing` synchronously, so the
  // line's "sync started" is true and two checks cannot both start one (model: SyncStartedIsTrue)
  const startsSync = startsAutoSync(status.auto_sync, hasChangesOf(pending), syncing);
  const syncRun = startsSync ? sync($, "auto") : undefined;
  const words = checkOk ? pendingLabel(pending) : failed.join(", ");
  await logRan(
    $,
    trigger,
    checkOk,
    willRetry,
    `${words} · ${startsSync ? "sync started" : "no sync"}`,
  );
  await update($, snapshot, (s) => ({
    ...s,
    count: basecamp.count ?? s.count,
    issues,
    tracked: totals,
    pending,
    checkedAt: now,
    isError: failed.length > 0 || needs.length > 0,
    failed,
    setup: needs,
    stale: staleShown(true, checkOk, status.stale ?? false, localStale),
    staleMinutes: 3 * status.sync_minutes,
    list: workList,
  }));
  if (syncRun !== undefined) await syncRun;
}

/** A check whose `work status` could not be read: it failed, and the pane shows stale from its
    own record of the last ok check or full sync, the likeliest long outage (proved `staleShown`). */
async function statusUnread(
  $: EngineInterface,
  trigger: string,
  minutes: number,
  localStale: boolean,
): Promise<void> {
  const failed = setup.length ? setup : ["work status"];
  lastSummary = `check failed: ${failed.join(", ")}`;
  await update($, snapshot, (s) => ({
    ...s,
    isError: true,
    failed,
    setup,
    stale: staleShown(false, false, false, localStale),
    staleMinutes: 3 * minutes,
  }));
  // Best effort: if the scripts cannot run at all, this cannot log either
  await logCheck($, trigger, false, `${failed.join(", ")} · no sync`);
}

/** Log a check that ran, except a failing retry with more to come (proved `logsCheck`): a dead
    connector writes its failure once, not once per retry. */
async function logRan(
  $: EngineInterface,
  trigger: string,
  ok: boolean,
  willRetry: boolean,
  detail: string,
): Promise<void> {
  if (logsCheck(trigger === "retry", ok, willRetry)) await logCheck($, trigger, ok, detail);
}

/** One work/check.log line for a check that ran (GH #34); a failure to log never fails the check. */
async function logCheck($: EngineInterface, trigger: string, ok: boolean, detail: string) {
  const args = ["log-check", "--trigger", trigger, "--outcome", ok ? "ok" : "failed"];
  try {
    const place = await placeOf($);
    await $.process.run([...place.cli, ...args, "--detail", detail], {
      timeoutMs: STATUS_TIMEOUT_MS,
    });
  } catch {
    // Not logged; the pane still shows the check
  }
}

async function syncLinked(
  $: EngineInterface,
  report: RefreshReport | undefined,
  trigger: string,
  at: number,
  basecampRead: boolean,
) {
  // Completed linked todos stay referenced, so follow lists them every time; skip known ones
  const closed = ((await $.store.get("closedLinked")) ?? {}) as Record<string, number>;
  const linked = skipClosed(linkedTargets(report), closed, at);
  // Only after a refresh that read Basecamp: a partial sync never writes an `ok` line (GH #35)
  if (!runsLinkedPass(report?.ok ?? false, basecampRead, linked.length > 0)) return report;
  const pass = await importAndRefresh($, linked, `${trigger}+linked`);
  await $.store.set("closedLinked", rememberClosed(closed, pass.completed, at));
  return pass.report;
}

/** Sync: fetch what changed in Basecamp, then `work refresh`, then the linked todos it found. */
export async function sync($: EngineInterface, trigger: string): Promise<SyncResult> {
  // The claim comes before any await, so a check that decided to sync has it (model: cycle-4)
  if (!syncBegins(syncing))
    return { at: await $.clock.now(), ok: false, detail: "already syncing" };
  syncing = true;
  let release = () => {};
  syncDone = new Promise((resolve) => {
    release = resolve;
  });
  const at = await $.clock.now();
  await update($, snapshot, (s) => ({ ...s, syncing: true }));
  try {
    const status = (await cli($, ["status", "--json"], STATUS_TIMEOUT_MS)) as Status | undefined;
    // A fresh `claude -p` run starts with the connector still connecting (GH #35)
    await waitForConnector($);
    // The full index, not a time window: only the full list shows todos that left (closed, reassigned)
    const index = await callTool($, "list_my_todo_index", {});
    const basecampRead = index.value !== undefined;
    const targets =
      status && basecampRead
        ? todosToFetch(indexTodos(index.value as TodoIndex), status, true)
        : [];
    const briefs = await briefTodoArgs($, status);
    // Basecamp unread: GitHub still refreshes, but the run is partial, in sync.log and here
    const partial = basecampRead ? [] : ["--partial"];
    const first = await importAndRefresh($, targets, trigger, [...briefs.args, ...partial]);
    const report = await syncLinked($, first.report, trigger, at, basecampRead);
    // Partial first: a skipped Basecamp already says why the briefs were not read
    const result = withBriefProblem(
      withBasecampSkipped(
        syncResult(report, at),
        basecampRead ? undefined : (index.problem ?? "no index"),
      ),
      briefs.problem,
    );
    // result.ok is a full sync: synced (proved syncResultOf) with Basecamp read (recordsFullSync)
    if (result.ok) {
      await $.store.set("lastSyncAt", new Date(at).toISOString());
      await $.store.set("lastOkAt", at);
    } else $.ui.toast(`Work sync ${result.detail}`);
    await update($, snapshot, (s) => ({ ...s, sync: result }));
    // Re-check now: work/ changed, so the Basecamp diff must be redone even if the fingerprint has not
    diffedFingerprint = undefined;
    await check($, "open");
    return result;
  } finally {
    syncing = false;
    await update($, snapshot, (s) => ({ ...s, syncing: false }));
    release();
  }
}

/** A `simpleapps-work` project: the session root holds `work/README.md`. Elsewhere the pane stays idle. */
async function isWorkProject($: EngineInterface): Promise<boolean> {
  const root = await $.session.root();
  return $.fs.exists(`${root}/work/README.md`).catch(() => false);
}

async function start($: EngineInterface): Promise<void> {
  await $.command.register({
    name: "work",
    description:
      "Open the Work pane and check for changes; `/work sync` brings work/ up to date; `/work check` prints the check.",
    argumentHint: "[sync | check]",
  });
  // Outside a work project: no pane, no gh, no timer (GH #33, proved `startsPane`)
  if (!startsPane(await isWorkProject($))) return;
  setup = await readSetup($);
  void $.ui.open({ id: PANE, title: TITLE, columns: 28 });
  openingRunning = true;
  opening = check($, "open").finally(() => {
    openingRunning = false;
  });
  $.clock.every(TICK_MS, () => void check($, "timer"));
}

async function command($: EngineInterface, args: string): Promise<{ text?: string }> {
  const step = commandStep(await isWorkProject($), args.trim());
  if (step === "idle") return { text: NOT_WORK };
  await $.ui.open({ id: PANE, title: TITLE, columns: 28 });
  // Wait for the session's opening check and any sync running, so a headless run never exits
  // mid-sync; reuse the opening check's reading when it was still running (one line per run)
  const openingRan = openingRunning;
  await opening?.catch(() => undefined);
  opening = undefined;
  await syncDone;
  if (step === "sync") return { text: `Work sync: ${(await sync($, "command")).detail}` };
  // `/work check` answers in one line, so it first gives a fresh `claude -p` run's connector time
  const connected = step === "check" ? await waitForConnector($) : true;
  if (commandChecks(openingRan, lastSummary.includes(NOT_LOADED))) await check($, "open");
  // Connected but its tools not callable yet ("no connected MCP tool"): look again, a few times
  const toolsPending = () => step === "check" && connected && lastSummary.includes(NOT_LOADED);
  for (let tries = 0; waitsForConnector(toolsPending(), tries); tries++) {
    await $.clock.sleep(2000);
    await check($, "open");
  }
  return step === "check" ? { text: lastSummary } : {};
}

/** Wait while the connector is still connecting (a fresh `claude -p` run): up to three 2 s waits
    (proved `waitsForConnector`). Any other problem, or connected, ends the wait. */
async function waitForConnector($: EngineInterface): Promise<boolean> {
  for (let tries = 0; ; tries++) {
    const c = await connector($);
    if (!waitsForConnector(c.server === undefined && (c.problem ?? "").includes(NOT_LOADED), tries))
      return c.server !== undefined;
    await $.clock.sleep(2000);
  }
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await start($);
    return next(e);
  });

  on("command.run", { command: "work" }, async ($, e) => command($, e.args)).catch(
    async (_$, _e, next) => ({
      text: `/work failed: ${next.error?.message ?? "unknown"}`,
    }),
  );

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e);
    const s = await read($, snapshot);
    const shown = await read($, view);
    const toggle = viewToggle($, ui, shown);
    return shown === "list" ? listView($, ui, s.list, toggle) : summaryView($, ui, s, toggle);
  });
};

/** The pane's elements, as `$.ui.resolve` gives them for the surface drawing it. */
type Ui = ReturnType<EngineInterface["ui"]["resolve"]>;
type Drawn = ReturnType<typeof viewToggle>;

/** `Summary` and `List` at the top of the pane; the one showing is marked. */
function viewToggle($: EngineInterface, ui: Ui, shown: View) {
  const { Box, Button } = ui;
  return (
    <Box flexDirection="row" columnGap={1}>
      {(["summary", "list"] as const).map((name) => (
        <Button
          key={name}
          label={name === "summary" ? "Summary" : "List"}
          plain
          variant={shown === name ? "primary" : "secondary"}
          onPress={() => void update($, view, () => name)}
        />
      ))}
    </Box>
  );
}

/** One line per item: its id opens its page, ⧉ copies the id, and the title is cut to the pane's
    width, so a wider pane shows more of it. */
function itemRows($: EngineInterface, ui: Ui, rows: ListRow[]) {
  const { Box, Text, Button, Link } = ui;
  return rows.map((row) => (
    <Box flexDirection="row" columnGap={1}>
      <Link href={row.url} label={row.ref} />
      <Button
        key={`copy:${row.ref}`}
        label="⧉"
        plain
        onPress={(press) => void $.ui.copy({ text: row.ref, surface: press.surface })}
      />
      <Text wrap="truncate">{row.title}</Text>
    </Box>
  ));
}

/** The List view (GH #47): work/list.json under Basecamp, site and repo headings, filtered by
    heading (proved `nextFilter`, `showsGroup`). */
async function listView($: EngineInterface, ui: Ui, work: WorkList | undefined, toggle: Drawn) {
  const { Box, Text, Button } = ui;
  const keys = work ? listKeys(work) : [];
  if (work === undefined || keys.length === 0)
    return (
      <Box flexDirection="column">
        {toggle}
        <Text dimColor>
          {work === undefined ? "no list yet: press Sync" : "nothing on your list"}
        </Text>
      </Box>
    );
  const current = await read($, filter);
  const basecamp = showsGroup(current, BASECAMP_KEY, keys) ? work.basecamp : [];
  const github = work.github.filter((group) => showsGroup(current, group.key, keys));
  return (
    <Box flexDirection="column">
      {toggle}
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        {["", ...keys].map((key) => (
          <Button
            key={`filter:${key}`}
            label={key === "" ? "All" : key === BASECAMP_KEY ? "Basecamp" : key}
            plain
            variant={current === key ? "primary" : "secondary"}
            onPress={() => void update($, filter, (f) => nextFilter(f, key))}
          />
        ))}
      </Box>
      {basecamp.length > 0 && <Text bold>Basecamp</Text>}
      {basecamp.map((group) => (
        <Box flexDirection="column">
          <Text dimColor> {group.key}</Text>
          {itemRows($, ui, group.rows)}
        </Box>
      ))}
      {github.map((group) => (
        <Box flexDirection="column">
          <Text bold>{group.key}</Text>
          {itemRows($, ui, group.rows)}
        </Box>
      ))}
    </Box>
  );
}

/** The Summary view: what you track, the watched repos' counts, Sync, and the check's state. */
function summaryView($: EngineInterface, ui: Ui, s: Snapshot, toggle: Drawn) {
  const { Box, Text, Button } = ui;
  const repos = Object.keys(s.issues ?? {});
  return (
    <Box flexDirection="column">
      {toggle}
      {trackedRows(s.tracked).map(([line, bold]) => (
        <Text bold={bold}>{line}</Text>
      ))}
      <Text dimColor>Open GitHub issues</Text>
      {s.checkedAt !== undefined && repos.length === 0 && <Text dimColor>no repos to watch</Text>}
      {repos.map((repo) => (
        <Text color={countColor(s.issues?.[repo])}>
          {repo}: {s.issues?.[repo] ?? "?"}
        </Text>
      ))}
      <Text> </Text>
      <Box flexDirection="row" columnGap={1}>
        <Button
          key="sync"
          label={s.syncing ? "Syncing…" : "Sync"}
          hotkey="s"
          onPress={() => void sync($, "button")}
        />
        <Text>{pendingLabel(s.pending)}</Text>
      </Box>
      {s.sync?.ok === true && <Text dimColor>synced {clockTime(s.sync.at)}</Text>}
      {s.sync?.ok === false && <Text color="yellow">{s.sync.detail}</Text>}
      {s.checkedAt !== undefined && <Text dimColor>checked {clockTime(s.checkedAt)}</Text>}
      {s.stale === true && (
        <Text color="red">stale: no ok check or sync in {s.staleMinutes} min</Text>
      )}
      {(s.setup ?? []).map((gap) => (
        <Text color="yellow">needs: {gap}</Text>
      ))}
      {(s.failed ?? []).length > 0 && (
        <Text color="yellow">check failed: {(s.failed ?? []).join(", ")}</Text>
      )}
    </Box>
  );
}
