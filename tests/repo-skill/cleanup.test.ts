// Pins the repo skill's cleanup rules (cleanup-rules.ts) to the runtime: the proof says what the
// Dafny model (models/Repo.dfy) decides; these say JavaScript decides the same, against the rule as
// cleanup.md states it, over every combination of small inputs. Then the CLI around them.
import assert from "node:assert/strict";
import { test } from "node:test";

import { runCleanupPlan } from "../../plugins/augur-build/skills/repo/scripts/cleanup-cli.ts";
import {
  branchStep,
  decide,
  endsOn,
  fastForwards,
  staysOnBranch,
  switchesToDefault,
  tipIsMergedHead,
} from "../../plugins/augur-build/skills/repo/scripts/cleanup-rules.ts";

const NAMES = ["main", "feat/a", "feat/b"];
const TIPS = ["t1", "t2"];
const HEADS = [[], ["t1"], ["t2"], ["t1", "t2"], ["t3", "t1"]];
const BOOLS = [false, true];

/** cleanup.md step 4, written plainly. */
function oracle(
  dirty: boolean,
  name: string,
  tip: string,
  heads: string[],
  listed: boolean,
  def: string,
  on: string,
): string {
  if (dirty || name === def || name === on) return "keep";
  if (heads.includes(tip)) return "force-delete";
  return listed ? "safe-delete" : "keep";
}

test("tipIsMergedHead is membership", () => {
  for (const heads of HEADS) {
    for (const tip of [...TIPS, "t3", ""])
      assert.equal(tipIsMergedHead(heads, tip), heads.includes(tip));
  }
});

test("tipIsMergedHead walks 100,000 heads", () => {
  const heads = Array.from({ length: 100_000 }, (_, k) => `h${k}`);
  assert.equal(tipIsMergedHead(heads, "h99999"), true);
  assert.equal(tipIsMergedHead(heads, "missing"), false);
});

test("the move: stay on an open PR, else switch and fast-forward on a clean tree", () => {
  const seen: string[] = [];
  for (const dirty of BOOLS) {
    for (const current of NAMES) {
      for (const openPr of BOOLS) {
        const stays = current !== "main" && openPr;
        assert.equal(staysOnBranch(current, "main", openPr), stays);
        assert.equal(fastForwards(dirty, current, "main", openPr), !dirty && !stays);
        const switches = !dirty && !stays && current !== "main";
        assert.equal(switchesToDefault(dirty, current, "main", openPr), switches);
        assert.equal(endsOn(dirty, current, "main", openPr), switches ? "main" : current);
        seen.push(endsOn(dirty, current, "main", openPr));
      }
    }
  }
  assert.ok(seen.includes("main") && seen.includes("feat/a"));
});

interface Case {
  dirty: boolean;
  name: string;
  on: string;
  tip: string;
  heads: string[];
  listed: boolean;
}

/** Every combination of the small domains above. */
function allCases(): Case[] {
  const cases: Case[] = [];
  const shapes = NAMES.flatMap((name) =>
    NAMES.flatMap((on) => TIPS.map((tip) => ({ name, on, tip }))),
  );
  for (const dirty of BOOLS) {
    for (const shape of shapes) {
      for (const heads of HEADS) {
        cases.push(
          { dirty, ...shape, heads, listed: false },
          { dirty, ...shape, heads, listed: true },
        );
      }
    }
  }
  return cases;
}

test("every branch step matches cleanup.md", () => {
  const mismatches: string[] = [];
  const cases = allCases();
  assert.equal(cases.length, 2 * 3 * 3 * 2 * HEADS.length * 2);
  for (const c of cases) {
    const want = oracle(c.dirty, c.name, c.tip, c.heads, c.listed, "main", c.on);
    if (branchStep(c.dirty, c.name, c.tip, c.heads, c.listed, "main", c.on) !== want) {
      mismatches.push(JSON.stringify(c));
    }
    if (!c.dirty && decide(c.name, c.tip, c.heads, c.listed, "main", c.on) !== want) {
      mismatches.push(`decide ${JSON.stringify(c)}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("a tip that moved after the merge is kept, not force-deleted", () => {
  assert.equal(decide("feat/a", "t2", ["t1"], false, "main", "main"), "keep");
  assert.equal(decide("feat/a", "t2", ["t1"], true, "main", "main"), "safe-delete");
});

function run(mode: string, input: unknown): { code: number; json: Record<string, unknown> } {
  const r = runCleanupPlan([mode, JSON.stringify(input)]);
  return { code: r.code, json: JSON.parse(r.output) as Record<string, unknown> };
}

test("CLI move", () => {
  const r = run("move", { dirty: false, current: "feat/a", default: "main", currentOpenPr: false });
  assert.equal(r.code, 0);
  assert.deepEqual(r.json, { stays: false, switch: true, fastForward: true, endsOn: "main" });
});

test("CLI branches, with a reason for each step", () => {
  const branches = [
    { name: "main", tip: "t0", mergedHeads: [], listedMerged: true },
    { name: "feat/a", tip: "t1", mergedHeads: ["t1"], listedMerged: false },
    { name: "feat/b", tip: "t2", mergedHeads: [], listedMerged: true },
    { name: "feat/c", tip: "t3", mergedHeads: ["t1"], listedMerged: false },
  ];
  const clean = run("branches", { dirty: false, current: "main", default: "main", branches });
  assert.equal(clean.code, 0);
  assert.deepEqual(clean.json, {
    branches: [
      { name: "main", step: "keep", reason: "the default or checked-out branch" },
      { name: "feat/a", step: "force-delete", reason: "its tip is a merged PR's head commit" },
      { name: "feat/b", step: "safe-delete", reason: "git lists it as merged" },
      { name: "feat/c", step: "keep", reason: "it holds work no merge contains" },
    ],
  });
  const dirty = run("branches", {
    dirty: true,
    current: "main",
    default: "main",
    branches: [branches[1]],
  });
  assert.deepEqual(dirty.json, {
    branches: [{ name: "feat/a", step: "keep", reason: "uncommitted changes: nothing is deleted" }],
  });
});

test("CLI refuses bad input with exit code 2", () => {
  const bad: string[][] = [
    [],
    ["move"],
    ["move", "{}", "extra"],
    ["move", "not json"],
    ["move", "[]"],
    ["move", "null"],
    [
      "move",
      JSON.stringify({ dirty: false, current: "-f", default: "main", currentOpenPr: false }),
    ],
    ["branches", JSON.stringify({ dirty: false, current: "main", default: "main", branches: "x" })],
    [
      "branches",
      JSON.stringify({
        dirty: false,
        current: "main",
        default: "main",
        branches: [{ name: "a", tip: "t", mergedHeads: ["--all"], listedMerged: false }],
      }),
    ],
    ["delete", "{}"],
  ];
  for (const args of bad) {
    const r = runCleanupPlan(args);
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.ok("error" in (JSON.parse(r.output) as object));
  }
});
