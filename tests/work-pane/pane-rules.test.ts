// Pins each proved rule in pane-rules.ts to the runtime: the proof says what the Dafny model
// decides; these say JavaScript decides the same, against the expression each rule replaced in
// the pane it ports (GH #14) as the oracle, over every combination or thousands of inputs.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CLOSED_TTL_MS,
  countColour,
  countMark,
  hasChanges,
  hasLeft,
  hasOwner,
  isDue,
  isEdited,
  isIssueIdOf,
  isProjectId,
  isRecentlyClosed,
  isTrackedIssue,
  isTrackedTodo,
  nextRetries,
  notesBriefProblem,
  outcomeOf,
  pendingOf,
  shouldRetry,
  skipsClosed,
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

const next = random(20261122);
const BOOLS = [false, true];
/** Integers around each rule's edges, plus random ones. */
const INTS = [
  -1,
  0,
  1,
  2,
  9,
  10,
  11,
  12,
  7,
  8,
  294999,
  295000,
  604799999,
  604800000,
  604800001,
  ...Array.from({ length: 40 }, () => Math.floor(next() * 2e9) - 1e9),
];

/** Every combination of four booleans. */
function* bools4(): Generator<[boolean, boolean, boolean, boolean]> {
  for (const a of BOOLS)
    for (const b of BOOLS) for (const c of BOOLS) for (const d of BOOLS) yield [a, b, c, d];
}

test("countColour: red over 10, green at a complete 0, else plain", () => {
  const oracle = (open: number | undefined, complete: boolean) => {
    if (open === undefined) return "plain";
    if (open > 10) return "red";
    return open === 0 && complete ? "green" : "plain";
  };
  for (const open of INTS)
    for (const complete of BOOLS) {
      assert.equal(countColour(true, open, complete), oracle(open, complete), `${open}`);
      assert.equal(countColour(false, open, complete), oracle(undefined, complete));
    }
});

test("countMark: + only on a partial count", () => {
  assert.equal(countMark(true), "");
  assert.equal(countMark(false), "+");
});

test("isTrackedTodo and isTrackedIssue need every condition", () => {
  for (const [a, b, c, d] of bools4()) {
    assert.equal(isTrackedTodo(a, b, c, d), a && b && c && d);
    assert.equal(isTrackedIssue(a, b, c, d), a && b && c && d);
  }
});

test("isIssueIdOf: the prefix, then one or more digits", () => {
  const prefix = "gh-site-";
  const oracle = (id: string) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length));
  const alphabet = ["g", "h", "-", "s", "i", "t", "e", "0", "1", "9", "a", "/"];
  const ids = [
    "gh-site-1",
    "gh-site-12",
    "gh-site-",
    "gh-site-1a",
    "gh-sites-1",
    "gh-site",
    "",
    "gh-site-007",
  ];
  for (let n = 0; n < 4000; n++) {
    let tail = "";
    const length = Math.floor(next() * 5);
    for (let i = 0; i < length; i++) tail += alphabet[Math.floor(next() * alphabet.length)];
    ids.push(next() < 0.7 ? `${prefix}${tail}` : tail);
  }
  for (const id of ids) assert.equal(isIssueIdOf(id, prefix), oracle(id), JSON.stringify(id));
});

test("hasOwner: a / anywhere", () => {
  for (const repo of ["site", "org/site", "/", "site/", "", "a-b", "a/b/c"])
    assert.equal(hasOwner(repo), repo.includes("/"), repo);
});

test("isProjectId: positive only", () => {
  for (const id of INTS) assert.equal(isProjectId(id), id > 0);
});

test("isEdited: unknown on either side, or different times", () => {
  // The pane compared Date.parse results with !==, so NaN (unparseable) never matched
  const oracle = (local: number, remote: number) => local !== remote;
  for (const [lk, rk] of [
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ] as const)
    for (const a of INTS.slice(0, 15))
      for (const b of INTS.slice(0, 15))
        assert.equal(isEdited(lk, a, rk, b), oracle(lk ? a : NaN, rk ? b : NaN));
});

test("hasLeft: off the list, with a project, and mine or linked", () => {
  for (const [onList, hasProject, linked, mine] of bools4())
    assert.equal(
      hasLeft(onList, hasProject, linked, mine),
      !onList && hasProject && (linked || mine),
    );
});

test("isRecentlyClosed and skipsClosed: within 7 days", () => {
  assert.equal(CLOSED_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  const oracle = (now: number, at: number | undefined) =>
    !(now - (at ?? -Infinity) >= CLOSED_TTL_MS);
  for (const now of INTS)
    for (const at of INTS) {
      assert.equal(isRecentlyClosed(now, at), now - at < CLOSED_TTL_MS);
      assert.equal(skipsClosed(true, now, at), oracle(now, at));
      assert.equal(skipsClosed(false, now, at), oracle(now, undefined));
    }
});

test("isDue: never checked, or the interval less 5 seconds has passed", () => {
  const oracle = (last: number | undefined, now: number, minutes: number) =>
    last === undefined || now - last >= minutes * 60 * 1000 - 5000;
  for (const minutes of [0, 1, 5, 15, 60])
    for (const now of INTS)
      for (const last of INTS) {
        assert.equal(isDue(true, last, now, minutes), oracle(last, now, minutes));
        assert.equal(isDue(false, last, now, minutes), oracle(undefined, now, minutes));
      }
});

test("shouldRetry and nextRetries: at most 8 retries in a row", () => {
  for (const notLoaded of BOOLS)
    for (let retries = 0; retries <= 9; retries++) {
      // The pane's own update: retry and count up while under the limit; reset once reached
      const retry = notLoaded && retries < 8;
      const after = retry ? retries + 1 : notLoaded ? retries : 0;
      assert.equal(shouldRetry(notLoaded, retries), retry);
      assert.equal(nextRetries(notLoaded, retries), after);
    }
});

/** The pane's pendingLabel, as a tag: undefined pending is "not checked". */
function pendingLabel(checked: boolean, neverSynced: boolean, basecamp: number, github: number) {
  if (!checked) return "not-checked";
  if (neverSynced) return "never-synced";
  return basecamp || github ? "changed" : "up-to-date";
}

test("pendingOf and hasChanges agree with the pane's label and Sync", () => {
  const counts = [0, 1, 3];
  for (const checked of BOOLS)
    for (const neverSynced of BOOLS)
      for (const basecamp of counts)
        for (const github of counts) {
          const changes = checked && (neverSynced || basecamp > 0 || github > 0);
          assert.equal(
            pendingOf(checked, neverSynced, basecamp, github),
            pendingLabel(checked, neverSynced, basecamp, github),
          );
          assert.equal(hasChanges(checked, neverSynced, basecamp, github), changes);
        }
});

test("outcomeOf: did not run, then locked, then failed, else synced", () => {
  for (const ran of BOOLS)
    for (const locked of BOOLS)
      for (const failed of BOOLS) {
        const expected = !ran ? "did-not-run" : locked ? "locked" : failed ? "failed" : "synced";
        assert.equal(outcomeOf(ran, locked, failed), expected);
      }
});

test("notesBriefProblem: only a sync that synced notes it", () => {
  for (const synced of BOOLS)
    for (const hasProblem of BOOLS)
      assert.equal(notesBriefProblem(synced, hasProblem), synced && hasProblem);
});
