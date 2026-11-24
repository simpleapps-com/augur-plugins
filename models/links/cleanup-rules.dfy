// Links plugins/augur-build/skills/repo/scripts/cleanup-rules.ts (its proved .dfy) to the model,
// models/Repo.dfy: every exported rule decides exactly what the model says.
include "../../plugins/augur-build/skills/repo/scripts/cleanup-rules.dfy"
include "../Repo.dfy"

function StepOf(a: Repo.Action): BranchStep
{
  match a
  case ForceDelete => BranchStep.force_delete
  case SafeDelete => BranchStep.safe_delete
  case Keep => BranchStep.keep
}

lemma HeadsHoldFromMatchesModel(heads: seq<string>, tip: string, i: nat)
  requires i <= |heads|
  ensures headsHoldFrom(heads, tip, i) == (tip in heads[i..])
  decreases |heads| - i
{
  if i < |heads| { HeadsHoldFromMatchesModel(heads, tip, i + 1); assert heads[i..] == [heads[i]] + heads[i + 1..]; }
}

lemma TipIsMergedHeadMatchesModel(heads: seq<string>, tip: string)
  ensures tipIsMergedHead(heads, tip) == (tip in heads)
{
  HeadsHoldFromMatchesModel(heads, tip, 0);
  assert heads[0..] == heads;
}

lemma MoveMatchesModel(dirty: bool, current: string, defaultBranch: string, currentOpenPr: bool)
  ensures var s := Repo.Start(dirty, current, defaultBranch, currentOpenPr);
          staysOnBranch(current, defaultBranch, currentOpenPr) == Repo.Stays(s) &&
          fastForwards(dirty, current, defaultBranch, currentOpenPr) == Repo.FastForwards(s) &&
          switchesToDefault(dirty, current, defaultBranch, currentOpenPr) == Repo.Switches(s) &&
          endsOn(dirty, current, defaultBranch, currentOpenPr) == Repo.EndsOn(s)
{
}

lemma DecideMatchesModel(name: string, tip: string, mergedHeads: seq<string>, listedMerged: bool, defaultBranch: string, onBranch: string)
  ensures decide(name, tip, mergedHeads, listedMerged, defaultBranch, onBranch) ==
          StepOf(Repo.Decide(Repo.Branch(name, tip, mergedHeads, listedMerged), defaultBranch, onBranch))
{
  TipIsMergedHeadMatchesModel(mergedHeads, tip);
}

lemma BranchStepMatchesModel(dirty: bool, name: string, tip: string, mergedHeads: seq<string>, listedMerged: bool, defaultBranch: string, onBranch: string)
  ensures branchStep(dirty, name, tip, mergedHeads, listedMerged, defaultBranch, onBranch) ==
          StepOf(Repo.StepFor(dirty, Repo.Branch(name, tip, mergedHeads, listedMerged), defaultBranch, onBranch))
{
  DecideMatchesModel(name, tip, mergedHeads, listedMerged, defaultBranch, onBranch);
}

// The whole run: deciding each branch with the branch `endsOn` gives is the model's BranchAction.
lemma RunMatchesModel(dirty: bool, current: string, defaultBranch: string, currentOpenPr: bool, name: string, tip: string, mergedHeads: seq<string>, listedMerged: bool)
  ensures var s := Repo.Start(dirty, current, defaultBranch, currentOpenPr);
          branchStep(dirty, name, tip, mergedHeads, listedMerged, defaultBranch, endsOn(dirty, current, defaultBranch, currentOpenPr)) ==
          StepOf(Repo.BranchAction(s, Repo.Branch(name, tip, mergedHeads, listedMerged)))
{
  MoveMatchesModel(dirty, current, defaultBranch, currentOpenPr);
  BranchStepMatchesModel(dirty, name, tip, mergedHeads, listedMerged, defaultBranch, endsOn(dirty, current, defaultBranch, currentOpenPr));
}
