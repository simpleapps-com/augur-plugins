// The model of the repo skill's decisions (plugins/augur-build/skills/repo). Hand-written Dafny.
// Nothing is generated from this file. `plugins/augur-build/skills/repo/scripts/cleanup-rules.ts`
// is proved with LemmaScript and linked to it in `models/links/cleanup-rules.dfy`.
//
// Criterion ids name the tracking issue (GH5: the augur-skills migration) and the rule.

module Repo {

  // ---------------------------------------------------------------- cleanup (references/cleanup.md)
  //
  // Cleanup runs after work has merged. It may move to the default branch, then decides, for each
  // local branch, whether to delete it. The facts it decides from are gathered by the shell after
  // the move and `fetch --prune`: each branch's tip, the head commits (`headRefOid`) of the merged
  // PRs from that branch, and whether `git branch --merged <default>` lists it. A squash merge leaves
  // git calling the branch unmerged, so the PR head is the main evidence.

  datatype Action = ForceDelete | SafeDelete | Keep   // `branch -D`, `branch -d`, nothing

  datatype Branch = Branch(name: string, tip: string, mergedHeads: seq<string>, listedMerged: bool)

  // The clone when cleanup starts: uncommitted changes, the branch checked out, the default branch,
  // and whether the checked-out branch has an open PR.
  datatype Start = Start(dirty: bool, current: string, defaultBranch: string, currentOpenPr: bool)

  // A branch with an open PR stays checked out: review fixes land on it.
  predicate Stays(s: Start)
  {
    s.current != s.defaultBranch && s.currentOpenPr
  }

  // Uncommitted changes: nothing moves and nothing is deleted.
  predicate Moves(s: Start)
  {
    !s.dirty && !Stays(s)
  }

  // `switch <default>`, then `merge --ff-only origin/<default>`.
  predicate Switches(s: Start) { Moves(s) && s.current != s.defaultBranch }
  predicate FastForwards(s: Start) { Moves(s) }

  // The branch checked out once the move is done.
  function EndsOn(s: Start): string
  {
    if Switches(s) then s.defaultBranch else s.current
  }

  // GH5 cleanup-1 to cleanup-3: the per-branch rule, for a branch other than the default and the
  // one checked out. `-D` only when the tip is exactly a merged PR's head; else `-d` when git
  // itself calls it merged; else keep it, since it holds work no merge contains.
  function Decide(b: Branch, defaultBranch: string, onBranch: string): Action
  {
    if b.name == defaultBranch || b.name == onBranch then Keep
    else if b.tip in b.mergedHeads then ForceDelete
    else if b.listedMerged then SafeDelete
    else Keep
  }

  // The step for one branch once the move is done: the shell re-reads the tree and the branch now
  // checked out, then asks for each branch.
  function StepFor(dirty: bool, b: Branch, defaultBranch: string, onBranch: string): Action
  {
    if dirty then Keep else Decide(b, defaultBranch, onBranch)
  }

  function BranchAction(s: Start, b: Branch): Action
  {
    StepFor(s.dirty, b, s.defaultBranch, EndsOn(s))
  }

  // GH5 cleanup-1: a branch is deleted only when its work is merged. `-D`, which git does not
  // check, needs the tip to equal a merged PR's head; `-d` needs git to list it as merged.
  lemma DeletesOnlyMergedWork(s: Start, b: Branch)
    ensures BranchAction(s, b) == ForceDelete ==> b.tip in b.mergedHeads
    ensures BranchAction(s, b) == SafeDelete ==> b.listedMerged
    ensures BranchAction(s, b) != Keep ==> b.tip in b.mergedHeads || b.listedMerged
  {
  }

  // GH5 cleanup-2: the default branch and the branch left checked out are never deleted.
  lemma NeverDeletesDefaultOrCheckedOut(s: Start, b: Branch)
    requires b.name == s.defaultBranch || b.name == EndsOn(s)
    ensures BranchAction(s, b) == Keep
  {
  }

  // GH5 cleanup-3: with a clean tree, every other branch whose work is merged is deleted, and a
  // kept one is exactly a branch with unmerged work (both directions of cleanup-1).
  lemma DeletesAllMergedWork(s: Start, b: Branch)
    requires !s.dirty && b.name != s.defaultBranch && b.name != EndsOn(s)
    ensures b.tip in b.mergedHeads ==> BranchAction(s, b) == ForceDelete
    ensures b.tip !in b.mergedHeads && b.listedMerged ==> BranchAction(s, b) == SafeDelete
    ensures BranchAction(s, b) == Keep <==> b.tip !in b.mergedHeads && !b.listedMerged
  {
  }

  // GH5 cleanup-4: uncommitted changes: no switch, no fast-forward, no delete.
  lemma DirtyTreeTouchesNothing(s: Start, b: Branch)
    requires s.dirty
    ensures !Switches(s) && !FastForwards(s) && EndsOn(s) == s.current
    ensures BranchAction(s, b) == Keep
  {
  }

  // GH5 cleanup-5: a branch with an open PR stays checked out and is kept; nothing moves.
  lemma OpenPrStays(s: Start, b: Branch)
    requires Stays(s)
    ensures !Switches(s) && !FastForwards(s) && EndsOn(s) == s.current
    ensures b.name == s.current ==> BranchAction(s, b) == Keep
  {
  }

  // GH5 cleanup-6: otherwise, with a clean tree, cleanup ends on the default branch.
  lemma EndsOnDefault(s: Start)
    requires !s.dirty && !Stays(s)
    ensures EndsOn(s) == s.defaultBranch && FastForwards(s)
  {
  }

  // GH5 cleanup-7: the branch just merged, left by the switch, is deleted when its tip is the PR's
  // head. This is what cleanup is for: after `submit`, the feature branch goes.
  lemma DeletesTheBranchJustMerged(s: Start, b: Branch)
    requires !s.dirty && s.current != s.defaultBranch && !s.currentOpenPr
    requires b.name == s.current && b.tip in b.mergedHeads
    ensures Switches(s) && BranchAction(s, b) == ForceDelete
  {
  }

  // ---------------------------------------------------------------- refuted designs, kept so they stay out

  // Deleting any branch that has a merged PR, by name, without comparing the tip. Tempting, since
  // `gh pr list --head <branch> --state merged` already answers "was it merged?".
  function OldDecideByName(b: Branch, defaultBranch: string, onBranch: string): Action
  {
    if b.name == defaultBranch || b.name == onBranch then Keep
    else if |b.mergedHeads| > 0 then ForceDelete
    else if b.listedMerged then SafeDelete
    else Keep
  }

  // It force-deletes commits made after the PR merged: the tip `t2` is not the merged head `t1`.
  lemma OldDecideByNameLosesWork()
    ensures var b := Branch("feat/x", "t2", ["t1"], false);
            OldDecideByName(b, "main", "main") == ForceDelete && b.tip !in b.mergedHeads
  {
  }

  // The first build switched to the default branch whenever the tree was clean, even while the
  // branch's PR was still open (Fable's second review, finding 3: `repo-merge: none`).
  function OldEndsOn(s: Start): string
  {
    if s.dirty then s.current else s.defaultBranch
  }

  // It leaves a branch whose PR is still open, so review fixes land on the default branch.
  lemma OldEndsOnStrandsOpenPr()
    ensures var s := Start(false, "feat/x", "main", true);
            Stays(s) && OldEndsOn(s) != s.current && EndsOn(s) == s.current
  {
  }
}
