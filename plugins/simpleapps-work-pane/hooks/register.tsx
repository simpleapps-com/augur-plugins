// Work pane: counts, change detection, and Sync for the project's work/ folder.
// This mod is the sensor and courier: it watches Basecamp and GitHub for changes and fetches changed
// Basecamp todos through the SimpleApps Basecamp connector (only a mod can reach it). Everything
// else, from importing to the chart, is `work refresh` in ../scripts. Every decision about a value
// is a proved rule in ../scripts/pane-rules.ts or work-rules.ts. Design: wiki Work-Pane.
import { atom, read, update } from "claude-code";
import type { EngineInterface, McpToolResult, Register } from "claude-code";

import {
  countColour,
  countMark,
  hasChanges,
  hasLeft,
  hasOwner,
  isDue,
  isEdited,
  isIssueIdOf,
  isProjectId,
  isRecentlyClosed,
  isTrackedIssue,
  isTrackedTodo,
  nextRetries,
  notesBriefProblem,
  outcomeOf,
  pendingOf,
  shouldRetry,
  skipsClosed,
} from "../scripts/pane-rules";
import { compareText, lower } from "../scripts/work-rules";
import type {
  Count,
  Pending,
  RefreshReport,
  Snapshot,
  Status,
  SyncResult,
  Target,
  TodoIndex,
  Tracked,
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
const RETRY_MS = 15 * 1000;

const snapshot = atom(
  { plugin: "simpleapps-work-pane", key: "snapshot" } as const,
  { syncing: false, isError: false } as Snapshot,
);

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
  return watchRepos.some((repo) =>
    isIssueIdOf(lower(id), `gh-${lower(repo.split("/").pop() ?? "")}-`),
  );
}

/** What you track, as in work/LIST.md: open Basecamp todos assigned to you, and open issues in watched repos. */
export function tracked(status: Status): Tracked {
  const open = status.items.filter((item) => item.status === "open");
  const todos = open.filter((item) =>
    isTrackedTodo(true, item.source === "basecamp", item.kind === "todo", item.mine),
  );
  const issues = open.filter((item) =>
    isTrackedIssue(
      true,
      item.source === "github",
      item.kind === "issue",
      inWatchedRepo(item.id, status.watch_repos),
    ),
  );
  return { basecamp: todos.length, github: issues.length };
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
  return [
    ...(countProblem === undefined ? [] : [`Basecamp count (${countProblem})`]),
    ...(listProblem === undefined ? [] : [`Basecamp index (${listProblem})`]),
    ...repos.filter((_, i) => counts[i] === undefined),
    ...(changed === undefined ? ["GitHub changes"] : []),
  ];
}

/** Every todo in list_my_todo_index, once each, with the project and list names get_todo lacks. */
export function indexTodos(index: TodoIndex): (Target & { updated: string })[] {
  const byId = new Map<number, Target & { updated: string }>();
  for (const list of index.lists ?? [])
    for (const todo of list.todos ?? [])
      byId.set(todo.id, {
        id: todo.id,
        updated: todo.updated_at,
        project_id: list.project_id ?? 0,
        project_name: list.project_name ?? "",
        list: list.todolist_name ?? "",
      });
  return [...byId.values()];
}

const todoNumber = (id: string) => Number(id.replace(/^bc-todo-/, ""));

const localTodos = (status: Status) =>
  status.items.filter((item) => item.source === "basecamp" && item.kind === "todo");

/**
 * Basecamp todos to fetch. Yours that are new or edited since work/ last saw them, and local ones
 * that left your list (closed or reassigned). With `linked`, also every other local todo, the ones
 * `follow` pulled in, since only a Sync re-reads those.
 */
export function todosToFetch(
  remote: (Target & { updated: string })[],
  status: Status,
  linked: boolean,
): Target[] {
  const local = new Map(localTodos(status).map((item) => [todoNumber(item.id), item]));
  const onList = new Set(remote.map((todo) => todo.id));
  const edited = remote
    .filter((todo) => {
      const before = Date.parse(local.get(todo.id)?.updated ?? "");
      const now = Date.parse(todo.updated);
      return isEdited(!Number.isNaN(before), before, !Number.isNaN(now), now);
    })
    .map(({ id, project_id, project_name, list }) => ({ id, project_id, project_name, list }));
  const left = localTodos(status)
    .filter((item) =>
      hasLeft(onList.has(todoNumber(item.id)), item.project !== null, linked, item.mine),
    )
    .map((item) => ({
      id: todoNumber(item.id),
      project_id: Number(item.project),
      project_name: "",
      list: "",
    }));
  return [...edited, ...left];
}

/** Linked todos `follow` found that aren't in work/ yet; those without a known project are skipped. */
export function linkedTargets(report: RefreshReport | undefined): Target[] {
  return (report?.basecamp ?? [])
    .filter((todo) => todo.project !== null)
    .map((todo) => ({
      id: todoNumber(todo.id),
      project_id: Number(todo.project),
      project_name: "",
      list: "",
    }));
}

/** Ids of fetched `get_todo` records that came back completed. */
export function completedIds(records: unknown[]): number[] {
  return (records as { id?: number; basecamp?: { completed?: boolean } }[])
    .filter((r) => r.basecamp?.completed === true && typeof r.id === "number")
    .map((r) => r.id as number);
}

/** Linked todos seen completed within 7 days are not fetched again; a reopen shows within a week. */
export function skipClosed(
  targets: Target[],
  closed: Record<string, number>,
  now: number,
): Target[] {
  return targets.filter((t) => {
    const at = closed[String(t.id)];
    return !skipsClosed(at !== undefined, now, at ?? 0);
  });
}

/** Add newly completed ids and drop entries older than 7 days. */
export function rememberClosed(
  closed: Record<string, number>,
  ids: number[],
  now: number,
): Record<string, number> {
  const kept = Object.entries(closed).filter(([, at]) => isRecentlyClosed(now, at));
  return Object.fromEntries([...kept, ...ids.map((id) => [String(id), now] as const)]);
}

/** Every Basecamp project a site brief covers, once each. */
export function briefProjectIds(status: Status | undefined): number[] {
  const ids = (status?.briefs ?? []).flatMap((b) => b.projects.map(Number));
  return [...new Set(ids)].filter(isProjectId);
}

/** Whether a timer tick should check: another session may have checked within the interval. */
export const isDueTick = (lastChecked: number | undefined, now: number, minutes: number) =>
  isDue(lastChecked !== undefined, lastChecked ?? 0, now, minutes);

/** The pane's words for a `work refresh` report. */
export function syncResult(report: RefreshReport | undefined, at: number): SyncResult {
  const outcome = outcomeOf(
    report !== undefined,
    report?.locked ?? false,
    (report?.failed ?? null) !== null,
  );
  if (outcome === "did-not-run") return { at, ok: false, detail: "work refresh did not run" };
  if (outcome === "locked") return { at, ok: false, detail: "another sync is running" };
  if (outcome === "failed")
    return {
      at,
      ok: false,
      detail: `failed at ${report?.failed?.step}: ${report?.failed?.detail}`,
    };
  return { at, ok: true, detail: "synced" };
}

/** A sync that could not read the briefs' Basecamp todos still synced; it says so. */
export function withBriefProblem(result: SyncResult, problem: string | undefined): SyncResult {
  if (!notesBriefProblem(result.ok, problem !== undefined)) return result;
  return {
    ...result,
    detail: `${result.detail}; briefs kept their last Basecamp read (${problem})`,
  };
}

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
let syncing = false;
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

/** The connector's name for `$.mcp.call`, or the problem connecting it. */
async function connector($: EngineInterface): Promise<{ server?: string; problem?: string }> {
  const result = await $.mcp.connect(CONNECTOR).catch((error: unknown) => ({
    isConnected: false as const,
    message: String(error),
  }));
  if (result.isConnected) return { server: result.server };
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
export async function check($: EngineInterface, trigger: "timer" | "open"): Promise<void> {
  const now = await $.clock.now();
  const status = (await cli($, ["status", "--json"], STATUS_TIMEOUT_MS)) as Status | undefined;
  if (status === undefined) {
    const failed = setup.length ? setup : ["work status"];
    lastSummary = `check failed: ${failed.join(", ")}`;
    await update($, snapshot, (s) => ({ ...s, isError: true, failed, setup }));
    return;
  }
  const lastChecked = (await $.store.get("lastCheckedAt")) as number | undefined;
  if (trigger === "timer" && !isDueTick(lastChecked, now, status.sync_minutes)) return;
  await $.store.set("lastCheckedAt", now);
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
  lastSummary = checkSummary(basecamp.count, pending, issues, [...setup, ...failed], totals);
  // The connector still connecting (session start, or just reconnected): check again soon
  const notLoaded = failed.some((part) => part.includes(NOT_LOADED));
  if (shouldRetry(notLoaded, retries)) $.clock.after(RETRY_MS, () => void check($, "open"));
  retries = nextRetries(notLoaded, retries);
  await update($, snapshot, (s) => ({
    ...s,
    count: basecamp.count ?? s.count,
    issues,
    tracked: totals,
    pending,
    checkedAt: now,
    isError: failed.length > 0 || setup.length > 0,
    failed,
    setup,
  }));
  if (status.auto_sync && hasChangesOf(pending) && !syncing) await sync($, "auto");
}

async function syncLinked(
  $: EngineInterface,
  report: RefreshReport | undefined,
  trigger: string,
  at: number,
) {
  // Completed linked todos stay referenced, so follow lists them every time; skip known ones
  const closed = ((await $.store.get("closedLinked")) ?? {}) as Record<string, number>;
  const linked = skipClosed(linkedTargets(report), closed, at);
  if (!report?.ok || !linked.length) return report;
  const pass = await importAndRefresh($, linked, `${trigger}+linked`);
  await $.store.set("closedLinked", rememberClosed(closed, pass.completed, at));
  return pass.report;
}

/** Sync: fetch what changed in Basecamp, then `work refresh`, then the linked todos it found. */
export async function sync($: EngineInterface, trigger: string): Promise<SyncResult> {
  const at = await $.clock.now();
  if (syncing) return { at, ok: false, detail: "already syncing" };
  syncing = true;
  await update($, snapshot, (s) => ({ ...s, syncing: true }));
  try {
    const status = (await cli($, ["status", "--json"], STATUS_TIMEOUT_MS)) as Status | undefined;
    // The full index, not a time window: only the full list shows todos that left (closed, reassigned)
    const index = await callTool($, "list_my_todo_index", {});
    const targets =
      status && index.value !== undefined
        ? todosToFetch(indexTodos(index.value as TodoIndex), status, true)
        : [];
    const briefs = await briefTodoArgs($, status);
    const first = await importAndRefresh($, targets, trigger, briefs.args);
    const report = await syncLinked($, first.report, trigger, at);
    const result = withBriefProblem(syncResult(report, at), briefs.problem);
    if (result.ok) await $.store.set("lastSyncAt", new Date(at).toISOString());
    else $.ui.toast(`Work sync ${result.detail}`);
    await update($, snapshot, (s) => ({ ...s, sync: result }));
    // Re-check now: work/ changed, so the Basecamp diff must be redone even if the fingerprint has not
    diffedFingerprint = undefined;
    await check($, "open");
    return result;
  } finally {
    syncing = false;
    await update($, snapshot, (s) => ({ ...s, syncing: false }));
  }
}

async function start($: EngineInterface): Promise<void> {
  setup = await readSetup($);
  await $.command.register({
    name: "work",
    description:
      "Open the Work pane and check for changes; `/work sync` brings work/ up to date; `/work check` prints the check.",
    argumentHint: "[sync | check]",
  });
  void $.ui.open({ id: PANE, title: TITLE, columns: 28 });
  void check($, "open");
  $.clock.every(TICK_MS, () => void check($, "timer"));
}

async function command($: EngineInterface, args: string): Promise<{ text?: string }> {
  await $.ui.open({ id: PANE, title: TITLE, columns: 28 });
  if (args.trim() === "sync") return { text: `Work sync: ${(await sync($, "command")).detail}` };
  await check($, "open");
  if (args.trim() !== "check") return {};
  // The connector may still be connecting (a fresh `claude -p` session): wait a moment and look again
  for (let tries = 0; tries < 3 && lastSummary.includes(NOT_LOADED); tries++) {
    await $.clock.sleep(2000);
    await check($, "open");
  }
  return { text: lastSummary };
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
    const { Box, Text, Button } = $.ui.resolve(e);
    const s = await read($, snapshot);
    const repos = Object.keys(s.issues ?? {});
    return (
      <Box flexDirection="column">
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
        {(s.setup ?? []).map((gap) => (
          <Text color="yellow">needs: {gap}</Text>
        ))}
        {(s.failed ?? []).length > 0 && (
          <Text color="yellow">check failed: {(s.failed ?? []).join(", ")}</Text>
        )}
      </Box>
    );
  });
};
