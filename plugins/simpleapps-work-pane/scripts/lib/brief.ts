// Living site briefs: work/briefs/brief-<hub>.md. `/site-brief` writes the summary; `work refresh`
// rewrites the facts below it from the site's open Basecamp todos and GitHub issues, and lists
// what was resolved or added since the summary was written. Design: wiki Work-Pane.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  briefCell,
  compareText,
  isQuiet,
  markersInOrder,
  projectInUrl,
  trimText,
} from "../work-rules.ts";
import { serializeYaml } from "./frontmatter.ts";
import type { Api, GitHubRecord } from "./github.ts";
import { ghApi } from "./github.ts";
import type { Doc } from "./tree.ts";
import { list, listHubs, listWorkFiles, loadWorkFile, text, workOrg } from "./tree.ts";

const FM_KEYS = ["id", "title", "type", "hub", "written", "updated"];
const SUMMARY = [
  "<!-- summary: written by /site-brief; work refresh keeps it -->",
  "<!-- /summary -->",
] as const;
const FACTS = ["<!-- facts: rewritten by work refresh; edits here are lost -->", "<!-- /facts -->"];
const NO_SUMMARY = "No summary yet. Run `/site-brief <site>` to write one.";

/** One open item in a brief. */
export interface BriefItem {
  key: string;
  source: string;
  title: string;
  url: string;
  owner: string;
  updated: string;
  due: string;
}

/** A raw `list_todos` record. */
export interface ProjectTodo {
  id: number;
  content?: string;
  title?: string;
  app_url?: string;
  assignee?: { name?: string } | null;
  updated_at?: string;
  due_on?: string | null;
  due_at?: string | null;
}

interface BriefState {
  basecamp?: { at: string; todos: BriefItem[] };
  baseline?: { at: string; items: BriefItem[] };
}

export const briefPath = (root: string, hub: string) => join(root, "briefs", `brief-${hub}.md`);
const statePath = (root: string, hub: string) => join(root, "briefs", `brief-${hub}.json`);

const day = (when: string | null | undefined) => String(when ?? "").slice(0, 10);

const listBriefs = (root: string) =>
  listWorkFiles(root)
    .map(loadWorkFile)
    .filter((doc) => doc.data.type === "brief");

const fromTodo = (todo: ProjectTodo): BriefItem => ({
  key: `bc:${todo.id}`,
  source: "Basecamp",
  title: todo.content ?? todo.title ?? "",
  // hubTodos keeps only records whose URL names a project, so it is always there
  url: String(todo.app_url),
  owner: todo.assignee?.name ?? "",
  updated: day(todo.updated_at),
  due: day(todo.due_on ?? todo.due_at),
});

const fromIssue =
  (repo: string) =>
  (issue: GitHubRecord): BriefItem => ({
    key: `gh:${repo}#${issue.number}`,
    source: issue.pull_request ? `${repo} PR` : repo,
    title: issue.title ?? "",
    url: issue.html_url ?? "",
    owner: (issue.assignees ?? []).map((a) => a.login).join(", "),
    updated: day(issue.updated_at),
    due: "",
  });

/** Raw `list_todos` records from JSON files: `{items}`, an array, or an array of `{items}`. */
export function readProjectTodos(paths: string[]): ProjectTodo[] {
  type Page = { items?: ProjectTodo[] } | ProjectTodo;
  return paths.flatMap((path) =>
    [JSON.parse(readFileSync(path, "utf8")) as Page | Page[]]
      .flat()
      .flatMap((v) => ("items" in v && v.items ? v.items : [v as ProjectTodo])),
  );
}

function readState(root: string, hub: string): BriefState {
  const file = statePath(root, hub);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as BriefState) : {};
}

/** The text between a pair of markers, or null. */
function between(body: string, markers: readonly [string, string]): string | null {
  const [open, close] = markers;
  const start = body.indexOf(open);
  const end = body.indexOf(close);
  return markersInOrder(start, end) ? trimText(body.slice(start + open.length, end)) : null;
}

const link = (item: BriefItem) => `[${briefCell(item.title)}](${item.url})`;
const bullet = (item: BriefItem) => `- ${link(item)} · ${item.source}`;

function changes(items: BriefItem[], baseline: BriefItem[]) {
  const now = new Set(items.map((i) => i.key));
  const before = new Set(baseline.map((i) => i.key));
  return {
    resolved: baseline.filter((i) => !now.has(i.key)),
    added: items.filter((i) => !before.has(i.key)),
  };
}

function sinceSection(
  items: BriefItem[],
  state: BriefState,
  written: string | undefined,
): string[] {
  if (!state.baseline) return [];
  const { resolved, added } = changes(items, state.baseline.items);
  const section = (title: string, rows: BriefItem[]) => [
    `### ${title} (${rows.length})`,
    "",
    ...rows.map(bullet),
    "",
  ];
  return [
    `## Since the last brief (${written})`,
    "",
    ...(resolved.length || added.length
      ? [...section("Resolved", resolved), ...section("New", added)]
      : ["Nothing resolved or added.", ""]),
  ];
}

function openSection(items: BriefItem[], today: string, asOf: string): string[] {
  const quiet = (i: BriefItem) =>
    isQuiet(i.updated !== "", Date.parse(today), Date.parse(i.updated));
  const rows = [...items]
    .sort((a, b) => compareText(b.updated, a.updated))
    .map((i) => {
      const notes = [i.due && `due ${i.due}`, quiet(i) && "quiet 14+ days"];
      return `| ${link(i)} | ${i.source} | ${briefCell(i.owner || "nobody")} | ${i.updated} | ${notes.filter(Boolean).join(", ")} |`;
    });
  return [
    `## Open now (${items.length})`,
    "",
    asOf,
    "",
    "| Item | Where | Owner | Last activity | Note |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ];
}

interface RenderInput {
  hub: Doc;
  written: string | undefined;
  updated: string;
  summary: string;
  items: BriefItem[];
  state: BriefState;
  today: string;
}

function render({ hub, written, updated, summary, items, state, today }: RenderInput): string {
  const data = {
    id: `brief-${text(hub.data.id)}`,
    title: `${text(hub.data.title)} brief`,
    type: "brief",
    hub: text(hub.data.id),
    written,
    updated,
  };
  const bc = state.basecamp?.at
    ? `Basecamp as of ${state.basecamp.at} UTC`
    : "Basecamp not read yet";
  const facts = [
    ...sinceSection(items, state, written),
    ...openSection(items, today, `${bc} · GitHub as of ${updated} UTC.`),
  ];
  return [
    `---\n${serializeYaml(data, FM_KEYS)}\n---`,
    "",
    `# ${data.title}`,
    "",
    SUMMARY[0],
    summary,
    SUMMARY[1],
    "",
    FACTS[0],
    ...facts,
    FACTS[1],
    "",
  ].join("\n");
}

function findHub(root: string, hubId: string): Doc {
  const hub = listHubs(root).find((h) => h.data.id === hubId);
  if (!hub) throw new Error(`no hub "${hubId}" in work/hubs/`);
  mkdirSync(join(root, "briefs"), { recursive: true });
  return hub;
}

/** A new summary is dated today; otherwise the old one and its date are kept. */
function summaryParts(old: Doc | null, summary: string | undefined, today: string) {
  const fresh = trimText(summary ?? "");
  if (fresh) return { written: today, summary: fresh };
  const kept = old && between(old.body, SUMMARY);
  return { written: text(old?.data.written) || undefined, summary: kept || NO_SUMMARY };
}

/** The hub's open todos among `list_todos` records from any project. */
function hubTodos(hub: Doc, records: ProjectTodo[]): BriefItem[] {
  const projects = new Set(list(hub.data.basecamp_projects));
  return records.filter((t) => projects.has(projectInUrl(String(t.app_url ?? "")))).map(fromTodo);
}

/** Open issues and PRs in every repo the hub syncs or follows. */
function hubIssues(hub: Doc, api: Api, org: string): BriefItem[] {
  const repos = new Set([...list(hub.data.repos), ...list(hub.data.followed_repos)]);
  return [...repos].flatMap((repo) =>
    api(`repos/${org}/${repo}/issues?state=open&per_page=100`).map(fromIssue(repo)),
  );
}

/** How a brief is written: today's date, when (ISO), the GitHub reader, Basecamp records, a new summary. */
export interface BriefOptions {
  today: string;
  now?: string;
  api?: Api;
  projectTodos?: ProjectTodo[];
  summary?: string;
}

/**
 * Bring one hub's brief up to date. GitHub is read live; Basecamp from `projectTodos` when given,
 * else from what the last run saved. A `summary` replaces the summary and makes the current open
 * items the baseline that "Since the last brief" compares against.
 */
export function writeBrief(root: string, hubId: string, options: BriefOptions) {
  const { today, now = new Date().toISOString(), api = ghApi } = options;
  const hub = findHub(root, hubId);
  const file = briefPath(root, hubId);
  const old = existsSync(file) ? loadWorkFile(file) : null;
  const state = readState(root, hubId);
  const stamp = now.slice(0, 16).replace("T", " ");
  if (options.projectTodos)
    state.basecamp = { at: stamp, todos: hubTodos(hub, options.projectTodos) };
  const items = [...(state.basecamp?.todos ?? []), ...hubIssues(hub, api, workOrg(root))];
  if (options.summary !== undefined) state.baseline = { at: stamp, items };
  const parts = summaryParts(old, options.summary, today);
  writeFileSync(file, render({ hub, ...parts, updated: stamp, items, state, today }));
  writeFileSync(statePath(root, hubId), `${JSON.stringify(state, null, 2)}\n`);
  const since = changes(items, state.baseline?.items ?? items);
  return {
    hub: hubId,
    open: items.length,
    resolved: since.resolved.length,
    added: since.added.length,
  };
}

/** Every existing brief, for `work refresh`. Briefs whose hub is gone are skipped and named. */
export function refreshBriefs(root: string, options: BriefOptions) {
  const hubs = new Set(listHubs(root).map((h) => text(h.data.id)));
  const briefs = listBriefs(root).map((doc) => text(doc.data.hub));
  return {
    updated: briefs.filter((hub) => hubs.has(hub)).map((hub) => writeBrief(root, hub, options)),
    orphaned: briefs.filter((hub) => !hubs.has(hub)),
  };
}

/** The Basecamp projects of every brief's hub, so the Work pane knows which todos to fetch. */
export function briefProjects(root: string) {
  const hubs = new Map(listHubs(root).map((h) => [text(h.data.id), h]));
  return listBriefs(root).flatMap((doc) => {
    const hub = hubs.get(text(doc.data.hub));
    return hub ? [{ hub: text(hub.data.id), projects: list(hub.data.basecamp_projects) }] : [];
  });
}
