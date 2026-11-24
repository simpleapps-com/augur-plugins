// GH #19: every proved rule that walked its input once per element is a loop, so a long issue
// body, comment thread or chart runs in constant stack. Before the fix each of these overflowed
// between 8,000 and 16,000 elements; here each runs at 100,000 and matches a plain oracle.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import { runWork } from "../../plugins/simpleapps-work-pane/scripts/lib/cli.ts";
import type { Api, GitHubRecord } from "../../plugins/simpleapps-work-pane/scripts/lib/github.ts";
import { hasOwner, isIssueIdOf } from "../../plugins/simpleapps-work-pane/scripts/pane-rules.ts";
import {
  addEdge,
  tableCell,
  chartLabel,
  classifyLine,
  closesBefore,
  compareText,
  extractRefs,
  formatList,
  formatScalar,
  holds,
  htmlText,
  isEmptyHub,
  isIdText,
  lastMineIndex,
  lower,
  matchesFormat,
  movedAway,
  nodeId,
  numberText,
  parseGithubId,
  parseScalar,
  parseValue,
  parseYaml,
  plainText,
  projectInUrl,
  refContext,
  shortRef,
  slug,
  splitSegments,
  trimText,
} from "../../plugins/simpleapps-work-pane/scripts/work-rules.ts";
import { isConnectorUrl, isReservedName, isSkillName } from "../../scripts/rules.ts";

const N = 100_000;
const ORG = "simpleapps-com";
const ctx = refContext(true, `${ORG}/site#1`, ORG);

test("text rules run on 100,000 code units", () => {
  const words = "ab c".repeat(N / 4);
  assert.equal(lower("AB".repeat(N / 2)), "ab".repeat(N / 2));
  assert.equal(trimText(` ${words} `), words);
  assert.equal(htmlText("<&>".repeat(N / 3)), "&lt;&amp;&gt;".repeat(N / 3));
  assert.equal(chartLabel('"<'.repeat(N / 2)), "#quot;".repeat(N / 2));
  assert.equal(nodeId("a-".repeat(N / 2)), `n_${"a_".repeat(N / 2)}`);
  assert.equal(tableCell(`a|${" ".repeat(N)}b`), "a\\| b");
  assert.equal(plainText("a<br>".repeat(N / 5)), "a\n".repeat(N / 5));
  assert.equal(slug(`A${"!".repeat(N)}B`), "a-b");
  assert.equal(numberText(`${"0".repeat(N)}7`), "7");
  assert.equal(projectInUrl(`${"x".repeat(N)}/projects/22/`), "22");
  assert.equal(compareText("a".repeat(N), `${"a".repeat(N)}b`), -1);
  assert.equal(movedAway(`${"x".repeat(N)}/${ORG}/site/issues/1`, ORG, "site"), false);
  assert.equal(closesBefore(`fixes${" ".repeat(N)}#1`, N + 5), false);
  assert.equal(closesBefore(`${"x".repeat(N)} fixes #1`, N + 7), true);
});

test("ids, formats and frontmatter run on 100,000 code units", () => {
  const long = "a".repeat(N);
  assert.equal(isIdText(long), true);
  assert.equal(matchesFormat("text", `${" ".repeat(N)}x`), true);
  assert.equal(matchesFormat("alias", `${long}=${long}`), true);
  assert.deepEqual(parseGithubId(`gh-${long}-12`, ORG), {
    ok: true,
    owner: ORG,
    repo: long,
    digits: "12",
  });
  assert.equal(shortRef(`gh-a.b-${"0".repeat(N)}5`, ORG), "b#5");
  assert.equal(formatScalar(long), long);
  assert.equal(formatScalar(`${long}:`), `"${long}:"`);
  assert.equal(parseScalar(`"${long}"`), long);
  assert.deepEqual(classifyLine(`k: ${long}`), { kind: "pair", key: "k", rest: ` ${long}` });
  const items = Array.from({ length: N }, (_, i) => `i${i}`);
  assert.deepEqual(parseValue(formatList(items)).items, items);
  // Long frontmatter: 100,000 lines read. Few keys: each list item and each problem copies its
  // list, so many of those are quadratic in time (not stack); real frontmatter has a handful.
  const notes = Array.from({ length: N }, () => "# note");
  const yaml = parseYaml(["kb: v", ...notes, "ka: [x, y]", ...notes, "tags:", "  - x"]);
  assert.deepEqual(
    yaml.entries.map((e) => e.key),
    ["kb", "ka", "tags"],
  );
  assert.deepEqual(yaml.problems, []);
  assert.equal(isIssueIdOf(`gh-site-${"1".repeat(N)}`, "gh-site-"), true);
  assert.equal(hasOwner(`${long}/b`), true);
  assert.equal(isSkillName(`a${"b".repeat(N)}`), false);
  assert.equal(isReservedName(`${long}claude`), true);
  assert.equal(isConnectorUrl(`https://${long}.augur-mcp.com/mcp`), true);
});

test("lists run on 100,000 elements", () => {
  const names = Array.from({ length: N }, () => "items");
  assert.equal(isEmptyHub(names, 0), true);
  assert.equal(holds([...names, "x"], "x"), true);
  assert.equal(lastMineIndex([true, ...Array.from({ length: N }, () => false)]), 0);
  const edges = Array.from({ length: N }, (_, i) => ({ from: "a", to: `b${i}`, closes: false }));
  const added = addEdge(edges, "a", `b${N - 1}`, true);
  assert.equal(added.length, N);
  assert.equal(added[N - 1]!.closes, true);
});

test("references and comments are found in 100,000-code-unit texts", () => {
  const filler = "lorem ipsum ".repeat(N / 12);
  const text = `${filler}Fixes #7 and BC500000099 ${"#".repeat(N)} https://github.com/${ORG}/tool/issues/3`;
  assert.deepEqual(
    extractRefs(text, ctx).map((r) => [r.id, r.closes]),
    [
      ["gh-tool-3", false],
      ["gh-site-7", true],
      ["bc-todo-500000099", false],
    ],
  );
  const comment = (k: number) =>
    `### person${k} · 2026-11-0${(k % 9) + 1}\n${"word ".repeat(10)}\n`;
  const body = `${filler}\n${Array.from({ length: 2000 }, (_, k) => comment(k)).join("")}`;
  const segments = splitSegments(body, "Ann", "2026-11-01");
  assert.equal(segments.length, 2001);
  assert.equal(segments[2000]!.author, "person1999");
  assert.equal(splitSegments(`### ${"a".repeat(N)}`, "Ann", "t").length, 1);
});

// ---------------------------------------------------------------- refresh end to end

const folders: string[] = [];
after(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

const fm = (lines: string[], body = "") => `---\n${lines.join("\n")}\n---\n${body}`;

test("refresh syncs and follows an issue with a 100,000-character body and a long thread", () => {
  const dir = mkdtempSync(join(tmpdir(), "work-long-"));
  folders.push(dir);
  const root = join(dir, "work");
  const files: Record<string, string> = {
    "README.md": fm([
      "id: work",
      "title: Work",
      "type: index",
      "summary: Mine.",
      `org: ${ORG}`,
      "me: [Ann]",
    ]),
    "hubs/site/README.md": fm([
      "id: site",
      "title: Site",
      "type: client",
      "status: active",
      "summary: The site.",
      "repos: [site]",
    ]),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const body = `${"A long pasted log line. ".repeat(N / 24)}\nSee BC500000099`;
  const issue: GitHubRecord = {
    number: 1,
    title: "Long",
    body,
    state: "open",
    html_url: `https://github.com/${ORG}/site/issues/1`,
    user: { login: "bob" },
    assignees: [],
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
    closed_at: null,
    comments: 300,
  };
  const comments = Array.from({ length: 300 }, (_, k) => ({
    user: { login: `user${k}` },
    created_at: "2026-11-21T09:00:00Z",
    body: "reply ".repeat(400),
  }));
  const api: Api = (path) => {
    if (path === `repos/${ORG}/site/issues?state=open&per_page=100`) return [issue];
    if (path === `repos/${ORG}/site/issues/1/comments?per_page=100`) return comments;
    throw new Error(`no fake for ${path}`);
  };
  const lines: string[] = [];
  const code = runWork(
    ["refresh", "--json", "--root", root],
    "/nowhere",
    (l) => lines.push(l),
    api,
    "2026-11-22",
  );
  const report = JSON.parse(String(lines[0])) as {
    ok: boolean;
    failed: unknown;
    basecamp: { id: string }[];
  };
  assert.equal(report.failed, null, lines.join("\n"));
  assert.equal(code, 0);
  // The reference at the end of the long body was found and listed for the pane to fetch
  assert.deepEqual(
    report.basecamp.map((t) => t.id),
    ["bc-todo-500000099"],
  );
  const item = readFileSync(join(root, "hubs/site/items/gh-site-1.md"), "utf8");
  assert.ok(item.includes("A long pasted log line."));
  assert.ok(item.includes("### user299"));
});
