// Links plugins/simpleapps-worktrees/scripts/worktree-rules.ts (its proved .dfy) to the model,
// models/Worktrees.dfy: every exported rule decides exactly what the model says. The code's
// string unions are mapped to the model's datatypes (`As...`).
include "../../plugins/simpleapps-worktrees/scripts/worktree-rules.dfy"
include "../Worktrees.dfy"

// ---------------------------------------------------------------- the code's unions, as the model's

function AsLayout(l: Layout): Worktrees.Layout
{
  match l
  case own_repo => Worktrees.OwnRepo
  case project_repo => Worktrees.ProjectRepo
  case enclosing_repo => Worktrees.EnclosingRepo
  case no_repo => Worktrees.NoRepo
}

function AsBase(m: BaseMode): Worktrees.Base
{
  match m
  case from_remote => Worktrees.FromRemote
  case from_head => Worktrees.FromHead
}

function AsStep(c: CreateStep): Worktrees.CreateStep
{
  match c
  case bad_name => Worktrees.BadName
  case no_layout => Worktrees.NoLayout
  case refuse => Worktrees.Refuse
  case re_enter => Worktrees.ReEnter
  case add_new => Worktrees.AddNew
}

function AsHeld(h: Held): Worktrees.Held
{
  match h
  case unreadable => Worktrees.Unreadable
  case uncommitted => Worktrees.Uncommitted
  case unpushed => Worktrees.Unpushed
  case on_branch => Worktrees.OnBranch
  case no_work => Worktrees.NoWork
}

function AsVerdict(v: Verdict): Worktrees.Verdict
{
  match v
  case remove_it => Worktrees.Remove
  case keep_it => Worktrees.Keep
}

function AsPlan(p: RunPlan): Worktrees.RunPlan
{
  match p
  case direct => Worktrees.Direct
  case via_shell => Worktrees.ViaShell
  case refused_shell => Worktrees.RefusedShell
}

// ---------------------------------------------------------------- the two shared scans
// The only scan inductions in this file: the code's wtRunEnd and wtListEnd are Text's ScanEnd and
// ListEnd for every test.

lemma WtRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures forall ok: int -> bool :: wtRunEnd(s, i, ok) == Text.ScanEnd(s, i, ok)
{
  forall ok: int -> bool ensures wtRunEnd(s, i, ok) == Text.ScanEnd(s, i, ok) { WtRunEndIsScanEnd(s, i, ok); }
}

lemma WtRunEndIsScanEnd(s: string, i: nat, ok: int -> bool)
  requires i <= |s|
  ensures wtRunEnd(s, i, ok) == Text.ScanEnd(s, i, ok)
  decreases |s| - i
{
  if i < |s| { WtRunEndIsScanEnd(s, i + 1, ok); }
}

lemma WtListEndMatchesModel<T>(xs: seq<T>, i: nat)
  requires i <= |xs|
  ensures forall ok: T -> bool :: wtListEnd(xs, i, ok) == Text.ListEnd(xs, i, ok)
  decreases |xs| - i
{
  if i < |xs| { WtListEndMatchesModel(xs, i + 1); }
}

lemma WtHasPrefixMatchesModel(s: string, p: string)
  ensures wtHasPrefix(s, p) == Worktrees.HasPrefix(s, p)
{
}

// ---------------------------------------------------------------- names

lemma DotPairFromMatchesModel(s: string, i: nat)
  ensures dotPairFrom(s, i) <==> exists k :: i <= k < |s| && Worktrees.DotPairAt(s, k)
  decreases |s| - i
{
  if i + 1 < |s| {
    DotPairFromMatchesModel(s, i + 1);
    if s[i] == '.' && s[i + 1] == '.' { assert Worktrees.DotPairAt(s, i); }
  }
}

lemma IsWorktreeNameMatchesModel(s: string)
  ensures isWorktreeName(s) == Worktrees.ValidName(s)
{
  DotPairFromMatchesModel(s, 0);
  if |s| > 0 {
    WtRunEndMatchesModel(s, 1);
    Text.ScanReaches(s, 1, |s|, isNameUnit);
    assert forall c :: isNameUnit(c) == Worktrees.NameChar(c);
  }
}

lemma AgentFolderMatchesModel(agentId: string)
  ensures agentFolder(agentId) == Worktrees.AgentFolder(agentId)
{
}

lemma SubagentLooksMatchesModel(agentId: string)
  ensures subagentLooks(agentId) == Worktrees.SubagentLooks(agentId)
{
  IsWorktreeNameMatchesModel(agentFolder(agentId));
}

// ---------------------------------------------------------------- layout and base

lemma LayoutOfMatchesModel(ownGit: bool, projectRepoGit: bool, topExit: int, top: string)
  ensures AsLayout(layoutOf(ownGit, projectRepoGit, topExit, top)) == Worktrees.LayoutOf(ownGit, projectRepoGit, topExit, top)
{
}

lemma HasRepoMatchesModel(l: Layout)
  ensures hasRepo(l) == Worktrees.HasRepo(AsLayout(l))
{
}

lemma WarnsNoRemoteMatchesModel(mode: BaseMode, remote: string)
  ensures warnsNoRemote(mode, remote) == Worktrees.WarnsNoRemote(AsBase(mode), remote)
{
}

lemma RunsInShellMatchesModel(platform: string, command: string)
  ensures runsInShell(platform, command) == Worktrees.RunsInShell(platform, command)
{
}

lemma ShellSafeMatchesModel(a: string)
  ensures shellSafe(a) == Worktrees.ShellSafe(a)
{
  WtRunEndMatchesModel(a, 0);
  Text.ScanReaches(a, 0, |a|, isShellSafeUnit);
  assert forall c :: isShellSafeUnit(c) == Worktrees.ShellSafeUnit(c);
}

lemma RunPlanMatchesModel(platform: string, command: string, args: seq<string>)
  ensures AsPlan(runPlan(platform, command, args)) == Worktrees.PlanOf(platform, command, args)
{
  forall a: string ensures shellSafe(a) == Worktrees.ShellSafe(a) { ShellSafeMatchesModel(a); }
  WtListEndMatchesModel(args, 0);
  Text.ListEndExt(args, args, 0);
  Text.ListReaches(args, 0, |args|, (a: string) => shellSafe(a));
}

lemma BesideRepoMatchesModel(l: Layout)
  ensures besideRepo(l) == Worktrees.BesideRepo(AsLayout(l))
{
}

lemma ModeOfMatchesModel(values: seq<string>)
  ensures AsBase(modeOf(values)) == Worktrees.ModeOf(values)
{
  WtListEndMatchesModel(values, 0);
  Text.ListEndExt(values, values, 0);
}

lemma RemoteDefaultMatchesModel(headExit: int, head: string, mainExit: int, masterExit: int)
  ensures remoteDefault(headExit, head, mainExit, masterExit) == Worktrees.RemoteDefault(headExit, head, mainExit, masterExit)
{
}

lemma StartRefMatchesModel(mode: BaseMode, remote: string)
  ensures startRef(mode, remote) == Worktrees.StartRef(AsBase(mode), remote)
{
}

lemma NeedsFetchMatchesModel(mode: BaseMode, remote: string, fetchHeadExit: int, ageKnown: bool, ageMs: int)
  ensures needsFetch(mode, remote, fetchHeadExit, ageKnown, ageMs) == Worktrees.NeedsFetch(AsBase(mode), remote, fetchHeadExit, ageKnown, ageMs)
{
}

lemma FetchBranchMatchesModel(base: string)
  ensures fetchBranch(base) == Worktrees.FetchBranch(base)
{
}

// ---------------------------------------------------------------- the git commands that write

lemma AddArgsMatchesModel(repoDir: string, path: string, base: string)
  ensures addArgs(repoDir, path, base) == Worktrees.AddArgs(repoDir, path, base)
{
}

lemma RemoveArgsMatchesModel(repoDir: string, path: string)
  ensures removeArgs(repoDir, path) == Worktrees.RemoveArgs(repoDir, path)
{
}

// ---------------------------------------------------------------- creating

lemma CreateStepMatchesModel(nameOk: bool, layout: Layout, pathExists: bool, pathHasGit: bool)
  ensures AsStep(createStep(nameOk, layout, pathExists, pathHasGit)) == Worktrees.CreateStepOf(nameOk, AsLayout(layout), pathExists, pathHasGit)
{
}

lemma MarksSessionMatchesModel(sessionId: string)
  ensures marksSession(sessionId) == Worktrees.MarksSession(sessionId)
{
}

lemma InstallsDepsMatchesModel(name: string, hasLock: bool)
  ensures installsDeps(name, hasLock) == Worktrees.InstallsDeps(name, hasLock)
{
}

lemma RestoresHooksMatchesModel(configs: seq<bool>, hasNodeModules: bool)
  ensures restoresHooks(configs, hasNodeModules) == Worktrees.RestoresHooks(configs, hasNodeModules)
{
  WtListEndMatchesModel(configs, 0);
  Text.ListEndExt(configs, configs, 0);
}

// ---------------------------------------------------------------- what a worktree holds, and removing

lemma HeldByMatchesModel(statusExit: int, status: string, unsavedExit: int, unsaved: string, branchExit: int)
  ensures AsHeld(heldBy(statusExit, status, unsavedExit, unsaved, branchExit)) == Worktrees.HeldBy(Worktrees.Facts(statusExit, status, unsavedExit, unsaved, branchExit))
{
}

lemma RemoveLooksMatchesModel(repoFound: bool, linked: bool)
  ensures removeLooks(repoFound, linked) == Worktrees.RemoveLooks(repoFound, linked)
{
}

lemma RemoveVerdictMatchesModel(repoFound: bool, linked: bool, statusExit: int, status: string, unsavedExit: int, unsaved: string, branchExit: int)
  ensures AsVerdict(removeVerdict(repoFound, linked, heldBy(statusExit, status, unsavedExit, unsaved, branchExit))) == Worktrees.RemoveVerdict(repoFound, linked, Worktrees.Facts(statusExit, status, unsavedExit, unsaved, branchExit))
{
  HeldByMatchesModel(statusExit, status, unsavedExit, unsaved, branchExit);
}

lemma RemoveExitMatchesModel(v: Verdict, removalExit: int)
  ensures removeExit(v, removalExit) == Worktrees.RemoveExit(AsVerdict(v), removalExit)
{
}

lemma SubagentVerdictMatchesModel(agentId: string, present: bool, statusExit: int, status: string, unsavedExit: int, unsaved: string, branchExit: int)
  ensures AsVerdict(subagentVerdict(agentId, present, heldBy(statusExit, status, unsavedExit, unsaved, branchExit))) == Worktrees.SubagentVerdict(agentId, present, Worktrees.Facts(statusExit, status, unsavedExit, unsaved, branchExit))
{
  SubagentLooksMatchesModel(agentId);
  HeldByMatchesModel(statusExit, status, unsavedExit, unsaved, branchExit);
}

lemma SessionEndRunsMatchesModel(sessionId: string, reason: string)
  ensures sessionEndRuns(sessionId, reason) == Worktrees.SessionEndRuns(sessionId, reason)
{
}

lemma IsInsideMatchesModel(cwd: string, path: string, sep: string)
  ensures isInside(cwd, path, sep) == Worktrees.Inside(cwd, path, sep)
{
}

lemma SessionPicksMatchesModel(sessionId: string, owner: string, inside: bool)
  ensures sessionPicks(sessionId, owner, inside) == Worktrees.SessionPicks(sessionId, owner, inside)
{
}

lemma SessionVerdictMatchesModel(sessionId: string, reason: string, owner: string, inside: bool, statusExit: int, status: string, unsavedExit: int, unsaved: string, branchExit: int)
  ensures AsVerdict(sessionVerdict(sessionId, reason, owner, inside, heldBy(statusExit, status, unsavedExit, unsaved, branchExit))) == Worktrees.SessionVerdict(sessionId, reason, owner, inside, Worktrees.Facts(statusExit, status, unsavedExit, unsaved, branchExit))
{
  HeldByMatchesModel(statusExit, status, unsavedExit, unsaved, branchExit);
}

// ---------------------------------------------------------------- the worktrees git lists

lemma ListedFromMatchesModel(lines: seq<string>, i: nat)
  ensures listedFrom(lines, i) == Worktrees.ListedFrom(lines, i)
  decreases |lines| - i
{
  if i < |lines| { ListedFromMatchesModel(lines, i + 1); }
}

lemma LinkedPathsMatchesModel(lines: seq<string>)
  ensures linkedPaths(lines) == Worktrees.Linked(lines)
{
  ListedFromMatchesModel(lines, 0);
}

lemma IsLinkedWorktreeMatchesModel(lines: seq<string>, path: string)
  ensures isLinkedWorktree(lines, path) == Worktrees.IsLinked(lines, path)
{
  LinkedPathsMatchesModel(lines);
  var paths := linkedPaths(lines);
  var ok := (p: string) => p != path;
  WtListEndMatchesModel(paths, 0);
  Text.ListEndExt(paths, paths, 0);
  var e := Text.ListEnd(paths, 0, ok);
  if e < |paths| { assert paths[e] == path; }
  if path in paths {
    var k :| 0 <= k < |paths| && paths[k] == path;
    Text.ListReaches(paths, 0, |paths|, ok);
    assert !ok(paths[k]);
  }
}
