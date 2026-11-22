// One command that brings work/ up to date, a lock every caller shares, a sync log, and the status
// the Work pane reads. Design: wiki Work-Pane.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import {
  autoSyncOf,
  isAutoHub,
  isEmptyHub,
  isLockStale,
  isVisibleName,
  orgOf,
  projectOfRef,
  syncMinutesOf,
} from "../work-rules.ts";
import type { Todo } from "./basecamp.ts";
import { importBasecamp, readTodos } from "./basecamp.ts";
import type { ProjectTodo } from "./brief.ts";
import { briefProjects, refreshBriefs } from "./brief.ts";
import { writeChart } from "./chart.ts";
import { followGithub } from "./follow.ts";
import type { Api } from "./github.ts";
import { syncGithub } from "./github.ts";
import { writeSummary } from "./summary.ts";
import {
  list,
  listHubs,
  listWorkFiles,
  loadWorkFile,
  readIndex,
  text,
  validateWork,
} from "./tree.ts";

const LOCK = ".lock";
const LOG = "sync.log";
const LOG_LINES = 200;

/** Take work/.lock (mkdir is atomic), or report that another run holds it; a stale lock is taken over. */
export function takeLock(root: string, now: number): boolean {
  const dir = join(root, LOCK);
  try {
    mkdirSync(dir);
    return true;
  } catch {
    if (!isLockStale(now, statSync(dir).mtimeMs)) return false;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
    return true;
  }
}

const releaseLock = (root: string) => rmSync(join(root, LOCK), { recursive: true, force: true });

function readLog(root: string): string[] {
  const file = join(root, LOG);
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
}

function appendLog(root: string, line: string): void {
  const lines = [...readLog(root), line].slice(-LOG_LINES);
  writeFileSync(join(root, LOG), `${lines.join("\n")}\n`);
}

const lastLogLine = (root: string): string | null => readLog(root).at(-1) ?? null;

/** The person's settings from work/README.md frontmatter, with defaults. */
function readSettings(root: string) {
  const data = readIndex(root);
  const hubRepos = listHubs(root).flatMap((hub) => list(hub.data.repos));
  const minutes = text(data.sync_minutes);
  return {
    org: orgOf(text(data.org)),
    me: list(data.me),
    // No list of their own: count the repos their hubs already sync, each once, in the order listed
    watch_repos: [
      ...new Set(data.watch_repos === undefined ? hubRepos.sort() : list(data.watch_repos)),
    ],
    // On unless turned off: the pane keeps work/ current without anyone pressing Sync
    auto_sync: autoSyncOf(text(data.auto_sync)),
    sync_minutes: syncMinutesOf(minutes !== "", Number(minutes)),
  };
}

/** Settings, the last sync, and every item's id and updated time: what the Work pane compares against. */
export function workStatus(root: string) {
  const settings = readSettings(root);
  const me = new Set(settings.me);
  const items = listWorkFiles(root)
    .map(loadWorkFile)
    .filter((doc) => doc.data.type === "item")
    .map(({ data }) => {
      const project = projectOfRef(text(data.ref));
      return {
        id: text(data.id),
        source: text(data.source),
        kind: text(data.kind),
        hub: text(data.hub),
        status: text(data.status),
        updated: text(data.updated),
        project: project === "" ? null : project,
        mine: list(data.assignees).some((name) => me.has(name)),
      };
    });
  return { ...settings, last_sync: lastLogLine(root), items, briefs: briefProjects(root) };
}

const visible = (dir: string) => readdirSync(dir).filter(isVisibleName);

/** Remove auto-created hubs, still unedited, that hold nothing but README.md and an empty items/. */
function tidyHubs(root: string): string[] {
  const removed: string[] = [];
  for (const hub of listHubs(root)) {
    if (!isAutoHub(text(hub.data.summary))) continue;
    const dir = dirname(hub.file);
    const items = join(dir, "items");
    const others = visible(dir).filter((name) => name !== "README.md");
    if (!isEmptyHub(others, existsSync(items) ? visible(items).length : 0)) continue;
    rmSync(dir, { recursive: true, force: true });
    removed.push(text(hub.data.id));
  }
  return removed;
}

interface StepContext {
  root: string;
  todos: Todo[];
  projectTodos: ProjectTodo[] | undefined;
  depth: number;
  today: string;
  api: Api | undefined;
}

interface StepResult {
  step: string;
  detail: string;
}

/** What `work refresh` did: each step's line, the failure if any, and the linked todos to fetch. */
export interface RefreshReport {
  ok: boolean;
  locked: boolean;
  steps: StepResult[];
  basecamp: { id: string; project: string | null }[];
  failed: StepResult | null;
}

const total = (results: { written: number; removed: number }[], key: "written" | "removed") =>
  results.reduce((sum, r) => sum + r[key], 0);

/** Each step returns one line for the log, or throws to stop the run. */
const STEPS: Record<string, (context: StepContext, report: RefreshReport) => string> = {
  "import-bc": ({ root, todos }) => {
    if (!todos.length) return "nothing to import";
    const r = importBasecamp(root, todos);
    return `${r.written} written, ${r.removed} closed removed`;
  },
  "sync-gh": ({ root, api }) => {
    const results = syncGithub(root, undefined, api);
    return `${total(results, "written")} written, ${total(results, "removed")} closed removed`;
  },
  follow: ({ root, depth, api }, report) => {
    const r = followGithub(root, depth, api);
    report.basecamp = r.basecamp;
    return `${r.pulled.length} pulled, ${r.removed.length} removed, ${r.basecamp.length} basecamp to fetch`;
  },
  tidy: ({ root }) => {
    const removed = tidyHubs(root);
    return removed.length
      ? `${removed.length} empty hub(s) removed: ${removed.join(", ")}`
      : "nothing to remove";
  },
  brief: ({ root, today, api, projectTodos }) => {
    const { updated, orphaned } = refreshBriefs(root, {
      today,
      ...(api && { api }),
      ...(projectTodos && { projectTodos }),
    });
    const changed = updated.map((b) => `${b.hub} (${b.resolved} resolved, ${b.added} new)`);
    const gone = orphaned.length ? `; no hub for ${orphaned.join(", ")}` : "";
    return `${updated.length ? changed.join(", ") : "no briefs"}${gone}`;
  },
  summary: ({ root, today }) => {
    writeSummary(root, today);
    return "README.md written";
  },
  chart: ({ root }) => `${writeChart(root, false).nodes} item(s) drawn`,
  validate: ({ root }) => {
    const { problems } = validateWork(root);
    if (problems.length) throw new Error(`${problems.length} problem(s): ${problems[0]}`);
    return "valid";
  },
};

function runSteps(context: StepContext, report: RefreshReport): void {
  for (const [step, run] of Object.entries(STEPS)) {
    try {
      report.steps.push({ step, detail: run(context, report) });
    } catch (error) {
      report.failed = { step, detail: error instanceof Error ? error.message : String(error) };
      return;
    }
  }
}

function logLine(
  report: RefreshReport,
  trigger: string,
  started: number,
  finished: number,
): string {
  const when = new Date(started).toISOString().replace(/\.\d+Z$/, "Z");
  const seconds = Math.round((finished - started) / 1000);
  const outcome = report.failed
    ? `FAILED at ${report.failed.step}: ${report.failed.detail}`
    : report.steps.map((s) => `${s.step}: ${s.detail}`).join(" · ");
  return `${when} ${trigger} ${report.failed ? "failed" : "ok"} ${seconds}s · ${outcome}`;
}

/** The index a fresh install starts with; the person adds `me` and the rest later. */
const STARTER_INDEX = [
  "---",
  "id: work",
  "title: Work",
  "type: index",
  "summary: My work.",
  "---",
  "",
  "# Work",
  "",
].join("\n");

/** A fresh install has no work/ or work/README.md: create both so the first sync can run. */
function ensureIndex(root: string): boolean {
  mkdirSync(root, { recursive: true });
  const file = join(root, "README.md");
  if (existsSync(file)) return false;
  writeFileSync(file, STARTER_INDEX);
  return true;
}

/** How a refresh runs: Basecamp todos to import, the briefs' project todos, follow depth, today, the GitHub reader, who asked, and the clock. */
export interface RefreshOptions {
  todos?: Todo[];
  projectTodos?: ProjectTodo[];
  depth?: number;
  today: string;
  api?: Api;
  trigger?: string;
  now?: () => number;
}

/**
 * Bring work/ up to date: import the given Basecamp todos, then sync-gh, follow, tidy, brief,
 * summary, chart, validate. Stops at the first failing step; one run at a time; one log line per run.
 */
export function refreshWork(root: string, options: RefreshOptions): RefreshReport {
  const {
    todos = [],
    projectTodos,
    depth = 2,
    today,
    api,
    trigger = "manual",
    now = Date.now,
  } = options;
  const started = now();
  const report: RefreshReport = { ok: false, locked: false, steps: [], basecamp: [], failed: null };
  ensureIndex(root);
  // A typo in work/README.md stops the run before anything is rewritten
  const problems = loadWorkFile(join(root, "README.md")).errors.map((m) => `work/README.md: ${m}`);
  if (problems.length) {
    report.failed = { step: "index", detail: problems.join("; ") };
    appendLog(root, logLine(report, trigger, started, started));
    return report;
  }
  if (!takeLock(root, started)) {
    report.locked = true;
    return report;
  }
  try {
    runSteps({ root, todos, projectTodos, depth, today, api }, report);
  } finally {
    releaseLock(root);
  }
  report.ok = report.failed === null;
  appendLog(root, logLine(report, trigger, started, now()));
  return report;
}

/** JSON files named on the command line; a directory means every .json file in it. */
export function todoFiles(paths: string[]): string[] {
  return paths.flatMap((path) =>
    statSync(path).isDirectory()
      ? readdirSync(path)
          .filter((name) => name.endsWith(".json"))
          .sort()
          .map((name) => join(path, name))
      : [path],
  );
}

export const readTodoFiles = (paths: string[]): Todo[] => todoFiles(paths).flatMap(readTodos);
