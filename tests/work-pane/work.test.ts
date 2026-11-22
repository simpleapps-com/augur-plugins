// The work scripts end to end: a work/ tree in a temporary folder, a fake GitHub API, and Basecamp
// records as the Work pane writes them, driven through the `work` commands.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { runWork } from "../../plugins/simpleapps-work-pane/scripts/lib/cli.ts";
import type { Api, GitHubRecord } from "../../plugins/simpleapps-work-pane/scripts/lib/github.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORG = "simpleapps-com";
const TODAY = "2026-11-22";
const folders: string[] = [];

after(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** A fresh project folder; `files` (path under work/ to text) laid in it. */
function project(files: Record<string, string>): { root: string; tmp: string } {
  const dir = mkdtempSync(join(tmpdir(), "work-"));
  folders.push(dir);
  const root = join(dir, "work");
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  const tmp = join(dir, "tmp");
  mkdirSync(tmp, { recursive: true });
  return { root, tmp };
}

const fm = (lines: string[], body = "") => `---\n${lines.join("\n")}\n---\n${body}`;

const INDEX = fm(
  [
    "id: work",
    "title: Work",
    "type: index",
    "summary: My work.",
    "# who I am",
    "me: [Ann, ann-gh]",
    "aliases:",
    "  - ann-gh=Ann",
    `org: ${ORG}`,
    "watch_repos: [site, acme/other]",
    "auto_sync: false",
    "sync_minutes: 10",
  ],
  "\n# Work\n",
);

const HUB = fm([
  "id: site",
  "title: Site",
  "type: client",
  "status: active",
  "summary: The site.",
  "repos: [site]",
  "basecamp_projects: [22]",
]);

const AUTO_HUB = fm([
  "id: empty",
  "title: Empty",
  "type: project",
  "status: active",
  "summary: Auto-created by work follow for x. Set type",
]);

const BRIEF = fm(
  ["id: brief-site", "title: Site brief", "type: brief", "hub: site", "updated: 2026-11-01 10:00"],
  "\n<!-- summary: written by /site-brief; work refresh keeps it -->\nThe site is fine.\n<!-- /summary -->\n",
);

const ORPHAN_BRIEF = fm([
  "id: brief-gone",
  "title: Gone brief",
  "type: brief",
  "hub: gone",
  "updated: 2026-11-01 10:00",
]);

const issue = (number: number, extra: GitHubRecord = {}): GitHubRecord => ({
  number,
  title: `Issue ${number}`,
  body: "",
  state: "open",
  html_url: `https://github.com/${ORG}/site/issues/${number}`,
  user: { login: "bob" },
  assignees: [],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  closed_at: null,
  comments: 0,
  ...extra,
});

/** GitHub as the fake: each path to its records; a path it does not know throws, as gh does. */
function fakeApi(): Api {
  const paths: Record<string, GitHubRecord[]> = {
    [`repos/${ORG}/site/issues?state=open&per_page=100`]: [
      issue(1, {
        body: "Fixes tool#5. See tool#6, tool#7, tool#8, BC500000099, other-org/thing#2 and https://3.basecamp.com/1/projects/22/todos/500000077",
        assignees: [{ login: "ann-gh" }],
        comments: 1,
      }),
      issue(2, { pull_request: {}, user: null, body: null }),
      issue(3, { assignees: [{ login: "ann-gh" }], body: "Needs site#99" }),
    ],
    [`repos/${ORG}/site/issues/1/comments?per_page=100`]: [
      { user: { login: "bob" }, created_at: "2026-11-21T09:00:00Z", body: "Any news? closes #2" },
    ],
    [`repos/${ORG}/tool/issues/5`]: [
      issue(5, {
        html_url: `https://github.com/${ORG}/tool/issues/5`,
        comments: 1,
        body: "See tool#9",
      }),
    ],
    [`repos/${ORG}/tool/issues/5/comments?per_page=100`]: [
      { user: { login: "dependabot[bot]" }, created_at: "2026-11-21T09:00:00Z", body: null },
    ],
    [`repos/${ORG}/tool/issues/6`]: [
      issue(6, { state: "closed", html_url: `https://github.com/${ORG}/tool/issues/6` }),
    ],
    [`repos/${ORG}/tool/issues/7`]: [
      issue(7, { html_url: `https://github.com/${ORG}/elsewhere/issues/1` }),
    ],
    [`repos/${ORG}/tool/issues/9`]: [
      issue(9, { html_url: `https://github.com/${ORG}/tool/issues/9` }),
    ],
  };
  return (path) => {
    const found = paths[path];
    if (!found) throw new Error(`no fake for ${path}`);
    return found;
  };
}

/** Basecamp todos as the Work pane fetches them with get_todo. */
const FETCHED = [
  {
    basecamp: {
      id: 500000011,
      content: "Fix the cart",
      app_url: "https://3.basecamp.com/1/buckets/22/todos/500000011",
      completed: false,
      creator: { name: "Cy" },
      assignee: { name: "Ann" },
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-10-01T10:00:00Z",
      due_on: "2026-11-20",
      comments: [
        {
          creator: { name: "Cy" },
          created_at: "2026-10-02T10:00:00Z",
          content: "Line one<br>Line two",
        },
        { created_at: "2026-10-03T10:00:00Z" },
      ],
    },
    project_id: 22,
    project_name: "Site",
    list: "Bugs",
  },
  {
    basecamp: {
      id: 500000012,
      content: "New project todo",
      app_url: "https://3.basecamp.com/1/buckets/33/todos/500000012",
      created_at: "2026-11-01T10:00:00Z",
      assignee: { name: "Ann" },
      due_on: "2026-11-25",
    },
    project_id: 33,
    project_name: "Brand New Co.",
  },
  {
    basecamp: {
      id: 500000013,
      content: "Done already",
      app_url: "https://3.basecamp.com/1/buckets/22/todos/500000013",
      completed: true,
      assignee: null,
      created_at: "2026-11-01T10:00:00Z",
    },
    project_id: 22,
    project_name: "",
  },
];

/** `list_todos` records for the site brief, as the pane writes them. */
const PROJECT_TODOS = {
  items: [
    {
      id: 500000011,
      content: "Fix the cart",
      app_url: "https://3.basecamp.com/1/projects/22/todos/500000011",
      assignee: { name: "Ann" },
      updated_at: "2026-10-01T10:00:00Z",
      due_on: "2026-11-20",
    },
    { id: 7, title: "Elsewhere", app_url: "https://3.basecamp.com/1/projects/99/todos/7" },
  ],
};

function run(root: string, args: string[], api: Api = fakeApi()) {
  const lines: string[] = [];
  const code = runWork(
    [...args, "--root", root],
    "/nowhere",
    (line) => lines.push(line),
    api,
    TODAY,
  );
  return { code, lines, out: lines.join("\n") };
}

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

test("refresh brings work/ up to date from Basecamp and GitHub, and logs the run", () => {
  const { root, tmp } = project({
    "README.md": INDEX,
    "hubs/site/README.md": HUB,
    "hubs/empty/README.md": AUTO_HUB,
    "hubs/empty/items/.keep": "",
    "briefs/brief-site.md": BRIEF,
  });
  writeFileSync(join(tmp, "todos.json"), JSON.stringify(FETCHED));
  writeFileSync(join(tmp, "project.json"), JSON.stringify([PROJECT_TODOS]));
  const r = run(root, [
    "refresh",
    "--todos",
    join(tmp, "todos.json"),
    "--project-todos",
    tmp,
    "--trigger",
    "button",
    "--json",
  ]);
  const report = JSON.parse(String(r.lines[0])) as {
    ok: boolean;
    failed: unknown;
    basecamp: { id: string }[];
  };
  assert.equal(report.failed, null, r.out);
  assert.equal(report.ok, true);
  assert.equal(r.code, 0);
  // Basecamp: the cart todo in the site hub; the new project's todo in a hub created for it
  assert.ok(existsSync(join(root, "hubs/site/items/bc-todo-500000011.md")));
  assert.ok(existsSync(join(root, "hubs/brand-new-co/items/bc-todo-500000012.md")));
  assert.match(read(root, "hubs/site/items/bc-todo-500000011.md"), /Line one\nLine two/);
  // GitHub: the site's issues, and the followed tool issue and the one it references
  assert.ok(existsSync(join(root, "hubs/site/items/gh-site-1.md")));
  assert.ok(existsSync(join(root, "hubs/tool/items/gh-tool-5.md")));
  // The empty auto-created hub is tidied away
  assert.ok(!existsSync(join(root, "hubs/empty")));
  // Linked todos not in work/ yet, for the pane to fetch
  assert.deepEqual(report.basecamp.map((t) => t.id).sort(), [
    "bc-todo-500000077",
    "bc-todo-500000099",
  ]);
  // The digest, the list, the chart, the brief and the log
  const digest = read(root, "README.md");
  assert.match(digest, /^---\nid: work\n/);
  assert.match(digest, /# who I am/);
  assert.match(digest, /Bottleneck: work these first/);
  assert.match(digest, /Overdue/);
  assert.match(digest, /Due soon/);
  assert.match(read(root, "LIST.md"), /site#1/);
  assert.match(read(root, "chart.md"), /flowchart LR/);
  assert.match(read(root, "chart.html"), /<pre class="mermaid">/);
  assert.match(read(root, "briefs/brief-site.md"), /The site is fine\./);
  assert.match(read(root, "sync.log"), / button ok /);
  // A second run changes nothing it already wrote
  const again = run(root, ["refresh"]);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /import-bc: nothing to import/);
});

test("status reports settings and items; validate, link, chart, summary and follow report", () => {
  const { root } = project({ "README.md": INDEX, "hubs/site/README.md": HUB });
  assert.equal(run(root, ["sync-gh"]).code, 0);
  const status = run(root, ["status", "--json"]);
  const s = JSON.parse(String(status.lines[0])) as {
    org: string;
    sync_minutes: number;
    auto_sync: boolean;
    items: unknown[];
  };
  assert.deepEqual([s.org, s.sync_minutes, s.auto_sync, s.items.length], [ORG, 10, false, 3]);
  assert.match(run(root, ["status"]).out, /org: simpleapps-com[\s\S]*last sync: never/);
  assert.match(run(root, ["validate"]).out, /file\(s\) valid/);
  assert.match(run(root, ["link"]).out, /referenced but not synced/);
  assert.match(run(root, ["chart", "all"]).out, /chart: \d+ item/);
  assert.match(run(root, ["summary"]).out, /summary written for Ann, ann-gh/);
  const followed = run(root, ["follow", "--depth", "1"]);
  assert.match(followed.out, /followed 1 layer/);
  assert.match(followed.out, /other orgs, not followed/);
  assert.match(followed.out, /transferred, not followed/);
  assert.match(followed.out, /failed \(1\): gh-tool-8/);
  assert.equal(run(root, ["follow", "--depth", "0"]).code, 2);
});

test("import-bc and brief work on their own; errors and usage are reported", () => {
  const { root, tmp } = project({ "README.md": INDEX, "hubs/site/README.md": HUB });
  writeFileSync(join(tmp, "one.json"), JSON.stringify(FETCHED[0]));
  writeFileSync(
    join(tmp, "plain.json"),
    JSON.stringify({
      id: 9,
      project_id: 22,
      title: "Plain",
      url: "u",
      created: "2026-01-01",
      status: "closed",
    }),
  );
  assert.match(run(root, ["import-bc", join(tmp, "one.json")]).out, /1 written/);
  assert.match(run(root, ["import-bc", join(tmp, "plain.json")]).out, /0 closed removed/);
  assert.equal(run(root, ["import-bc"]).code, 2);
  writeFileSync(join(tmp, "summary.md"), "  A fresh summary.  ");
  const brief = run(root, [
    "brief",
    "site",
    "--summary",
    join(tmp, "summary.md"),
    "--todos",
    join(tmp, "one.json"),
  ]);
  assert.match(brief.out, /brief-site\.md: \d+ open, 0 resolved, 0 new/);
  assert.match(read(root, "briefs/brief-site.md"), /A fresh summary\./);
  assert.match(run(root, ["brief", "site"]).out, /0 resolved/);
  assert.equal(run(root, ["brief"]).code, 2);
  assert.throws(() => run(root, ["brief", "nope"]), /no hub "nope"/);
  assert.equal(run(root, ["nope"]).code, 2);
  // An option with no value after it
  assert.equal(
    runWork(["status", "--root"], root, () => undefined, fakeApi(), TODAY),
    2,
  );
});

test("a bad index stops the run; a held lock is reported; a failing step fails the run", () => {
  const bad = project({
    "README.md": fm(["id: work", "title: Work", "type: index", "summary: x", "sync_minutes: 99"]),
  });
  const r = run(bad.root, ["refresh"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /FAILED at index: work\/README\.md: "sync_minutes" has invalid format "99"/);

  const locked = project({ "README.md": INDEX });
  mkdirSync(join(locked.root, ".lock"));
  const held = run(locked.root, ["refresh"]);
  assert.equal(held.code, 3);
  assert.match(held.out, /another sync is running/);

  const broken = project({
    "README.md": INDEX,
    "hubs/site/README.md": HUB,
    "notes.md": "no frontmatter",
  });
  const failed = run(broken.root, ["refresh"]);
  assert.equal(failed.code, 1);
  assert.match(failed.out, /FAILED at validate: \d+ problem\(s\): notes\.md: missing frontmatter/);

  // A brief whose hub is gone is named, and fails validation
  const orphan = project({ "README.md": INDEX, "briefs/brief-gone.md": ORPHAN_BRIEF });
  const gone = run(orphan.root, ["refresh"]);
  assert.match(gone.out, /brief: no briefs; no hub for gone/);
  assert.match(
    gone.out,
    /FAILED at validate: 1 problem\(s\): briefs\/brief-gone\.md: "hub" "gone" does not exist/,
  );
});

test("a fresh install gets a starter index", () => {
  const { root } = project({});
  rmSync(root, { recursive: true, force: true });
  const r = run(root, ["refresh"]);
  assert.equal(r.code, 0, r.out);
  assert.match(read(root, "README.md"), /set `me` in the frontmatter|Set `me`/);
});

test("work.ts runs from the shell, with work/ in the current folder by default", () => {
  const { root } = project({ "README.md": INDEX });
  const r = spawnSync(
    process.execPath,
    [join(HERE, "../../plugins/simpleapps-work-pane/scripts/work.ts"), "status"],
    {
      cwd: dirname(root),
      encoding: "utf8",
    },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /org: simpleapps-com/);
});
