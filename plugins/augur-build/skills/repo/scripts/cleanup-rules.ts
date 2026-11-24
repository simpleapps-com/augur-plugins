//@ backend dafny

/* The repo skill's cleanup decisions, each a small pure function proved with LemmaScript → Dafny
   (`pnpm proofs`; model: models/Repo.dfy; link: models/links/cleanup-rules.dfy).
   `cleanup-plan.ts` reads the facts the skill gathered and calls these for every decision. */

/** What cleanup does with one local branch: `branch -D`, `branch -d`, or nothing. */
export type BranchStep = "force-delete" | "safe-delete" | "keep";

/** `heads` holds `tip` from `i` on. */
function headsHoldFrom(heads: string[], tip: string, i: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  let j = i;
  while (j < heads.length && heads[j] !== tip) {
    //@ invariant i <= j
    //@ decreases heads.length - j
    j = j + 1;
  }
  return j < heads.length;
}

/** The branch's tip is exactly the head commit of one of its merged PRs. */
export function tipIsMergedHead(heads: string[], tip: string): boolean {
  //@ verify
  return headsHoldFrom(heads, tip, 0);
}

/** A branch with an open PR stays checked out: review fixes land on it. */
export function staysOnBranch(
  current: string,
  defaultBranch: string,
  currentOpenPr: boolean,
): boolean {
  //@ verify
  return current !== defaultBranch && currentOpenPr;
}

/** Fast-forward the default branch: a clean tree, not staying on an open PR's branch. */
export function fastForwards(
  dirty: boolean,
  current: string,
  defaultBranch: string,
  currentOpenPr: boolean,
): boolean {
  //@ verify
  return !dirty && !staysOnBranch(current, defaultBranch, currentOpenPr);
}

/** Switch to the default branch first: moving, and not on it already. */
export function switchesToDefault(
  dirty: boolean,
  current: string,
  defaultBranch: string,
  currentOpenPr: boolean,
): boolean {
  //@ verify
  return fastForwards(dirty, current, defaultBranch, currentOpenPr) && current !== defaultBranch;
}

/** The branch checked out once the move is done. */
export function endsOn(
  dirty: boolean,
  current: string,
  defaultBranch: string,
  currentOpenPr: boolean,
): string {
  //@ verify
  return switchesToDefault(dirty, current, defaultBranch, currentOpenPr) ? defaultBranch : current;
}

/** One branch, after the move: `-D` only on a tip that is a merged PR's head, `-d` when git lists
    it as merged, otherwise keep it. The default branch and the one checked out are always kept. */
export function decide(
  name: string,
  tip: string,
  mergedHeads: string[],
  listedMerged: boolean,
  defaultBranch: string,
  onBranch: string,
): BranchStep {
  //@ verify
  if (name === defaultBranch || name === onBranch) return "keep";
  if (tipIsMergedHead(mergedHeads, tip)) return "force-delete";
  if (listedMerged) return "safe-delete";
  return "keep";
}

/** The step for one branch: uncommitted changes keep every branch. */
export function branchStep(
  dirty: boolean,
  name: string,
  tip: string,
  mergedHeads: string[],
  listedMerged: boolean,
  defaultBranch: string,
  onBranch: string,
): BranchStep {
  //@ verify
  return dirty ? "keep" : decide(name, tip, mergedHeads, listedMerged, defaultBranch, onBranch);
}
