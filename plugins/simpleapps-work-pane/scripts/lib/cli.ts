// The `work` commands. The Work pane runs `refresh`, `status` and `log-check`; the others are for a person at a
// shell. Usage: wiki Work-Pane.
import { readFileSync } from "node:fs";

import { importBasecamp, readTodos } from "./basecamp.ts";
import { briefPath, readProjectTodos, writeBrief } from "./brief.ts";
import { writeChart } from "./chart.ts";
import { followGithub } from "./follow.ts";
import type { Api } from "./github.ts";
import { syncGithub } from "./github.ts";
import type { RefreshReport } from "./refresh.ts";
import { logCheck, readTodoFiles, refreshWork, todoFiles, workStatus } from "./refresh.ts";
import { writeSummary } from "./summary.ts";
import { linkWork, validateWork } from "./tree.ts";

const USAGE =
  "usage: work <refresh [--todos <file|dir>] [--project-todos <file|dir>] [--trigger <name>] [--partial] [--json] | status [--json] | log-check --trigger <name> --outcome ok|failed [--detail <text>] | brief <hub> [--todos <file>] [--summary <file>] | validate | link | sync-gh [hub] | follow [--depth N] | import-bc <file.json>... | chart [all] | summary [--today YYYY-MM-DD]> [--root <dir>]";

/** Options that take no value. */
const FLAGS = new Set(["json", "partial"]);

type Write = (line: string) => void;

interface Run {
  root: string;
  options: Record<string, string | true | undefined>;
  arg: string | undefined;
  files: string[];
  depth: number;
  today: string;
  write: Write;
  api: Api | undefined;
  now: () => number;
}

const option = (run: Run, name: string) => {
  const value = run.options[name];
  return typeof value === "string" ? value : undefined;
};

function validate({ root, write }: Run): number {
  const { count, problems } = validateWork(root);
  for (const problem of problems) write(problem);
  write(
    problems.length
      ? `${problems.length} problem(s) in ${count} file(s)`
      : `${count} file(s) valid`,
  );
  return problems.length ? 1 : 0;
}

function link({ root, write }: Run): number {
  const { items, changed, missing } = linkWork(root);
  write(`${items} item(s), ${changed} updated, graph.json written`);
  if (missing.length) write(`referenced but not synced (${missing.length}): ${missing.join(", ")}`);
  return 0;
}

function syncGh({ root, arg, write, api }: Run): number {
  const results = syncGithub(root, arg, api);
  for (const r of results)
    write(`${r.hub}/${r.repo}: ${r.items} open, ${r.written} written, ${r.removed} closed removed`);
  write(
    results.length
      ? "run `work follow` to pull linked items and update the graph"
      : "no hub lists any repos",
  );
  return 0;
}

const describeBasecamp = (todo: { id: string; project: string | null }) =>
  todo.project ? `${todo.id} (project ${todo.project})` : todo.id;

function follow({ root, depth, write, api }: Run): number {
  if (!Number.isInteger(depth) || depth < 1) {
    write(USAGE);
    return 2;
  }
  const r = followGithub(root, depth, api);
  write(
    `followed ${depth} layer(s): ${r.pulled.length} pulled, ${r.unchanged} unchanged, ${r.removed.length} removed, ${r.closed.length} closed skipped`,
  );
  const lists: [string, string[]][] = [
    ["hubs created", r.hubsCreated],
    ["basecamp to fetch via the connector", r.basecamp.map(describeBasecamp)],
    ["transferred, not followed", r.moved],
    ["other orgs, not followed", r.external],
    ["failed", r.failed],
  ];
  for (const [label, values] of lists)
    if (values.length) write(`${label} (${values.length}): ${values.join(", ")}`);
  return 0;
}

function importBc({ root, files, write }: Run): number {
  if (!files.length) {
    write(USAGE);
    return 2;
  }
  const r = importBasecamp(root, files.flatMap(readTodos));
  write(
    `basecamp: ${r.written} written, ${r.unchanged} unchanged, ${r.moved} moved between hubs, ${r.removed} closed removed`,
  );
  if (r.hubsCreated.length)
    write(`hubs created (${r.hubsCreated.length}): ${r.hubsCreated.join(", ")}`);
  write("run `work follow` to pull linked items and update the graph");
  return 0;
}

function chart({ root, arg, write }: Run): number {
  const r = writeChart(root, arg === "all");
  write(`chart: ${r.nodes} item(s), ${r.edges} link(s) → chart.md, chart.html`);
  return 0;
}

function summary({ root, today, write }: Run): number {
  const me = writeSummary(root, today);
  write(
    me.length
      ? `README.md summary written for ${me.join(", ")}`
      : "README.md summary written; set `me` in its frontmatter to see your items",
  );
  return 0;
}

function refreshLines(report: RefreshReport): string[] {
  if (report.locked) return ["another sync is running; try again shortly"];
  const lines = report.steps.map((s) => `${s.step}: ${s.detail}`);
  if (report.failed) lines.push(`FAILED at ${report.failed.step}: ${report.failed.detail}`);
  if (report.basecamp.length)
    lines.push(
      `basecamp to fetch via the connector (${report.basecamp.length}): ${report.basecamp.map(describeBasecamp).join(", ")}`,
    );
  return lines;
}

/** Raw `list_todos` records from a file or a folder of JSON files; undefined when not given. */
const projectTodosFrom = (path: string | undefined) =>
  path ? readProjectTodos(todoFiles([path])) : undefined;

function brief(run: Run): number {
  const { root, arg, today, write, api } = run;
  if (!arg) {
    write(USAGE);
    return 2;
  }
  const projectTodos = projectTodosFrom(option(run, "todos"));
  const summaryFile = option(run, "summary");
  const r = writeBrief(root, arg, {
    today,
    ...(api && { api }),
    ...(projectTodos && { projectTodos }),
    ...(summaryFile && { summary: readFileSync(summaryFile, "utf8") }),
  });
  write(`${briefPath(root, arg)}: ${r.open} open, ${r.resolved} resolved, ${r.added} new`);
  return 0;
}

function refresh(run: Run): number {
  const { root, depth, today, write, api } = run;
  const todosPath = option(run, "todos");
  const projectTodos = projectTodosFrom(option(run, "project-todos"));
  const trigger = option(run, "trigger");
  const report = refreshWork(root, {
    todos: todosPath ? readTodoFiles([todosPath]) : [],
    depth,
    today,
    ...(projectTodos && { projectTodos }),
    ...(api && { api }),
    ...(trigger && { trigger }),
    partial: run.options.partial === true,
  });
  if (run.options.json) write(JSON.stringify(report));
  else for (const line of refreshLines(report)) write(line);
  if (report.locked) return 3;
  return report.ok ? 0 : 1;
}

/** `log-check --trigger <name> --outcome ok|failed --detail <text>`: one line per check the pane ran. */
function logCheckCommand(run: Run): number {
  const trigger = option(run, "trigger");
  const outcome = option(run, "outcome");
  if (trigger === undefined || (outcome !== "ok" && outcome !== "failed")) {
    run.write(USAGE);
    return 2;
  }
  run.write(logCheck(run.root, run.now(), trigger, outcome === "ok", option(run, "detail") ?? ""));
  return 0;
}

function status({ root, options, write, now }: Run): number {
  const s = workStatus(root, now());
  if (options.json) {
    write(JSON.stringify(s));
    return 0;
  }
  const bySource = (source: string) => s.items.filter((item) => item.source === source).length;
  write(`items: ${bySource("basecamp")} basecamp, ${bySource("github")} github`);
  write(`org: ${s.org}`);
  write(`watch_repos: ${s.watch_repos.join(", ") || "none"}`);
  write(`auto_sync: ${s.auto_sync}, every ${s.sync_minutes} minute(s)`);
  write(`last sync: ${s.last_sync ?? "never"}`);
  write(`last check: ${s.last_check ?? "never"}`);
  if (s.stale)
    write(`STALE: no ok check or sync in over ${3 * s.sync_minutes} minutes (3 × sync_minutes)`);
  return 0;
}

const COMMANDS: Record<string, (run: Run) => number> = {
  refresh,
  status,
  "log-check": logCheckCommand,
  brief,
  validate,
  link,
  "sync-gh": syncGh,
  follow,
  "import-bc": importBc,
  chart,
  summary,
};

function parseArgs(args: string[]) {
  const options: Record<string, string | true | undefined> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = String(args[i]);
    if (!arg.startsWith("--")) positional.push(arg);
    else {
      const name = arg.slice(2);
      options[name] = FLAGS.has(name) ? true : args[++i];
    }
  }
  return { options, positional };
}

/** Run one command; the exit code. `today` is the person's local date, so "due today" matches their day; `now` is the clock for logs and staleness. */
export function runWork(
  args: string[],
  defaultRoot: string,
  write: Write,
  api?: Api,
  today?: string,
  now: () => number = Date.now,
): number {
  const { options, positional } = parseArgs(args);
  const command = COMMANDS[String(positional[0])];
  if (!command || Object.values(options).includes(undefined)) {
    write(USAGE);
    return 2;
  }
  const root = options.root;
  const day = options.today;
  return command({
    root: typeof root === "string" ? root : defaultRoot,
    options,
    arg: positional[1],
    files: positional.slice(1),
    depth: Number(options.depth ?? 2),
    today: typeof day === "string" ? day : (today ?? new Date().toLocaleDateString("en-CA")),
    write,
    api,
    now,
  });
}
