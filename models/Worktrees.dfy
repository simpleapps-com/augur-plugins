// The model of the simpleapps-worktrees hooks plugin's decisions: where a worktree goes, what it starts
// from, and when one may be removed. Hand-written Dafny, written before the code (wiki Proofs).
// `plugins/simpleapps-worktrees/scripts/worktree-rules.ts` is proved with LemmaScript and linked
// to it in `models/links/worktree-rules.dfy`; `scripts/worktree.ts` gathers the facts (files, git)
// and acts on what these decide. Ported from augur-skills GH #77 (`hooks/worktree.mjs`).

include "Text.dfy"

module Worktrees {
  import Text

  // ---------------------------------------------------------------- text helpers

  // `s` starts with `p`.
  predicate HasPrefix(s: string, p: string)
  {
    |p| <= |s| && s[..|p|] == p
  }

  // ---------------------------------------------------------------- names

  // `[A-Za-z0-9]` and `[A-Za-z0-9._-]`, as UTF-16 code units.
  predicate NameStart(c: int) { 65 <= c <= 90 || 97 <= c <= 122 || 48 <= c <= 57 }
  predicate NameChar(c: int) { NameStart(c) || c == 46 || c == 95 || c == 45 }

  // Two dots at k and k + 1.
  predicate DotPairAt(s: string, k: int)
  {
    0 <= k && k + 1 < |s| && s[k] == '.' && s[k + 1] == '.'
  }

  // A worktree name Claude Code passes (WorktreeCreate `name`), safe as one folder name:
  // `^[A-Za-z0-9][A-Za-z0-9._-]*$`, and no "..".
  predicate ValidName(s: string)
  {
    |s| > 0 && NameStart(s[0] as int) &&
    (forall k :: 1 <= k < |s| ==> NameChar(s[k] as int)) &&
    !(exists k :: 0 <= k < |s| && DotPairAt(s, k))
  }

  // A valid name is one folder under the worktrees folder: no separator, and never "." or "..",
  // so `<worktrees>/<name>` cannot climb out (Claude Code also refuses a path with `.` or `..`).
  lemma ValidNameIsOneFolder(s: string)
    requires ValidName(s)
    ensures forall k :: 0 <= k < |s| ==> s[k] != '/' && s[k] != '\\'
    ensures s[0] != '.' && s != "." && s != ".."
  {
  }

  // The SubagentStop folder Claude Code was seen to use (2.1.322, not documented): `agent-<id>`.
  function AgentFolder(agentId: string): string { "agent-" + agentId }

  // SubagentStop looks only at a folder that is a valid name, so an `agent_id` such as `../x`
  // cannot point it outside the worktrees folder.
  predicate SubagentLooks(agentId: string)
  {
    agentId != "" && ValidName(AgentFolder(agentId))
  }

  // ---------------------------------------------------------------- layout

  // Where the repo is: the project folder itself (a plain repo), `{project}/repo` (the SimpleApps
  // layout), a repo above the folder (`git rev-parse --show-toplevel`), or none.
  datatype Layout = OwnRepo | ProjectRepo | EnclosingRepo | NoRepo

  function LayoutOf(ownGit: bool, projectRepoGit: bool, topExit: int, top: string): Layout
  {
    if ownGit then OwnRepo
    else if projectRepoGit then ProjectRepo
    else if topExit == 0 && top != "" then EnclosingRepo
    else NoRepo
  }

  // A repo was found: every hook does nothing (or refuses) without one.
  predicate HasRepo(l: Layout) { l != NoRepo }

  // Worktrees beside the repo, `{project}/worktrees`, only in the SimpleApps layout; otherwise
  // inside the repo, `<repo>/.claude/worktrees`.
  predicate BesideRepo(l: Layout) { l == ProjectRepo }

  // A folder that is itself a repo wins over a nested `repo/`, so a plain repo that happens to
  // contain one is not misread.
  lemma OwnRepoWins(projectRepoGit: bool, topExit: int, top: string)
    ensures LayoutOf(true, projectRepoGit, topExit, top) == OwnRepo
  {
  }

  // ---------------------------------------------------------------- what a new worktree starts from

  // Claude Code's `worktree.baseRef`: "fresh" (the default) starts from the remote default branch,
  // "head" from the main checkout's commit.
  datatype Base = FromRemote | FromHead

  predicate ModeValue(v: string) { v == "fresh" || v == "head" }

  // The first settings file (local project, shared project, user) that sets a valid value wins.
  function ModeOf(values: seq<string>): Base
  {
    var k := Text.ListEnd(values, 0, (v: string) => !ModeValue(v));
    if k < |values| && values[k] == "head" then FromHead else FromRemote
  }

  // origin/HEAD, else origin/main, else origin/master, else none ("").
  function RemoteDefault(headExit: int, head: string, mainExit: int, masterExit: int): string
  {
    if headExit == 0 then head
    else if mainExit == 0 then "origin/main"
    else if masterExit == 0 then "origin/master"
    else ""
  }

  // The ref passed to `git worktree add`: HEAD for "head", or when there is no remote default.
  function StartRef(mode: Base, remote: string): string
  {
    if mode == FromHead || remote == "" then "HEAD" else remote
  }

  // "fresh" with no remote default falls back to HEAD, and says so.
  predicate WarnsNoRemote(mode: Base, remote: string) { mode == FromRemote && remote == "" }

  const DayMs: int := 86400000

  // Fetch the remote default first, unless the repo fetched in the last day.
  predicate NeedsFetch(mode: Base, remote: string, fetchHeadExit: int, ageKnown: bool, ageMs: int)
  {
    mode == FromRemote && remote != "" && !(fetchHeadExit == 0 && ageKnown && ageMs < DayMs)
  }

  // The branch `git fetch origin <branch>` names: the ref without `origin/`.
  function FetchBranch(base: string): string
  {
    if HasPrefix(base, "origin/") then base[7..] else base
  }

  lemma HeadModeStartsAtHead(remote: string)
    ensures StartRef(FromHead, remote) == "HEAD"
    ensures forall e: int, k: bool, a: int :: !NeedsFetch(FromHead, remote, e, k, a)
  {
  }

  // ---------------------------------------------------------------- running programs

  // How a program starts: directly, except on Windows, where package managers are `.cmd` shims
  // that Node can start only through a shell. git is a real executable everywhere.
  predicate RunsInShell(platform: string, command: string)
  {
    platform == "win32" && command != "git"
  }

  // git never starts through a shell, so no path or ref it is given is read by one.
  lemma GitNeverRunsInShell(platform: string)
    ensures !RunsInShell(platform, "git")
  {
  }

  // cmd.exe reads `"` (ends the quoting), `%` and `!` (expansion), `&`, `|`, `<`, `>`, `^`
  // (operators and escape) and line breaks even in a quoted line; an argument holding none of
  // them is passed through as written.
  predicate ShellSafeUnit(c: int)
  {
    c != 34 && c != 37 && c != 33 && c != 38 && c != 124 && c != 60 && c != 62 && c != 94 && c != 10 && c != 13
  }

  predicate ShellSafe(a: string) { forall k :: 0 <= k < |a| ==> ShellSafeUnit(a[k] as int) }

  predicate ShellSafeArgs(args: seq<string>) { forall k :: 0 <= k < |args| ==> ShellSafe(args[k]) }

  // Started directly; through cmd.exe; or refused, rather than let cmd.exe read an argument.
  datatype RunPlan = Direct | ViaShell | RefusedShell

  function PlanOf(platform: string, command: string, args: seq<string>): RunPlan
  {
    if !RunsInShell(platform, command) then Direct
    else if ShellSafeArgs(args) then ViaShell
    else RefusedShell
  }

  // Only arguments cmd.exe passes through unread ever reach it.
  lemma ShellGetsOnlySafeArgs(platform: string, command: string, args: seq<string>)
    ensures PlanOf(platform, command, args) == ViaShell ==> platform == "win32" && ShellSafeArgs(args)
    ensures PlanOf(platform, "git", args) == Direct
  {
  }

  // ---------------------------------------------------------------- the git commands that write

  // `git worktree add`: always detached (no local branch left to clean up), the path after `--`
  // so git never reads it as an option.
  function AddArgs(repoDir: string, path: string, base: string): seq<string>
  {
    ["-C", repoDir, "worktree", "add", "-q", "--detach", "--", path, base]
  }

  // `git worktree remove`: the path after `--`, and no option at all.
  function RemoveArgs(repoDir: string, path: string): seq<string>
  {
    ["-C", repoDir, "worktree", "remove", "--", path]
  }

  predicate ForceFlag(a: string) { a == "--force" || a == "-f" || a == "-ff" }

  // Removal never uses force: the only words git parses as `worktree remove` options are `--`,
  // which ends them; the repo folder is `-C`'s value and the path comes after `--`.
  lemma RemoveNeverForces(repoDir: string, path: string)
    ensures |RemoveArgs(repoDir, path)| == 6
    ensures RemoveArgs(repoDir, path)[2..5] == ["worktree", "remove", "--"]
    ensures forall k :: 2 <= k < 5 ==> !ForceFlag(RemoveArgs(repoDir, path)[k])
    ensures RemoveArgs(repoDir, path)[5] == path
  {
  }

  // A new worktree is detached and never makes a branch.
  lemma AddIsDetached(repoDir: string, path: string, base: string)
    ensures AddArgs(repoDir, path, base)[2..7] == ["worktree", "add", "-q", "--detach", "--"]
    ensures forall k :: 2 <= k < 7 ==> AddArgs(repoDir, path, base)[k] != "-b" && AddArgs(repoDir, path, base)[k] != "-B"
  {
  }

  // ---------------------------------------------------------------- creating

  datatype CreateStep = BadName | NoLayout | Refuse | ReEnter | AddNew

  // WorktreeCreate: refuse a bad name or a missing repo; re-enter a kept worktree at the path
  // (`claude -w <name>` again); refuse anything else at the path; otherwise add one.
  function CreateStepOf(nameOk: bool, layout: Layout, pathExists: bool, pathHasGit: bool): CreateStep
  {
    if !nameOk then BadName
    else if layout == NoRepo then NoLayout
    else if pathExists then (if pathHasGit then ReEnter else Refuse)
    else AddNew
  }

  // The session that made (or re-entered) a worktree is recorded, when Claude Code names one.
  predicate MarksSession(sessionId: string) { sessionId != "" }

  // Dependencies are installed so git hooks run, except in subagent worktrees (kept fast).
  predicate InstallsDeps(name: string, hasLock: bool)
  {
    hasLock && !HasPrefix(name, "agent-")
  }

  // After an install, re-point the shared git hooks at the main checkout when it uses lefthook
  // (any of its config files) and has its own `node_modules`.
  predicate RestoresHooks(configs: seq<bool>, hasNodeModules: bool)
  {
    Text.ListEnd(configs, 0, (b: bool) => !b) < |configs| && hasNodeModules
  }

  // ---------------------------------------------------------------- what a worktree holds

  // What the shell read: `git status --porcelain`, `git rev-list HEAD --not --branches --remotes`
  // and `git symbolic-ref -q HEAD` (exit 1: detached; 0: a branch is checked out), each exit code
  // (-1 when the command did not finish) and output.
  datatype Facts = Facts(statusExit: int, status: string, unsavedExit: int, unsaved: string, branchExit: int)

  datatype Held = Unreadable | Uncommitted | Unpushed | OnBranch | NoWork

  // A failed or unfinished check counts as work: never remove what could not be inspected. Any
  // output at all is work.
  function HeldBy(f: Facts): Held
  {
    if f.statusExit != 0 || f.unsavedExit != 0 || (f.branchExit != 0 && f.branchExit != 1) then Unreadable
    else if |f.status| > 0 then Uncommitted
    else if |f.unsaved| > 0 then Unpushed
    else if f.branchExit == 0 then OnBranch
    else NoWork
  }

  // Holding no work, in full: every check ran and succeeded, no changes or untracked files, no
  // commit that no branch or remote holds, and no branch checked out. Gitignored files are not
  // work: `git status --porcelain` does not show them, and `git worktree remove` deletes them with
  // the worktree, so an edited `.env`, a local database or build output in one is lost.
  predicate Clean(f: Facts)
  {
    f.statusExit == 0 && f.status == "" && f.unsavedExit == 0 && f.unsaved == "" && f.branchExit == 1
  }

  lemma NoWorkIsClean(f: Facts)
    ensures HeldBy(f) == NoWork <==> Clean(f)
  {
  }

  // ---------------------------------------------------------------- removing

  datatype Verdict = Remove | Keep

  // WorktreeRemove looks only at a path git lists as a linked worktree of this repo (the path
  // Claude Code names, symlinks resolved as git prints them), never the main checkout or a folder
  // elsewhere.
  predicate RemoveLooks(hasRepo: bool, linked: bool) { hasRepo && linked }

  // Then removes it only when it holds no work.
  function RemoveVerdict(hasRepo: bool, linked: bool, f: Facts): Verdict
  {
    if RemoveLooks(hasRepo, linked) && HeldBy(f) == NoWork then Remove else Keep
  }

  // Its exit code: 0 only once git removed it (non-zero keeps the worktree in Claude Code).
  function RemoveExit(v: Verdict, removalExit: int): int
  {
    if v == Remove && removalExit == 0 then 0 else 1
  }

  // SubagentStop: the subagent's own folder, when it exists and holds no work.
  function SubagentVerdict(agentId: string, present: bool, f: Facts): Verdict
  {
    if SubagentLooks(agentId) && present && HeldBy(f) == NoWork then Remove else Keep
  }

  // SessionEnd runs, except on /clear and /resume (the process, and maybe its cwd, lives on).
  predicate SessionEndRuns(sessionId: string, reason: string)
  {
    sessionId != "" && reason != "clear" && reason != "resume"
  }

  // `cwd` is the worktree at `path` or inside it.
  predicate Inside(cwd: string, path: string, sep: string)
  {
    cwd == path || HasPrefix(cwd, path + sep)
  }

  // A worktree session end may look at: recorded for this session, and not where the session is.
  // The marker is compared exactly, not trimmed: this hook writes the bare id, so a marker with a
  // newline or spaces was written by something else, and its worktree is kept (the safe side).
  predicate SessionPicks(sessionId: string, owner: string, inside: bool)
  {
    sessionId != "" && owner == sessionId && !inside
  }

  function SessionVerdict(sessionId: string, reason: string, owner: string, inside: bool, f: Facts): Verdict
  {
    if SessionEndRuns(sessionId, reason) && SessionPicks(sessionId, owner, inside) && HeldBy(f) == NoWork
    then Remove else Keep
  }

  // ---------------------------------------------------------------- the worktrees git lists

  // The paths of `git worktree list --porcelain`: each `worktree <path>` line, from line i on.
  function ListedFrom(lines: seq<string>, i: nat): seq<string>
    decreases |lines| - i
  {
    if i >= |lines| then []
    else (if HasPrefix(lines[i], "worktree ") then [lines[i][9..]] else []) + ListedFrom(lines, i + 1)
  }

  // The linked worktrees: every listed one but the first, the main checkout.
  function Linked(lines: seq<string>): seq<string>
  {
    var all := ListedFrom(lines, 0);
    if |all| == 0 then [] else all[1..]
  }

  // `path` is one of them.
  predicate IsLinked(lines: seq<string>, path: string) { path in Linked(lines) }

  // ---------------------------------------------------------------- the safety properties

  // A worktree that holds work (changes, untracked files, unsaved commits, a checked-out branch,
  // or a state that could not be read) is never chosen for removal, by any of the three hooks.
  lemma NeverRemovesWork(f: Facts, hasRepo: bool, linked: bool, agentId: string, present: bool, sessionId: string, reason: string, owner: string, inside: bool)
    requires !Clean(f)
    ensures RemoveVerdict(hasRepo, linked, f) == Keep
    ensures SubagentVerdict(agentId, present, f) == Keep
    ensures SessionVerdict(sessionId, reason, owner, inside, f) == Keep
  {
    NoWorkIsClean(f);
  }

  // Each kind of work, one by one, keeps it.
  lemma EachKindOfWorkKeeps(f: Facts)
    ensures f.statusExit != 0 || f.unsavedExit != 0 || (f.branchExit != 0 && f.branchExit != 1) ==> HeldBy(f) == Unreadable
    ensures |f.status| > 0 ==> HeldBy(f) != NoWork
    ensures |f.unsaved| > 0 ==> HeldBy(f) != NoWork
    ensures f.branchExit == 0 ==> HeldBy(f) != NoWork
  {
  }

  // WorktreeRemove exits 0 only after git removed a listed linked worktree holding no work.
  lemma RemoveExitsZeroOnlyWhenRemoved(hasRepo: bool, linked: bool, f: Facts, removalExit: int)
    ensures RemoveExit(RemoveVerdict(hasRepo, linked, f), removalExit) == 0 ==>
      hasRepo && linked && Clean(f) && removalExit == 0
  {
    NoWorkIsClean(f);
  }

  // The main checkout (the first listed) is never linked, unless git lists it twice.
  lemma MainCheckoutIsNotLinked(lines: seq<string>)
    requires |ListedFrom(lines, 0)| > 0
    requires forall k :: 1 <= k < |ListedFrom(lines, 0)| ==> ListedFrom(lines, 0)[k] != ListedFrom(lines, 0)[0]
    ensures !IsLinked(lines, ListedFrom(lines, 0)[0])
  {
  }

  // A marker that is the id with a newline or a space is not this session's.
  lemma MarkerComparedExactly(sessionId: string)
    requires sessionId != ""
    ensures !SessionPicks(sessionId, sessionId + "\n", false)
    ensures !SessionPicks(sessionId, " " + sessionId, false)
  {
    assert |sessionId + "\n"| != |sessionId|;
    assert |" " + sessionId| != |sessionId|;
  }

  // Session end chooses only worktrees recorded for that session, never the one it is in, and
  // nothing on /clear or /resume.
  lemma SessionEndRemovesOnlyItsOwn(sessionId: string, reason: string, owner: string, inside: bool, f: Facts)
    ensures SessionVerdict(sessionId, reason, owner, inside, f) == Remove ==>
      sessionId != "" && owner == sessionId && !inside && Clean(f)
    ensures reason == "clear" || reason == "resume" ==> SessionVerdict(sessionId, reason, owner, inside, f) == Keep
  {
    NoWorkIsClean(f);
  }

  // A clean worktree this session made, outside its cwd, is removed (the cleanup does happen).
  lemma SessionEndRemovesItsCleanOnes(sessionId: string, reason: string, f: Facts)
    requires SessionEndRuns(sessionId, reason) && Clean(f)
    ensures SessionVerdict(sessionId, reason, sessionId, false, f) == Remove
  {
    NoWorkIsClean(f);
  }

  // SubagentStop removes only its own valid folder.
  lemma SubagentRemovesOnlyItsFolder(agentId: string, present: bool, f: Facts)
    ensures SubagentVerdict(agentId, present, f) == Remove ==> agentId != "" && present && ValidName(AgentFolder(agentId)) && Clean(f)
  {
    NoWorkIsClean(f);
  }

  // ---------------------------------------------------------------- refuted designs, kept so they stay out

  // The augur-skills hook built `agent-<agent_id>` with no check on the id.
  predicate OldSubagentLooks(agentId: string) { agentId != "" }

  // An id with a separator would have pointed it at a folder outside the worktrees folder.
  lemma OldSubagentLooksOutside()
    ensures OldSubagentLooks("x/../../repo") && !SubagentLooks("x/../../repo")
  {
    assert AgentFolder("x/../../repo")[7] == '/';
    assert !NameChar(AgentFolder("x/../../repo")[7] as int);
  }

  // It read `symbolic-ref`'s missing exit code (a killed or timed-out run) as 1, "detached".
  function OldBranchExit(finished: bool, code: int): int { if finished then code else 1 }

  // A check that never finished then passed as clean; read as -1 it counts as work.
  lemma OldUnfinishedCheckLooksClean()
    ensures var prev := Facts(0, "", 0, "", OldBranchExit(false, 0));
            HeldBy(prev) == NoWork && HeldBy(Facts(0, "", 0, "", -1)) == Unreadable
  {
  }
}
