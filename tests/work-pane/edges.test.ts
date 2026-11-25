// The work scripts' edge paths, module by module: optional fields left out, invalid files, moved
// and closed items, stale locks, long sections, and the real `gh` call (a fake `gh` on the PATH).
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import { importBasecamp } from "../../plugins/simpleapps-work-pane/scripts/lib/basecamp.ts";
import {
  briefProjects,
  readProjectTodos,
  writeBrief,
} from "../../plugins/simpleapps-work-pane/scripts/lib/brief.ts";
import { toMermaid } from "../../plugins/simpleapps-work-pane/scripts/lib/chart.ts";
import { runWork } from "../../plugins/simpleapps-work-pane/scripts/lib/cli.ts";
import { followGithub } from "../../plugins/simpleapps-work-pane/scripts/lib/follow.ts";
import {
  splitFrontmatter,
  validateFields,
  readYaml,
} from "../../plugins/simpleapps-work-pane/scripts/lib/frontmatter.ts";
import type { Api, GitHubRecord } from "../../plugins/simpleapps-work-pane/scripts/lib/github.ts";
import { ghApi, syncGithub } from "../../plugins/simpleapps-work-pane/scripts/lib/github.ts";
import {
  refreshWork,
  takeLock,
  workStatus,
} from "../../plugins/simpleapps-work-pane/scripts/lib/refresh.ts";
import {
  buildSummary,
  writeSummary,
} from "../../plugins/simpleapps-work-pane/scripts/lib/summary.ts";
import {
  itemEdges,
  linkWork,
  listWorkFiles,
  loadWorkFile,
  readIndex,
  validateWork,
} from "../../plugins/simpleapps-work-pane/scripts/lib/tree.ts";

const ORG = "simpleapps-com";
const TODAY = "2026-11-22";
const folders: string[] = [];

after(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = join(mkdtempSync(join(tmpdir(), "work-edges-")), "work");
  folders.push(dirname(root));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

const fm = (lines: string[], body = "") => `---\n${lines.join("\n")}\n---\n${body}`;
const INDEX = fm(["id: work", "title: Work", "type: index", "summary: x", "me: [Ann]"]);
const hub = (id: string, extra: string[] = []) =>
  fm([`id: ${id}`, `title: ${id}`, "type: client", "status: active", "summary: s", ...extra]);
const item = (id: string, hubId: string, extra: string[] = [], body = "") =>
  fm(
    [
      `id: ${id}`,
      `title: ${id}`,
      "type: item",
      "source: basecamp",
      "kind: todo",
      `ref: basecamp:22/todos/${id}`,
      "url: https://x",
      `hub: ${hubId}`,
      "status: open",
      "author: Cy",
      "created: 2026-01-01",
      "updated: 2026-01-01",
      ...extra,
    ],
    body,
  );

const noApi: Api = () => [];

test("frontmatter: unclosed, bad lines, list and scalar mismatches", () => {
  assert.equal(splitFrontmatter("---\nid: x\n"), null);
  assert.deepEqual(readYaml(["Bad line"]).errors, [
    'frontmatter line 2: unsupported syntax "Bad line"',
  ]);
  assert.deepEqual(readYaml(["id: a", "id: b"]).errors, ['frontmatter: duplicate key "id"']);
  const schema = { tags: { list: true }, name: { required: true }, kind: { enum: ["a"] } };
  assert.deepEqual(validateFields({ tags: "x", name: ["y"], kind: "b" }, schema), [
    '"tags" must be a list',
    '"name" must be a non-empty string',
    '"kind" must be one of: a',
  ]);
  assert.deepEqual(validateFields({ extra: "x" }, {}), ['unknown key "extra"']);
  assert.deepEqual(
    validateFields({ ids: ["ok", "Not ok"] }, { ids: { list: true, format: "id" } }),
    ['"ids" item "Not ok" has invalid format'],
  );
  assert.deepEqual(validateFields({ tags: ["x", "x"] }, schema), [
    '"tags" lists "x" twice',
    'missing required key "name"',
  ]);
});

test("tree: invalid files, places, shared projects, duplicates, and edges without an author", () => {
  const root = tree({
    "README.md": INDEX,
    "hubs/a/README.md": hub("a", ["basecamp_projects: [22]"]),
    "hubs/b/README.md": hub("b", ["basecamp_projects: [22]"]),
    "hubs/a/items/one.md": item("one", "a", ["closed: 2026-02-01"]),
    "hubs/a/two.md": item("two", "a"),
    "hubs/a/items/three.md": item("three", "nohub"),
    "hubs/b/items/one.md": item("one", "b"),
    "hubs/b/items/wrong.md": item("right", "b"),
    "odd.md": fm(["id: odd", "type: weird"]),
    "hubs/a/items/bare.md": fm(
      ["id: bare", "type: item", "source: basecamp", "hub: a"],
      "\nsee BC1234567\n",
    ),
  });
  const problems = validateWork(root).problems.join("\n");
  assert.match(problems, /also listed by hub "a"/);
  assert.match(problems, /item MUST live in hubs\/a\/items\//);
  assert.match(problems, /"hub" "nohub" does not exist/);
  assert.match(problems, /duplicate id "one"/);
  assert.match(problems, /"id" must be "wrong"/);
  assert.match(problems, /"type" must be one of/);
  const bare = loadWorkFile(join(root, "hubs/a/items/bare.md"));
  assert.deepEqual(
    itemEdges(bare, ORG).map((e) => [e.to, e.author, e.at]),
    [["bc-todo-1234567", null, null]],
  );
  const { graph } = linkWork(root, false);
  assert.ok(!existsSync(join(root, "graph.json")));
  assert.ok(graph.nodes.some((n) => n.closed === "2026-02-01"));
  assert.deepEqual(listWorkFiles(join(root, "missing")), []);
  assert.deepEqual(readIndex(join(root, "missing")), {});
  const plain = tree({ "README.md": "# no frontmatter\n" });
  assert.deepEqual(readIndex(plain), {});
});

test("github: the real gh call, comments, one hub, and closed issues pruned", () => {
  const bin = mkdtempSync(join(tmpdir(), "gh-"));
  folders.push(bin);
  writeFileSync(join(bin, "gh"), '#!/bin/sh\necho \'[[{"number":1}],[{"number":2}]]\'\n');
  chmodSync(join(bin, "gh"), 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path}`;
  try {
    assert.deepEqual(ghApi("repos/x"), [{ number: 1 }, { number: 2 }]);
  } finally {
    process.env.PATH = path;
  }
  const root = tree({
    "README.md": INDEX,
    "hubs/a/README.md": hub("a", ["repos: [site]"]),
    "hubs/b/README.md": hub("b", ["repos: [other]"]),
    "hubs/a/items/gh-site-9.md": "stale",
    "hubs/a/items/gh-site-x.md": "not an issue file",
  });
  const api: Api = (p) =>
    p.includes("/site/issues?") ? [{ number: 1, title: "t", state: "open" } as GitHubRecord] : [];
  const results = syncGithub(root, "a", api);
  assert.deepEqual(
    results.map((r) => [r.hub, r.items, r.written, r.removed]),
    [["a", 1, 1, 1]],
  );
  assert.ok(existsSync(join(root, "hubs/a/items/gh-site-x.md")));
  assert.equal(syncGithub(root, "a", api)[0]?.written, 0);
});

test("basecamp: plain todos, moved todos, named hubs, closed todos, re-imports", () => {
  const root = tree({
    "README.md": INDEX,
    "hubs/site/README.md": hub("site", ["basecamp_projects: [22]"]),
    "hubs/named/README.md": hub("named"),
    "hubs/other/README.md": hub("other", ["basecamp_projects: [44]"]),
  });
  const plain = { id: 1, project_id: 22, title: "Plain", url: "https://x", created: "2026-01-01" };
  assert.equal(importBasecamp(root, [plain]).written, 1);
  assert.equal(importBasecamp(root, [plain]).unchanged, 1);
  const withEverything = {
    ...plain,
    author: "Cy",
    assignees: ["Ann"],
    due: "2026-02-01",
    list: "L",
    description: "D",
    comments: [
      { author: "Cy", at: "2026-01-02" },
      { author: "Bo", at: "2026-01-03", body: "b" },
    ],
  };
  assert.equal(importBasecamp(root, [withEverything]).written, 1);
  assert.match(
    readFileSync(join(root, "hubs/site/items/bc-todo-1.md"), "utf8"),
    /updated: 2026-01-03/,
  );
  // The project moves to another hub's list: the todo moves with it
  const moved = importBasecamp(root, [{ ...plain, project_id: 44 }]);
  assert.equal(moved.moved, 1);
  // No hub lists project 55; the slug of its name is a hub that exists
  const named = importBasecamp(root, [
    { id: 2, project_id: 55, project_name: "Named", title: "N", url: "u", created: "2026-01-01" },
  ]);
  assert.deepEqual(named.hubsCreated, []);
  // An unnamed project gets a hub named after its number
  const unnamed = importBasecamp(root, [
    { id: 3, project_id: 66, project_name: "", title: "U", url: "u", created: "2026-01-01" },
  ]);
  assert.deepEqual(unnamed.hubsCreated, ["basecamp-66"]);
  assert.match(
    readFileSync(join(root, "hubs/basecamp-66/README.md"), "utf8"),
    /title: Basecamp project 66/,
  );
  const noName = importBasecamp(root, [
    { id: 4, project_id: 77, title: "V", url: "u", created: "2026-01-01" },
  ]);
  assert.deepEqual(noName.hubsCreated, ["basecamp-77"]);
  assert.equal(importBasecamp(root, [{ ...plain, project_id: 44, status: "closed" }]).removed, 1);
});

test("follow: closed, moved, unread, owned, projectless and pruned references", () => {
  const issueOf = (n: number, extra: GitHubRecord = {}): GitHubRecord => ({
    number: n,
    title: `T${n}`,
    state: "open",
    html_url: `https://github.com/${ORG}/tool/issues/${n}`,
    ...extra,
  });
  const root = tree({
    "README.md": INDEX,
    "hubs/site/README.md": hub("site", ["repos: [site]", "basecamp_projects: [1, 2]"]),
    "hubs/site/items/bc-todo-1.md": item(
      "bc-todo-1",
      "site",
      [],
      "\ntool#1 tool#2 tool#3 tool#4 site#5 BC1234567\n",
    ),
  });
  const api: Api = (p) => {
    if (p.endsWith("/tool/issues/1")) return [issueOf(1)];
    if (p.endsWith("/tool/issues/2")) return [issueOf(2, { state: "closed" })];
    if (p.endsWith("/tool/issues/3")) return [issueOf(3, { html_url: undefined })];
    if (p.endsWith("/tool/issues/4")) return [];
    throw "not a GitHub error object";
  };
  const r = followGithub(root, 2, api);
  assert.deepEqual(r.pulled, ["gh-tool-1"]);
  assert.deepEqual(r.closed, ["gh-tool-2"]);
  assert.equal(r.moved.length, 1);
  assert.deepEqual(r.failed, ["gh-tool-4"]);
  assert.deepEqual(r.basecamp, [{ id: "bc-todo-1234567", project: null }]);
  // The reference goes: the followed issue is pruned
  writeFileSync(join(root, "hubs/site/items/bc-todo-1.md"), item("bc-todo-1", "site"));
  assert.deepEqual(followGithub(root, 2, api).removed, ["gh-tool-1"]);
});

test("briefs: no Basecamp yet, resolved and new items, kept summaries, odd records", () => {
  const root = tree({
    "README.md": INDEX,
    "hubs/site/README.md": hub("site", [
      "repos: [site]",
      "followed_repos: [tool]",
      "basecamp_projects: [22]",
    ]),
  });
  let issues: GitHubRecord[] = [
    { number: 1 },
    {
      number: 2,
      pull_request: {},
      assignees: [{ login: "a" }],
      title: "T",
      html_url: "u",
      updated_at: "2026-01-01",
    },
  ];
  const api: Api = (p) => (p.includes("/site/") ? issues : []);
  const first = writeBrief(root, "site", { today: TODAY, now: "2026-11-22T10:00:00Z", api });
  assert.equal(first.open, 2);
  const brief = () => readFileSync(join(root, "briefs/brief-site.md"), "utf8");
  assert.match(brief(), /Basecamp not read yet/);
  assert.match(brief(), /No summary yet/);
  writeBrief(root, "site", { today: TODAY, api, summary: "Baseline." });
  issues = [{ number: 3 }];
  const second = writeBrief(root, "site", {
    today: TODAY,
    api,
    projectTodos: [
      {
        id: 5,
        title: "Titled",
        app_url: "https://3.basecamp.com/1/projects/22/todos/5",
        due_at: "2026-11-30T00:00:00Z",
      },
      { id: 6 },
      { id: 7, app_url: "https://3.basecamp.com/1/projects/22/todos/7" },
    ],
  });
  assert.deepEqual([second.resolved, second.added], [2, 3]);
  assert.match(brief(), /### Resolved \(2\)/);
  assert.match(brief(), /Baseline\./);
  assert.match(brief(), /written: 2026-11-22/);
  // Markers out of order: the summary is not found and the default is used
  writeFileSync(
    join(root, "briefs/brief-site.md"),
    brief()
      .replace("<!-- /summary -->", "")
      .replace("<!-- summary", "<!-- /summary -->\n<!-- summary"),
  );
  writeBrief(root, "site", { today: TODAY, api });
  assert.match(brief(), /No summary yet/);
  assert.deepEqual(briefProjects(root), [{ hub: "site", projects: ["22"] }]);
  const pages = join(dirname(root), "pages.json");
  writeFileSync(pages, JSON.stringify([{ id: 1 }, { items: [{ id: 2 }] }]));
  assert.deepEqual(
    readProjectTodos([pages]).map((t) => t.id),
    [1, 2],
  );
});

test("refresh: stale locks, settings defaults, empty hubs without items, non-Error failures", () => {
  const root = tree({
    "README.md": INDEX,
    "hubs/a/README.md": hub("a", ["repos: [site]"]),
    "hubs/a/items/bc-todo-5.md": item("bc-todo-5", "a", ["assignees: [Ann]"]),
    "briefs/brief-gone.md": fm([
      "id: brief-gone",
      "title: G",
      "type: brief",
      "hub: gone",
      "updated: 2026-11-01 10:00",
    ]),
  });
  mkdirSync(join(root, ".lock"));
  const old = new Date(Date.now() - 20 * 60 * 1000);
  utimesSync(join(root, ".lock"), old, old);
  assert.equal(takeLock(root, Date.now()), true);
  rmSync(join(root, ".lock"), { recursive: true });
  const status = workStatus(root);
  // No watch_repos watches none, though a hub lists `site`: the counts match the list (GH #47)
  assert.deepEqual(
    [status.watch_repos, status.sync_minutes, status.auto_sync, status.org],
    [[], 5, true, ORG],
  );
  assert.deepEqual(
    status.items.map((i) => [i.id, i.project, i.mine]),
    [["bc-todo-5", "22", true]],
  );
  assert.deepEqual(status.briefs, []);
  const failing: Api = () => {
    throw "gh is not signed in";
  };
  const r = refreshWork(root, { today: TODAY, api: failing });
  assert.deepEqual(r.failed, { step: "sync-gh", detail: "gh is not signed in" });
  const empty = tree({
    "README.md": INDEX,
    "hubs/auto/README.md": fm([
      "id: auto",
      "title: A",
      "type: project",
      "status: active",
      "summary: Auto-created by work follow",
    ]),
  });
  const tidy = refreshWork(empty, { today: TODAY, api: noApi, now: () => 0 });
  assert.match(tidy.steps.map((s) => s.detail).join(" "), /1 empty hub\(s\) removed: auto/);
});

test("summary: long sections, dependents, aliases, no frontmatter", () => {
  const files: Record<string, string> = {
    "README.md": fm([
      "id: work",
      "title: Work",
      "type: index",
      "summary: x",
      "me: [ann-gh, Ann]",
      "aliases: [ann-gh=Ann]",
    ]),
    // A `|` in a hub or item title stays in its digest cell (GH #41)
    "hubs/site/README.md": hub("site").replace("title: site", "title: Site | One"),
    // Bo's and Cy's open items reference Ann's: Ann's hold them up
    "hubs/site/items/bo.md": item("bo", "site", ["assignees: [Bo]", "related: [mine-0]"]),
    "hubs/site/items/di.md": item("di", "site", ["assignees: [Di]", "related: [mine-1]"]),
    // No created time: its last activity is its updated time
    "hubs/site/items/undated.md": item("undated", "site").replace("created: 2026-01-01\n", ""),
  };
  for (let i = 0; i < 17; i++)
    files[`hubs/site/items/mine-${i}.md`] = item(`mine-${i}`, "site", [
      "assignees: [Ann]",
      "due: 2026-01-01",
    ]).replace("author: Cy", "author: Ann");
  files["hubs/site/items/mine-0.md"] = files["hubs/site/items/mine-0.md"]!.replace(
    "title: mine-0",
    "title: Fix | pipes\t  now",
  );
  const root = tree(files);
  const digest = buildSummary(root, TODAY, ["ann-gh"], ["ann-gh=Ann"]);
  assert.match(digest, /\) Fix \\\| pipes now \|/);
  assert.match(digest, /\[Site \\\| One\]\(/);
  assert.match(digest, /## Overdue \(17\)/);
  assert.match(digest, /…and 2 more\./);
  assert.match(digest, /\| Bo \| 1 \| {2}\|\n\| Di \| 1 \| {2}\|/);
  assert.deepEqual(writeSummary(root, TODAY), ["ann-gh", "Ann"]);
  assert.match(readFileSync(join(root, "LIST.md"), "utf8"), /## Basecamp todos \(17\)/);
  const bare = tree({ "README.md": "# Work\n" });
  assert.deepEqual(writeSummary(bare, TODAY), []);
  assert.match(readFileSync(join(bare, "README.md"), "utf8"), /^---\nid: work\ntitle: Work/);
});

test("list: two tables, the Site fallback, the order, and titles that hold | or runs of whitespace (GH #41)", () => {
  const todo = (n: number, hubId: string, updated: string, title = `bc-todo-${n}`) =>
    item(`bc-todo-${n}`, hubId, ["assignees: [Ann]"])
      .replace("updated: 2026-01-01", `updated: ${updated}`)
      .replace(`title: bc-todo-${n}`, `title: ${title}`);
  const issue = (repo: string, n: number) =>
    item(`gh-${repo}-${n}`, repo)
      .replace("source: basecamp", "source: github")
      .replace("kind: todo", "kind: issue");
  const root = tree({
    "README.md": fm([
      "id: work",
      "title: Work",
      "type: index",
      "summary: x",
      "me: [Ann]",
      "watch_repos: [site, tool]",
    ]),
    // The first of a hub's sites is its Site; a hub with no sites, or no README, shows its id
    "hubs/shop/README.md": hub("shop", ["sites: [shop-site, other]"]),
    "hubs/bare/README.md": hub("bare"),
    "hubs/shop/items/bc-todo-1.md": todo(1, "shop", "2026-01-01"),
    "hubs/shop/items/bc-todo-2.md": todo(2, "shop", "2026-03-01"),
    "hubs/bare/items/bc-todo-3.md": todo(3, "bare", "2026-02-01", "Fix | pipes"),
    "hubs/ghost/items/bc-todo-4.md": todo(4, "ghost", "2026-02-01", "one\t  two"),
    "hubs/tool/items/gh-tool-10.md": issue("tool", 10),
    "hubs/tool/items/gh-tool-2.md": issue("tool", 2),
    "hubs/site/items/gh-site-1.md": issue("site", 1),
  });
  writeSummary(root, TODAY);
  assert.equal(
    readFileSync(join(root, "LIST.md"), "utf8"),
    [
      "# Work list",
      "",
      "Generated by `work summary` on 2026-11-22: Basecamp todos assigned to you, then open issues in `watch_repos`. 7 items.",
      "",
      "## Basecamp todos (4)",
      "",
      "| Site | BC | Title |",
      "| --- | --- | --- |",
      "| bare | [BC3](https://x) | Fix \\| pipes |",
      "| ghost | [BC4](https://x) | one two |",
      "| shop-site | [BC2](https://x) | bc-todo-2 |",
      "| shop-site | [BC1](https://x) | bc-todo-1 |",
      "",
      "## GitHub issues (3)",
      "",
      "| Repo | Issue | Title |",
      "| --- | --- | --- |",
      "| site | [site#1](https://x) | gh-site-1 |",
      "| tool | [tool#2](https://x) | gh-tool-2 |",
      "| tool | [tool#10](https://x) | gh-tool-10 |",
      "",
    ].join("\n"),
  );
  // GH #47: list.json is the same rows in the same order, in groups by site and repo
  const row = (ref: string, title: string) => ({ ref, url: "https://x", title });
  assert.deepEqual(JSON.parse(readFileSync(join(root, "list.json"), "utf8")), {
    basecamp: [
      { key: "bare", rows: [row("BC3", "Fix | pipes")] },
      { key: "ghost", rows: [row("BC4", "one\t  two")] },
      { key: "shop-site", rows: [row("BC2", "bc-todo-2"), row("BC1", "bc-todo-1")] },
    ],
    github: [
      { key: "site", rows: [row("site#1", "gh-site-1")] },
      { key: "tool", rows: [row("tool#2", "gh-tool-2"), row("tool#10", "gh-tool-10")] },
    ],
  });
});

test("list: with no watch_repos, LIST.md and list.json show Basecamp only (GH #47)", () => {
  const root = tree({
    "README.md": fm(["id: work", "title: Work", "type: index", "summary: x", "me: [Ann]"]),
    "hubs/shop/README.md": hub("shop", ["repos: [site]"]),
    "hubs/shop/items/bc-todo-1.md": item("bc-todo-1", "shop", ["assignees: [Ann]"]),
    "hubs/shop/items/gh-site-1.md": item("gh-site-1", "shop")
      .replace("source: basecamp", "source: github")
      .replace("kind: todo", "kind: issue"),
  });
  writeSummary(root, TODAY);
  const markdown = readFileSync(join(root, "LIST.md"), "utf8");
  assert.match(markdown, /## Basecamp todos \(1\)/);
  assert.doesNotMatch(markdown, /GitHub issues/);
  const work = JSON.parse(readFileSync(join(root, "list.json"), "utf8"));
  assert.equal(work.basecamp.length, 1);
  assert.deepEqual(work.github, []);
  // list.json is not a work file: the folder still validates
  assert.equal(
    runWork(["validate", "--root", root], root, () => {}),
    0,
  );
});

test("cli: problems, no repos, projectless todos, created hubs, no me, and the default date", () => {
  const root = tree({
    "README.md": fm(["id: work", "title: Work", "type: index", "summary: x", "watch_repos: []"]),
    "x.md": "no frontmatter",
  });
  const lines: string[] = [];
  const write = (line: string) => lines.push(line);
  assert.equal(runWork(["validate", "--root", root], root, write), 1);
  assert.equal(runWork(["sync-gh", "--root", root], root, write, noApi), 0);
  assert.equal(runWork(["summary", "--root", root], root, write), 0);
  assert.equal(runWork(["summary", "--today", TODAY, "--root", root], root, write), 0);
  assert.equal(runWork(["status", "--root", root], root, write), 0);
  const todos = join(dirname(root), "todos.json");
  writeFileSync(
    todos,
    JSON.stringify([
      { id: 8, project_id: 88, project_name: "Fresh", title: "F", url: "u", created: "2026-01-01" },
    ]),
  );
  assert.equal(runWork(["import-bc", todos, "--root", root], root, write), 0);
  const out = lines.join("\n");
  assert.match(out, /problem\(s\) in/);
  assert.match(out, /no hub lists any repos/);
  assert.match(out, /set `me` in its frontmatter/);
  assert.match(out, /watch_repos: none/);
  assert.match(out, /hubs created \(1\): fresh/);
  const linked = tree({
    "README.md": INDEX,
    "hubs/a/README.md": hub("a", ["basecamp_projects: [1, 2]"]),
    "hubs/a/items/x.md": item("x", "a", [], "\nBC1234567\n"),
  });
  const refreshed: string[] = [];
  runWork(["refresh", "--root", linked], linked, (l) => refreshed.push(l), noApi);
  assert.match(
    refreshed.join("\n"),
    /basecamp to fetch via the connector \(1\): bc-todo-1234567$/m,
  );
  const chart = toMermaid(
    {
      nodes: [
        {
          id: "x",
          title: "t",
          source: "basecamp",
          kind: "todo",
          hub: "gone",
          status: "open",
          author: "a",
          created: "c",
          closed: null,
        },
      ],
      edges: [],
    },
    new Map(),
    true,
  );
  assert.match(chart.text, /subgraph n_hub_gone\["gone"\]/);
});
