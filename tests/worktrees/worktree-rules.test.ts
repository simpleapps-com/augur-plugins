// Pins the worktree hooks plugin's proved rules (plugins/simpleapps-worktrees/scripts/worktree-rules.ts)
// to the runtime: the proof says what the Dafny model decides; these say JavaScript decides the
// same, against the regex and the plain code each rule replaced.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addArgs,
  agentFolder,
  besideRepo,
  createStep,
  fetchBranch,
  hasRepo,
  heldBy,
  installsDeps,
  isInside,
  isWorktreeName,
  layoutOf,
  linkedPaths,
  marksSession,
  modeOf,
  needsFetch,
  remoteDefault,
  removeArgs,
  removeExit,
  removeLooks,
  removeVerdict,
  runPlan,
  shellSafe,
  isLinkedWorktree,
  restoresHooks,
  runsInShell,
  sessionEndRuns,
  sessionPicks,
  sessionVerdict,
  startRef,
  subagentLooks,
  subagentVerdict,
  warnsNoRemote,
  wtHasPrefix,
  type Held,
  type Layout,
} from "../../plugins/simpleapps-worktrees/scripts/worktree-rules.ts";

/** The augur-skills hook's name check, which isWorktreeName replaces. */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const oracleName = (s: string) => NAME_PATTERN.test(s) && !s.includes("..");

/** A small deterministic generator (mulberry32), so every run draws the same inputs. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = [
  "a",
  "Z",
  "0",
  "9",
  ".",
  "_",
  "-",
  "/",
  "\\",
  " ",
  ":",
  "é",
  "@",
  "\n",
  "\u{1F600}",
];

test("isWorktreeName agrees with the regex on every code unit and on generated names", () => {
  const mismatches: string[] = [];
  for (let c = 0; c < 65536; c++) {
    const one = String.fromCharCode(c);
    for (const s of [one, `a${one}`, `${one}a`])
      if (isWorktreeName(s) !== oracleName(s)) mismatches.push(s);
  }
  for (let seed = 1; seed <= 5; seed++) {
    const next = random(seed);
    for (let n = 0; n < 4000; n++) {
      const length = Math.floor(next() * 8);
      let s = "";
      for (let k = 0; k < length; k++) s += ALPHABET[Math.floor(next() * ALPHABET.length)];
      if (isWorktreeName(s) !== oracleName(s)) mismatches.push(s);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("isWorktreeName: fixed cases, including every refusal", () => {
  for (const s of ["feat-77", "agent-a1", "bold-oak-a3f2", "v1.2_x", "A", "a.b.c"])
    assert.equal(isWorktreeName(s), true, s);
  for (const s of ["", ".", "..", "a..b", "a/b", "a\\b", "-f", ".hidden", "a b", "a:b", "_x"])
    assert.equal(isWorktreeName(s), false, s);
});

test("subagentLooks only at a valid agent-<id> folder", () => {
  assert.equal(agentFolder("a1"), "agent-a1");
  assert.equal(subagentLooks("a1"), true);
  for (const id of ["", "x/../../repo", "a b", "..", "a..b"])
    assert.equal(subagentLooks(id), false);
});

test("layoutOf: the folder's own repo, then {project}/repo, then a repo above, else none", () => {
  assert.equal(layoutOf(true, true, 0, "/top"), "own-repo");
  assert.equal(layoutOf(false, true, 0, "/top"), "project-repo");
  assert.equal(layoutOf(false, false, 0, "/top"), "enclosing-repo");
  assert.equal(layoutOf(false, false, 0, ""), "no-repo");
  assert.equal(layoutOf(false, false, 128, "/top"), "no-repo");
  const layouts: Layout[] = ["own-repo", "project-repo", "enclosing-repo", "no-repo"];
  assert.deepEqual(layouts.map(hasRepo), [true, true, true, false]);
  assert.deepEqual(layouts.map(besideRepo), [false, true, false, false]);
});

test("modeOf: the first valid baseRef wins, fresh by default", () => {
  assert.equal(modeOf([]), "from-remote");
  assert.equal(modeOf(["", "dev", "head"]), "from-head");
  assert.equal(modeOf(["fresh", "head"]), "from-remote");
  assert.equal(modeOf(["head", "fresh"]), "from-head");
  assert.equal(modeOf(["dev"]), "from-remote");
});

test("remoteDefault, startRef, warnsNoRemote, needsFetch and fetchBranch choose the base", () => {
  assert.equal(remoteDefault(0, "origin/dev", 0, 0), "origin/dev");
  assert.equal(remoteDefault(128, "", 0, 0), "origin/main");
  assert.equal(remoteDefault(128, "", 1, 0), "origin/master");
  assert.equal(remoteDefault(128, "", 1, 1), "");
  assert.equal(startRef("from-head", "origin/main"), "HEAD");
  assert.equal(startRef("from-remote", ""), "HEAD");
  assert.equal(startRef("from-remote", "origin/main"), "origin/main");
  assert.equal(warnsNoRemote("from-remote", ""), true);
  assert.equal(warnsNoRemote("from-remote", "origin/main"), false);
  assert.equal(warnsNoRemote("from-head", ""), false);
  const day = 86_400_000;
  assert.equal(needsFetch("from-remote", "origin/main", 0, true, day - 1), false);
  assert.equal(needsFetch("from-remote", "origin/main", 0, true, day), true);
  assert.equal(needsFetch("from-remote", "origin/main", 0, false, 0), true);
  assert.equal(needsFetch("from-remote", "origin/main", 128, true, 0), true);
  assert.equal(needsFetch("from-remote", "", 128, false, 0), false);
  assert.equal(needsFetch("from-head", "origin/main", 128, false, 0), false);
  assert.equal(fetchBranch("origin/main"), "main");
  assert.equal(fetchBranch("upstream/main"), "upstream/main");
  assert.equal(fetchBranch("origin"), "origin");
});

test("wtHasPrefix and isInside agree with startsWith", () => {
  for (const [s, p] of [
    ["abc", "ab"],
    ["abc", "abc"],
    ["ab", "abc"],
    ["abc", ""],
    ["abc", "b"],
  ] as const)
    assert.equal(wtHasPrefix(s, p), s.startsWith(p), `${s} ${p}`);
  assert.equal(isInside("/w/x", "/w/x", "/"), true);
  assert.equal(isInside("/w/x/src", "/w/x", "/"), true);
  assert.equal(isInside("/w/xy", "/w/x", "/"), false);
  assert.equal(isInside("/w", "/w/x", "/"), false);
});

test("addArgs is detached and removeArgs never forces, each path after --", () => {
  assert.deepEqual(addArgs("/r", "/w/x", "origin/main"), [
    "-C",
    "/r",
    "worktree",
    "add",
    "-q",
    "--detach",
    "--",
    "/w/x",
    "origin/main",
  ]);
  assert.deepEqual(removeArgs("/r", "--force"), [
    "-C",
    "/r",
    "worktree",
    "remove",
    "--",
    "--force",
  ]);
  assert.equal(runsInShell("win32", "pnpm"), true);
  assert.equal(runsInShell("win32", "git"), false);
  assert.equal(runsInShell("darwin", "pnpm"), false);
});

test("createStep, marksSession, installsDeps and restoresHooks decide creation", () => {
  assert.equal(createStep(false, "own-repo", true, true), "bad-name");
  assert.equal(createStep(true, "no-repo", true, true), "no-layout");
  assert.equal(createStep(true, "own-repo", true, false), "refuse");
  assert.equal(createStep(true, "project-repo", true, true), "re-enter");
  assert.equal(createStep(true, "enclosing-repo", false, false), "add-new");
  assert.equal(marksSession(""), false);
  assert.equal(marksSession("s1"), true);
  assert.equal(installsDeps("feat", true), true);
  assert.equal(installsDeps("feat", false), false);
  assert.equal(installsDeps("agent-a1", true), false);
  assert.equal(restoresHooks([false, true], true), true);
  assert.equal(restoresHooks([false, false], true), false);
  assert.equal(restoresHooks([true], false), false);
  assert.equal(restoresHooks([], true), false);
});

/** The augur-skills hook's workProblem, as a tag: what heldBy replaces (trim aside). */
function oracleHeld(
  statusExit: number,
  status: string,
  unsavedExit: number,
  unsaved: string,
  branchExit: number,
): Held {
  if (statusExit !== 0 || unsavedExit !== 0 || (branchExit !== 0 && branchExit !== 1))
    return "unreadable";
  if (status !== "") return "uncommitted";
  if (unsaved !== "") return "unpushed";
  return branchExit === 0 ? "on-branch" : "no-work";
}

type Facts = [number, string, number, string, number];

/** `facts` with its k-th fact replaced. */
function withFact(facts: Facts, k: number, option: number | string): Facts {
  const next = [...facts];
  next[k] = option;
  return next as Facts;
}

test("heldBy counts every kind of work, and a failed or unfinished check, as work", () => {
  let all: Facts[] = [[0, "", 0, "", 0]];
  const choices: (number | string)[][] = [
    [-1, 0, 1, 128],
    ["", "?? x\n", "\n"],
    [-1, 0, 128],
    ["", "abc\n"],
    [-1, 0, 1, 2, 128],
  ];
  for (const [k, options] of choices.entries()) {
    all = all.flatMap((facts) => options.map((option) => withFact(facts, k, option)));
  }
  const mismatches = all.filter((f) => heldBy(...f) !== oracleHeld(...f));
  assert.equal(all.length, 4 * 3 * 3 * 2 * 5);
  assert.deepEqual(mismatches, []);
});

test("the verdicts remove only a worktree that holds no work", () => {
  const all: Held[] = ["unreadable", "uncommitted", "unpushed", "on-branch", "no-work"];
  for (const held of all) {
    const clean = held === "no-work";
    assert.equal(removeVerdict(true, true, held), clean ? "remove-it" : "keep-it");
    assert.equal(removeVerdict(false, true, held), "keep-it");
    assert.equal(removeVerdict(true, false, held), "keep-it");
    assert.equal(removeExit(removeVerdict(true, true, held), 0), clean ? 0 : 1);
    assert.equal(subagentVerdict("a1", true, held), clean ? "remove-it" : "keep-it");
    assert.equal(sessionVerdict("s1", "other", "s1", false, held), clean ? "remove-it" : "keep-it");
  }
  assert.equal(removeLooks(true, true), true);
  assert.equal(removeLooks(false, true), false);
  assert.equal(removeLooks(true, false), false);
  assert.equal(removeExit("remove-it", 128), 1);
  assert.equal(removeExit("remove-it", -1), 1);
  assert.equal(removeExit("keep-it", 0), 1);
  assert.equal(subagentVerdict("a1", false, "no-work"), "keep-it");
  assert.equal(subagentVerdict("../x", true, "no-work"), "keep-it");
});

test("session end runs except on /clear and /resume, and picks only its own worktrees", () => {
  assert.equal(sessionEndRuns("s1", "other"), true);
  assert.equal(sessionEndRuns("s1", "logout"), true);
  assert.equal(sessionEndRuns("", "other"), false);
  assert.equal(sessionEndRuns("s1", "clear"), false);
  assert.equal(sessionEndRuns("s1", "resume"), false);
  assert.equal(sessionPicks("s1", "s1", false), true);
  assert.equal(sessionPicks("s1", "s2", false), false);
  assert.equal(sessionPicks("s1", "s1\n", false), false);
  assert.equal(sessionPicks("s1", "s1", true), false);
  assert.equal(sessionPicks("", "", false), false);
  assert.equal(sessionVerdict("s1", "clear", "s1", false, "no-work"), "keep-it");
  assert.equal(sessionVerdict("s1", "other", "s2", false, "no-work"), "keep-it");
  assert.equal(sessionVerdict("s1", "other", "s1", true, "no-work"), "keep-it");
});

/** The augur-skills hook's listing: every `worktree ` line's path but the first. */
const oracleLinked = (lines: string[]) =>
  lines
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .slice(1);

test("linkedPaths lists every linked worktree but the main checkout", () => {
  const porcelain =
    "worktree /r\nHEAD a\nbranch refs/heads/main\n\nworktree /w/x\nHEAD b\ndetached\n";
  assert.deepEqual(linkedPaths(porcelain.split("\n")), ["/w/x"]);
  assert.deepEqual(linkedPaths([]), []);
  assert.deepEqual(linkedPaths(["worktree /r"]), []);
  assert.deepEqual(
    linkedPaths(["HEAD a", "worktree /r", "worktree /a", "worktree", "worktree /b"]),
    ["/a", "/b"],
  );
});

test("isLinkedWorktree is membership in linkedPaths: never the main checkout", () => {
  const lines = ["worktree /r", "HEAD a", "", "worktree /w/x", "worktree /w/y"];
  for (const path of ["/r", "/w/x", "/w/y", "/w", "/w/x/", "", "/w/z"])
    assert.equal(isLinkedWorktree(lines, path), oracleLinked(lines).includes(path), path);
  assert.equal(isLinkedWorktree([], ""), false);
});

/** The characters cmd.exe reads in a quoted line, which shellSafe replaces. */
const SHELL_SAFE = /^[^"%!&|<>^\r\n]*$/;

test("shellSafe agrees with its regex on every code unit; runPlan refuses what it rejects", () => {
  const mismatches: number[] = [];
  for (let c = 0; c < 65536; c++) {
    const s = `a${String.fromCharCode(c)}b`;
    if (shellSafe(s) !== SHELL_SAFE.test(s)) mismatches.push(c);
  }
  assert.deepEqual(mismatches, []);
  assert.equal(shellSafe(""), true);
  assert.equal(runPlan("darwin", "pnpm", ["a&b"]), "direct");
  assert.equal(runPlan("win32", "git", ["a&b"]), "direct");
  assert.equal(runPlan("win32", "pnpm", []), "via-shell");
  assert.equal(runPlan("win32", "pnpm", ["--dir", "C:\\a b"]), "via-shell");
  assert.equal(runPlan("win32", "pnpm", ["--dir", "C:\\a b", "100%"]), "refused-shell");
});

const N = 100_000;

test("every walk runs on 100,000 elements and matches its oracle", () => {
  const long = "a".repeat(N);
  assert.equal(isWorktreeName(long), true);
  assert.equal(isWorktreeName(`${long}..`), false);
  assert.equal(isWorktreeName(`${long}/`), false);
  const lines = Array.from({ length: N }, (_, k) =>
    k % 2 === 0 ? `worktree /w/${k}` : "detached",
  );
  assert.deepEqual(linkedPaths(lines), oracleLinked(lines));
  assert.equal(modeOf([...Array.from({ length: N }, () => "dev"), "head"]), "from-head");
  assert.equal(restoresHooks([...Array.from({ length: N }, () => false), true], true), true);
  assert.equal(isLinkedWorktree(lines, `/w/${N - 2}`), true);
  assert.equal(isLinkedWorktree(lines, "/w/0"), false);
  assert.equal(shellSafe(`${"a".repeat(N)}&`), false);
  assert.equal(
    runPlan(
      "win32",
      "pnpm",
      Array.from({ length: N }, () => "a"),
    ),
    "via-shell",
  );
});
