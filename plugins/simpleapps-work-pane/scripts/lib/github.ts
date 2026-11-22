// Sync open GitHub issues and PRs for each hub's repos into work/ items through the gh CLI.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { githubId, isClosedItem, orUnknown, issueKind, statusOf } from "../work-rules.ts";
import { list, listHubs, loadWorkFile, renderItem, text, workOrg } from "./tree.ts";

/** A GitHub API reader: every page of a path, flattened. Tests pass their own. */
export type Api = (path: string) => GitHubRecord[];

/** The fields of a GitHub issue, PR or comment the scripts read. */
export interface GitHubRecord {
  number?: number;
  title?: string;
  body?: string | null;
  state?: string;
  html_url?: string;
  pull_request?: unknown;
  user?: { login?: string } | null;
  assignees?: { login: string }[];
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  comments?: number;
}

/** Every page of a GitHub API list, through `gh api --paginate --slurp`. */
export const ghApi: Api = (path) => {
  const out = execFileSync("gh", ["api", "--paginate", "--slurp", path], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return (JSON.parse(out) as GitHubRecord[][]).flat();
};

const login = (record: GitHubRecord) => orUnknown(record.user?.login ?? "");

export function issueItem(
  issue: GitHubRecord,
  comments: GitHubRecord[],
  repo: string,
  hub: string,
  org: string,
) {
  const number = String(issue.number);
  const data = {
    id: githubId(org, repo, number, org),
    title: issue.title,
    type: "item",
    source: "github",
    kind: issueKind(issue.pull_request !== undefined && issue.pull_request !== null),
    ref: `${org}/${repo}#${number}`,
    url: issue.html_url,
    hub,
    status: statusOf(issue.state === "closed"),
    author: login(issue),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login),
    created: issue.created_at,
    updated: issue.updated_at,
    closed: issue.closed_at ?? undefined,
  };
  const thread = comments.map(
    (comment) => `### ${login(comment)} · ${comment.created_at}\n\n${comment.body ?? ""}`,
  );
  const discussion = thread.length ? `\n## Comments\n\n${thread.join("\n\n")}\n` : "";
  return { data, body: `\n# ${issue.title}\n\n${issue.body ?? ""}\n${discussion}` };
}

/** Write only when the content changed; keep the `related` the link step computed. */
export function writeIfChanged(file: string, data: Record<string, unknown>, body: string): boolean {
  const old = existsSync(file) ? loadWorkFile(file) : null;
  const rendered = renderItem({ ...data, related: list(old?.data.related) }, body);
  if (old?.text === rendered) return false;
  writeFileSync(file, rendered);
  return true;
}

/** Remove this repo's items that are no longer open: work/ mirrors open work only. */
function pruneClosed(itemsDir: string, prefix: string, openIds: Set<string>): number {
  const stale = readdirSync(itemsDir).filter((name) => {
    const id = name.replace(/\.md$/, "");
    return isClosedItem(id, prefix, openIds.has(id));
  });
  for (const name of stale) rmSync(join(itemsDir, name));
  return stale.length;
}

function syncRepo(itemsDir: string, hub: string, repo: string, api: Api, org: string) {
  const issues = api(`repos/${org}/${repo}/issues?state=open&per_page=100`);
  mkdirSync(itemsDir, { recursive: true });
  let written = 0;
  for (const issue of issues) {
    const comments = issue.comments
      ? api(`repos/${org}/${repo}/issues/${issue.number}/comments?per_page=100`)
      : [];
    const { data, body } = issueItem(issue, comments, repo, hub, org);
    if (writeIfChanged(join(itemsDir, `${data.id}.md`), data, body)) written++;
  }
  const open = new Set(issues.map((issue) => githubId(org, repo, String(issue.number), org)));
  const removed = pruneClosed(itemsDir, githubId(org, repo, "", org), open);
  return { hub, repo, items: issues.length, written, removed };
}

/** Sync every repo of every hub, or of one hub. */
export function syncGithub(root: string, onlyHub: string | undefined, api: Api = ghApi) {
  const org = workOrg(root);
  return listHubs(root)
    .filter((hub) => !onlyHub || hub.data.id === onlyHub)
    .flatMap((hub) =>
      list(hub.data.repos).map((repo) =>
        syncRepo(join(dirname(hub.file), "items"), text(hub.data.id), repo, api, org),
      ),
    );
}
