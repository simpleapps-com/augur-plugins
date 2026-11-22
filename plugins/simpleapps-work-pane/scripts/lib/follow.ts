// Follow references outward from each hub's own items, pulling open GitHub issues N layers deep
// and listing Basecamp todos to fetch. Rules: wiki Work-Pane.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  followKind,
  isHubFor,
  isPruned,
  isRootItem,
  lower,
  movedAway,
  parseGithubId,
  todoProject,
} from "../work-rules.ts";
import { serializeYaml } from "./frontmatter.ts";
import type { Api, GitHubRecord } from "./github.ts";
import { ghApi, issueItem, writeIfChanged } from "./github.ts";
import type { Doc, Edge } from "./tree.ts";
import {
  itemEdges,
  linkWork,
  list,
  listHubs,
  listWorkFiles,
  loadWorkFile,
  text,
  workOrg,
} from "./tree.ts";

/** The repo of a GitHub item id, or "" when it is not one. */
export const repoOf = (id: string, org: string): string => parseGithubId(id, org).repo;

interface State {
  root: string;
  org: string;
  hubs: Doc[];
  items: Map<string, Doc>;
  owned: Set<string>;
  projects: Map<string, string>;
}

/** Each Basecamp id's project, from the first link to it anywhere in work/. */
function linkedProjects(items: Map<string, Doc>, org: string): Map<string, string> {
  const projects = new Map<string, string>();
  for (const item of items.values())
    for (const edge of itemEdges(item, org))
      if (edge.project && !projects.has(edge.to)) projects.set(edge.to, edge.project);
  return projects;
}

function loadState(root: string): State {
  const org = workOrg(root);
  const hubs = listHubs(root);
  const items = new Map(
    listWorkFiles(root)
      .map(loadWorkFile)
      .filter((doc) => doc.data.type === "item")
      .map((doc) => [text(doc.data.id), doc]),
  );
  const owned = new Set(hubs.flatMap((hub) => list(hub.data.repos)).map(lower));
  return { root, org, hubs, items, owned, projects: linkedProjects(items, org) };
}

/** Basecamp items and items of repos a hub syncs in full; everything else is followed. */
const isRoot = (item: Doc, state: State) =>
  isRootItem(
    item.data.source === "basecamp",
    state.owned.has(repoOf(text(item.data.id), state.org)),
  );

/** What following found. */
export interface FollowReport {
  pulled: string[];
  unchanged: number;
  removed: string[];
  closed: string[];
  moved: string[];
  external: string[];
  failed: string[];
  basecamp: { id: string; project: string | null }[];
  hubsCreated: string[];
}

function ensureHub(state: State, repo: string, report: FollowReport): Doc {
  const found = state.hubs.find((hub) =>
    isHubFor(text(hub.data.id), list(hub.data.followed_repos), repo),
  );
  if (found) return found;
  const data = {
    id: repo,
    title: repo,
    type: "project",
    status: "active",
    summary: `Auto-created by work follow for ${state.org}/${repo}. Set type, sites and basecamp_projects`,
    followed_repos: [repo],
  };
  const file = join(state.root, "hubs", repo, "README.md");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `---\n${serializeYaml(data, Object.keys(data))}\n---\n\n# ${repo}\n`);
  const hub = loadWorkFile(file);
  state.hubs.push(hub);
  report.hubsCreated.push(repo);
  return hub;
}

function dropItem(state: State, id: string, report: FollowReport): void {
  const existing = state.items.get(id);
  if (!existing) return;
  rmSync(existing.file);
  state.items.delete(id);
  report.removed.push(id);
}

function fetchIssue(api: Api, path: string): GitHubRecord | null {
  try {
    return api(path)[0] ?? null;
  } catch {
    return null;
  }
}

/** A followed issue that is not pulled, noted in the report: unread, moved away, or closed. */
function skipReason(
  state: State,
  id: string,
  repo: string,
  issue: GitHubRecord | null,
  report: FollowReport,
): boolean {
  if (!issue) {
    report.failed.push(id);
    return true;
  }
  if (movedAway(String(issue.html_url ?? ""), state.org, repo)) {
    report.moved.push(`${id} -> ${issue.html_url}`);
    dropItem(state, id, report);
    return true;
  }
  if (issue.state !== "open") {
    report.closed.push(id);
    dropItem(state, id, report);
    return true;
  }
  return false;
}

function pullFollowed(
  state: State,
  id: string,
  repo: string,
  number: number,
  api: Api,
  report: FollowReport,
): boolean {
  const path = `repos/${state.org}/${repo}/issues/${number}`;
  const issue = fetchIssue(api, path);
  if (skipReason(state, id, repo, issue, report) || !issue) return false;
  const hub = ensureHub(state, repo, report);
  const comments = issue.comments ? api(`${path}/comments?per_page=100`) : [];
  const { data, body } = issueItem(issue, comments, repo, text(hub.data.id), state.org);
  const file = join(dirname(hub.file), "items", `${id}.md`);
  mkdirSync(dirname(file), { recursive: true });
  if (writeIfChanged(file, data, body)) report.pulled.push(id);
  else report.unchanged++;
  state.items.set(id, loadWorkFile(file));
  return true;
}

/** A bare `BC<n>` has no project: a link elsewhere names it, or the item's hub's only project. */
function basecampProject(state: State, edge: Edge): string | null {
  const hubId = state.items.get(edge.from)?.data.hub;
  const listed = list(state.hubs.find((hub) => hub.data.id === hubId)?.data.basecamp_projects);
  const project = todoProject(edge.project ?? "", state.projects.get(edge.to) ?? "", listed);
  return project === "" ? null : project;
}

/** Visit one referenced id; true when it is an open item whose own references are worth following. */
function visit(state: State, edge: Edge, api: Api, report: FollowReport): boolean {
  // The repo and number are "" when the id is not a GitHub one; followKind then says so
  const ref = parseGithubId(edge.to, state.org);
  const kind = followKind(edge.to, state.org, state.owned.has(ref.repo));
  if (kind === "basecamp") {
    if (!state.items.has(edge.to))
      report.basecamp.push({ id: edge.to, project: basecampProject(state, edge) });
    return state.items.has(edge.to);
  }
  if (kind === "external") {
    report.external.push(edge.to);
    return false;
  }
  if (kind === "owned") return state.items.has(edge.to);
  return pullFollowed(state, edge.to, ref.repo, Number(ref.digits), api, report);
}

function prune(state: State, visited: Set<string>, report: FollowReport): void {
  for (const [id, item] of [...state.items])
    if (isPruned(item.data.source === "github", isRoot(item, state), visited.has(id)))
      dropItem(state, id, report);
}

export function followGithub(root: string, depth = 2, api: Api = ghApi): FollowReport {
  const state = loadState(root);
  const report: FollowReport = {
    pulled: [],
    unchanged: 0,
    removed: [],
    closed: [],
    moved: [],
    external: [],
    failed: [],
    basecamp: [],
    hubsCreated: [],
  };
  let frontier = [...state.items.values()]
    .filter((item) => isRoot(item, state))
    .map((item) => text(item.data.id));
  const visited = new Set(frontier);
  for (let layer = 0; layer < depth && frontier.length; layer++) {
    const next: string[] = [];
    const items = frontier.map((id) => state.items.get(id)).filter((item) => item !== undefined);
    for (const edge of items.flatMap((item) => itemEdges(item, state.org))) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      if (visit(state, edge, api, report)) next.push(edge.to);
    }
    frontier = next;
  }
  prune(state, visited, report);
  linkWork(root);
  return report;
}
