// Pins the Work pane's proved lists (pane-rules.ts "the lists the pane builds") to the runtime:
// the proof says what the Dafny model (WorkPane) decides; these say JavaScript decides the same,
// against the code each rule replaced in hooks/register.tsx (Map, Set, filter) as the oracle,
// over thousands of generated inputs.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type ClosedTodo,
  type IndexTodo,
  type LocalTodo,
  type PaneItem,
  type PaneTarget,
  briefProjectIds,
  completedIds,
  duplicateNames,
  failedParts,
  inWatchedNames,
  isBasecampUrl,
  isEdited,
  hasLeft,
  isIssueIdOf,
  isProjectId,
  isRecentlyClosed,
  isTrackedIssue,
  isTrackedTodo,
  linkedTargets,
  rememberClosed,
  repoName,
  skipClosed,
  skipsClosed,
  syncResultOf,
  tally,
  todosToFetch,
  uniqueTodos,
  withBasecampSkipped,
  withBriefProblem,
} from "../../plugins/simpleapps-work-pane/scripts/pane-rules.ts";

/** A seeded generator (mulberry32), so a failure reproduces. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(20261124);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;
const bool = () => next() < 0.5;
const list = <T>(make: () => T, max = 6): T[] =>
  Array.from({ length: Math.floor(next() * max) }, make);
const N = 3000;
const NOW = Date.parse("2026-11-24T14:00:00Z");
const DAY = 86_400_000;

test("repoName is the part after the last /, and inWatchedNames is some name's issue", () => {
  for (const repo of ["site", "acme/tool", "a/b/c", "", "/", "x/", "/y"])
    assert.equal(repoName(repo), repo.split("/").pop() ?? "", repo);
  const NAMES = ["site", "tool", "sites", ""];
  for (let n = 0; n < N; n++) {
    const names = list(() => pick(NAMES));
    const id = `gh-${pick(NAMES)}-${pick(["1", "12", "", "x"])}`;
    assert.equal(
      inWatchedNames(id, names),
      names.some((name) => isIssueIdOf(id, `gh-${name}-`)),
      JSON.stringify({ id, names }),
    );
  }
});

test("tally counts open Basecamp todos of yours and open issues in watched repos", () => {
  for (let n = 0; n < N; n++) {
    const items: PaneItem[] = list(
      () => ({
        status: pick(["open", "closed", ""]),
        source: pick(["basecamp", "github", "x"]),
        kind: pick(["todo", "issue", "pull"]),
        mine: bool(),
        watched: bool(),
      }),
      10,
    );
    const open = items.filter((i) => i.status === "open");
    assert.deepEqual(tally(items), {
      basecamp: open.filter((i) =>
        isTrackedTodo(true, i.source === "basecamp", i.kind === "todo", i.mine),
      ).length,
      github: open.filter((i) =>
        isTrackedIssue(true, i.source === "github", i.kind === "issue", i.watched),
      ).length,
    });
  }
});

test("failedParts names the count, the index, each unread repo, then the change search", () => {
  for (let n = 0; n < N; n++) {
    const repos = list(() => pick(["site", "tool", "acme/x"]));
    const read = repos.map(() => bool());
    const [cf, ifl, cr] = [bool(), bool(), bool()];
    assert.deepEqual(failedParts(cf, "c", ifl, "i", repos, read, cr), [
      ...(cf ? ["Basecamp count (c)"] : []),
      ...(ifl ? ["Basecamp index (i)"] : []),
      ...repos.filter((_, i) => !read[i]),
      ...(cr ? [] : ["GitHub changes"]),
    ]);
  }
});

const todo = (): IndexTodo => ({
  id: pick([1, 2, 3, 4]),
  projectId: pick([0, 22]),
  projectName: pick(["", "Site"]),
  list: pick(["", "Bugs"]),
  updatedKnown: bool(),
  updatedMs: pick([0, 1, 2]),
});

test("uniqueTodos is a Map by id: first-seen order, last-seen value", () => {
  for (let n = 0; n < N; n++) {
    const todos = list(todo, 10);
    const byId = new Map<number, IndexTodo>();
    for (const t of todos) byId.set(t.id, t);
    assert.deepEqual(uniqueTodos(todos), [...byId.values()]);
  }
});

const target = (t: { id: number; projectId: number; projectName: string; list: string }) => ({
  id: t.id,
  projectId: t.projectId,
  projectName: t.projectName,
  list: t.list,
});

test("todosToFetch is the edited ones, then those that left your list", () => {
  for (let n = 0; n < N; n++) {
    const remote = list(todo);
    const local: LocalTodo[] = list(() => ({
      num: pick([1, 2, 3, 5]),
      updatedKnown: bool(),
      updatedMs: pick([0, 1, 2]),
      hasProject: bool(),
      projectId: pick([0, 22]),
      mine: bool(),
    }));
    const linked = bool();
    const byNum = new Map(local.map((l) => [l.num, l]));
    const onList = new Set(remote.map((r) => r.id));
    const edited = remote
      .filter((r) => {
        const l = byNum.get(r.id);
        return isEdited(l?.updatedKnown ?? false, l?.updatedMs ?? 0, r.updatedKnown, r.updatedMs);
      })
      .map(target);
    const left = local
      .filter((l) => hasLeft(onList.has(l.num), l.hasProject, linked, l.mine))
      .map((l) => ({ id: l.num, projectId: l.projectId, projectName: "", list: "" }));
    assert.deepEqual(todosToFetch(remote, local, linked), [...edited, ...left]);
  }
});

test("linkedTargets keeps those with a project; completedIds those with an id that completed", () => {
  for (let n = 0; n < N; n++) {
    const found = list(() => ({ num: pick([1, 2]), hasProject: bool(), projectId: 22 }));
    assert.deepEqual(
      linkedTargets(found),
      found
        .filter((f) => f.hasProject)
        .map((f) => ({ id: f.num, projectId: 22, projectName: "", list: "" })),
    );
    const records = list(() => ({ hasId: bool(), id: pick([1, 2]), completed: bool() }));
    assert.deepEqual(
      completedIds(records),
      records.filter((r) => r.hasId && r.completed).map((r) => r.id),
    );
  }
});

/** As the shell builds them, from `$.store`'s Record: each id once. */
const closedEntries = (): ClosedTodo[] => [
  ...new Map(
    list(() => ({ id: pick([1, 2, 3]), at: NOW - pick([0, 1, 6, 7, 8]) * DAY })).map((c) => [
      c.id,
      c,
    ]),
  ).values(),
];

test("skipClosed and rememberClosed behave as the old Record did", () => {
  for (let n = 0; n < N; n++) {
    const closed = closedEntries();
    const record = Object.fromEntries(closed.map((c) => [String(c.id), c.at]));
    const targets: PaneTarget[] = list(() =>
      target({ id: pick([1, 2, 3, 4]), projectId: 22, projectName: "", list: "" }),
    );
    assert.deepEqual(
      skipClosed(targets, closed, NOW),
      targets.filter((t) => {
        const at = record[String(t.id)];
        return !skipsClosed(at !== undefined, NOW, at ?? 0);
      }),
    );
    const ids = list(() => pick([1, 2, 4]));
    const kept = Object.entries(record).filter(([, at]) => isRecentlyClosed(NOW, at));
    const expected = Object.fromEntries([...kept, ...ids.map((id) => [String(id), NOW])]);
    const got = Object.fromEntries(
      rememberClosed(closed, ids, NOW).map((c) => [String(c.id), c.at]),
    );
    assert.deepEqual(got, expected, JSON.stringify({ closed, ids }));
  }
});

test("briefProjectIds is each real project id once, in order", () => {
  for (let n = 0; n < N; n++) {
    const ids = list(() => pick([0, -1, 22, 22, 7, Number.NaN]), 8);
    assert.deepEqual(briefProjectIds(ids), [...new Set(ids)].filter(isProjectId));
  }
});

test("duplicateNames are the servers with a URL on the connector's origin", () => {
  for (let n = 0; n < N; n++) {
    const servers = list(() => ({
      name: pick(["a", "b"]),
      hasUrl: bool(),
      url: pick(["https://basecamp.augur-mcp.com/mcp", "https://x.example", ""]),
    }));
    assert.deepEqual(
      duplicateNames(servers),
      servers.filter((s) => s.hasUrl && isBasecampUrl(s.url)).map((s) => s.name),
    );
  }
});

test("syncResultOf, withBasecampSkipped and withBriefProblem", () => {
  const at = NOW;
  assert.deepEqual(syncResultOf(false, false, false, "s", "w", at), {
    at,
    ok: false,
    detail: "work refresh did not run",
  });
  assert.equal(syncResultOf(true, true, false, "s", "w", at).detail, "another sync is running");
  assert.equal(syncResultOf(true, false, true, "follow", "x", at).detail, "failed at follow: x");
  const ok = syncResultOf(true, false, false, "", "", at);
  assert.deepEqual(ok, { at, ok: true, detail: "synced" });
  assert.deepEqual(withBasecampSkipped(ok, false, ""), ok);
  assert.deepEqual(withBasecampSkipped(ok, true, "p"), {
    at,
    ok: false,
    detail: "synced, GitHub only; Basecamp skipped (p)",
  });
  const failed = syncResultOf(true, true, false, "", "", at);
  assert.deepEqual(withBasecampSkipped(failed, true, "p"), failed);
  assert.equal(
    withBriefProblem(ok, true, "q").detail,
    "synced; briefs kept their last Basecamp read (q)",
  );
  assert.deepEqual(withBriefProblem(ok, false, ""), ok);
  assert.deepEqual(withBriefProblem(failed, true, "q"), failed);
});
