//@ backend dafny

/* The worktree hooks plugin's decisions, each a small pure function proved with LemmaScript → Dafny
   (`pnpm proofs`; model: models/Worktrees.dfy; link: models/links/worktree-rules.dfy).
   `worktree.ts` gathers the facts (files, git) and calls these for every decision. Names are
   apart from the other proved files': every proved file is one Dafny program. */

/** Where the repo is: the project folder itself, `{project}/repo`, a repo above, or none. */
export type Layout = "own-repo" | "project-repo" | "enclosing-repo" | "no-repo";

/** What a new worktree starts from (Claude Code's `worktree.baseRef`: "fresh" or "head"). */
export type BaseMode = "from-remote" | "from-head";

/** What WorktreeCreate does. */
export type CreateStep = "bad-name" | "no-layout" | "refuse" | "re-enter" | "add-new";

/** What a worktree holds, first kind found first. */
export type Held = "unreadable" | "uncommitted" | "unpushed" | "on-branch" | "no-work";

/** Whether a hook removes a worktree. */
export type Verdict = "remove-it" | "keep-it";

/** How a program starts: directly, through cmd.exe, or refused. */
export type RunPlan = "direct" | "via-shell" | "refused-shell";

// ---------------------------------------------------------------- general loops

/** Where the run of code units passing `ok` that starts at `i` ends (model: Text.ScanEnd). */
function wtRunEnd(s: string, i: number, ok: (c: number) => boolean): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures i <= \result && \result <= s.length
  let j = i;
  while (j < s.length && ok(s.charCodeAt(j))) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    j = j + 1;
  }
  return j;
}

/** Where the run of elements passing `ok` that starts at `i` ends (model: Text.ListEnd). */
function wtListEnd<T>(xs: T[], i: number, ok: (x: T) => boolean): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= xs.length
  //@ ensures i <= \result && \result <= xs.length
  let j = i;
  while (j < xs.length && ok(xs[j]!)) {
    //@ invariant i <= j && j <= xs.length
    //@ decreases xs.length - j
    j = j + 1;
  }
  return j;
}

/** `s` has two dots in a row at or after `i`. */
function dotPairFrom(s: string, i: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  let j = i;
  while (j + 1 < s.length && !(s.charCodeAt(j) === 46 && s.charCodeAt(j + 1) === 46)) {
    //@ invariant i <= j
    //@ decreases s.length - j
    j = j + 1;
  }
  return j + 1 < s.length;
}

/** `s` starts with `p`. */
export function wtHasPrefix(s: string, p: string): boolean {
  //@ verify
  return p.length <= s.length && s.slice(0, p.length) === p;
}

// ---------------------------------------------------------------- names

/** `[A-Za-z0-9]` */
function isNameStartUnit(c: number): boolean {
  //@ verify
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
}

/** `[A-Za-z0-9._-]` */
function isNameUnit(c: number): boolean {
  //@ verify
  return isNameStartUnit(c) || c === 46 || c === 95 || c === 45;
}

/** A worktree name safe as one folder name: `^[A-Za-z0-9][A-Za-z0-9._-]*$`, and no "..". */
export function isWorktreeName(s: string): boolean {
  //@ verify
  return (
    s.length > 0 &&
    isNameStartUnit(s.charCodeAt(0)) &&
    wtRunEnd(s, 1, isNameUnit) === s.length &&
    !dotPairFrom(s, 0)
  );
}

/** The subagent worktree folder Claude Code was seen to use: `agent-<agent_id>`. */
export function agentFolder(agentId: string): string {
  //@ verify
  return "agent-" + agentId;
}

/** SubagentStop looks only at a folder that is a valid worktree name. */
export function subagentLooks(agentId: string): boolean {
  //@ verify
  return agentId !== "" && isWorktreeName(agentFolder(agentId));
}

// ---------------------------------------------------------------- layout

/** A folder that is itself a repo wins over a nested `repo/`; then a repo above the folder. */
export function layoutOf(
  ownGit: boolean,
  projectRepoGit: boolean,
  topExit: number,
  top: string,
): Layout {
  //@ verify
  if (ownGit) return "own-repo";
  if (projectRepoGit) return "project-repo";
  return topExit === 0 && top !== "" ? "enclosing-repo" : "no-repo";
}

/** A repo was found. */
export function hasRepo(layout: Layout): boolean {
  //@ verify
  return layout !== "no-repo";
}

/** Worktrees go beside the repo (`{project}/worktrees`) only in the SimpleApps layout. */
export function besideRepo(layout: Layout): boolean {
  //@ verify
  return layout === "project-repo";
}

// ---------------------------------------------------------------- base

/** The first settings value that is "fresh" or "head" wins; "fresh" when none is. */
export function modeOf(values: string[]): BaseMode {
  //@ verify
  const k = wtListEnd(values, 0, (v: string) => v !== "fresh" && v !== "head");
  return k < values.length && values[k]! === "head" ? "from-head" : "from-remote";
}

/** origin/HEAD, else origin/main, else origin/master, else "" (none). */
export function remoteDefault(
  headExit: number,
  head: string,
  mainExit: number,
  masterExit: number,
): string {
  //@ verify
  if (headExit === 0) return head;
  if (mainExit === 0) return "origin/main";
  return masterExit === 0 ? "origin/master" : "";
}

/** The ref a new worktree starts from: HEAD in "head" mode or with no remote default. */
export function startRef(mode: BaseMode, remote: string): string {
  //@ verify
  return mode === "from-head" || remote === "" ? "HEAD" : remote;
}

/** "fresh" with no remote default falls back to HEAD, and says so. */
export function warnsNoRemote(mode: BaseMode, remote: string): boolean {
  //@ verify
  return mode === "from-remote" && remote === "";
}

/** Fetch the remote default first, unless the repo fetched in the last day. */
export function needsFetch(
  mode: BaseMode,
  remote: string,
  fetchHeadExit: number,
  ageKnown: boolean,
  ageMs: number,
): boolean {
  //@ verify
  const fetchedToday = fetchHeadExit === 0 && ageKnown && ageMs < 86400000;
  return mode === "from-remote" && remote !== "" && !fetchedToday;
}

/** The branch `git fetch origin <branch>` names: the ref without `origin/`. */
export function fetchBranch(base: string): string {
  //@ verify
  return wtHasPrefix(base, "origin/") ? base.slice(7) : base;
}

// ---------------------------------------------------------------- running programs

/** Start through a shell only on Windows, and never git (a real executable everywhere). */
export function runsInShell(platform: string, command: string): boolean {
  //@ verify
  return platform === "win32" && command !== "git";
}

/** A code unit cmd.exe passes through a quoted line unread: not `"`, `%`, `!`, `&`, `|`, `<`,
    `>`, `^` or a line break. */
function isShellSafeUnit(c: number): boolean {
  //@ verify
  const quoting = c !== 34 && c !== 37 && c !== 33;
  const operators = c !== 38 && c !== 124 && c !== 60 && c !== 62 && c !== 94;
  return quoting && operators && c !== 10 && c !== 13;
}

/** Every code unit of `a` is shell-safe. */
export function shellSafe(a: string): boolean {
  //@ verify
  return wtRunEnd(a, 0, isShellSafeUnit) === a.length;
}

/** How to start `command`: directly, except a non-git command on Windows, which goes through
    cmd.exe only when every argument is shell-safe, and is refused otherwise. */
export function runPlan(platform: string, command: string, args: string[]): RunPlan {
  //@ verify
  if (!runsInShell(platform, command)) return "direct";
  return wtListEnd(args, 0, (a: string) => shellSafe(a)) === args.length
    ? "via-shell"
    : "refused-shell";
}

// ---------------------------------------------------------------- the git commands that write

/** `git worktree add`, always detached, the path after `--`. */
export function addArgs(repoDir: string, path: string, base: string): string[] {
  //@ verify
  return ["-C", repoDir, "worktree", "add", "-q", "--detach", "--", path, base];
}

/** `git worktree remove`, never forced: no option but `--`, the path after it. */
export function removeArgs(repoDir: string, path: string): string[] {
  //@ verify
  return ["-C", repoDir, "worktree", "remove", "--", path];
}

// ---------------------------------------------------------------- creating

/** WorktreeCreate: refuse a bad name, a missing repo, or a path that is not a worktree;
    re-enter a kept worktree; otherwise add a new one. */
export function createStep(
  nameOk: boolean,
  layout: Layout,
  pathExists: boolean,
  pathHasGit: boolean,
): CreateStep {
  //@ verify
  if (!nameOk) return "bad-name";
  if (layout === "no-repo") return "no-layout";
  if (pathExists) return pathHasGit ? "re-enter" : "refuse";
  return "add-new";
}

/** Record the session that made or re-entered a worktree, when Claude Code names one. */
export function marksSession(sessionId: string): boolean {
  //@ verify
  return sessionId !== "";
}

/** Install dependencies (so git hooks run), except in subagent worktrees. */
export function installsDeps(name: string, hasLock: boolean): boolean {
  //@ verify
  return hasLock && !wtHasPrefix(name, "agent-");
}

/** Re-point the shared git hooks at the main checkout: it uses lefthook (any config) and has
    its own node_modules. */
export function restoresHooks(configs: boolean[], hasNodeModules: boolean): boolean {
  //@ verify
  return wtListEnd(configs, 0, (b: boolean) => !b) < configs.length && hasNodeModules;
}

// ---------------------------------------------------------------- what a worktree holds

/** A check failed or did not finish (-1): `status` and `rev-list` exit 0, `symbolic-ref -q`
    exits 0 (a branch) or 1 (detached). */
function checkFailed(statusExit: number, unsavedExit: number, branchExit: number): boolean {
  //@ verify
  return statusExit !== 0 || unsavedExit !== 0 || (branchExit !== 0 && branchExit !== 1);
}

/** What the worktree holds, from `git status --porcelain`, `git rev-list HEAD --not --branches
    --remotes` and `git symbolic-ref -q HEAD`. Any output is work; a failed check is work. */
export function heldBy(
  statusExit: number,
  status: string,
  unsavedExit: number,
  unsaved: string,
  branchExit: number,
): Held {
  //@ verify
  //@ ensures \result === "no-work" <==> (statusExit === 0 && status === "" && unsavedExit === 0 && unsaved === "" && branchExit === 1)
  if (checkFailed(statusExit, unsavedExit, branchExit)) return "unreadable";
  if (status.length > 0) return "uncommitted";
  if (unsaved.length > 0) return "unpushed";
  return branchExit === 0 ? "on-branch" : "no-work";
}

// ---------------------------------------------------------------- removing

/** WorktreeRemove looks only at a path git lists as a linked worktree of the repo. */
export function removeLooks(repoFound: boolean, linked: boolean): boolean {
  //@ verify
  return repoFound && linked;
}

/** WorktreeRemove: remove only a listed linked worktree holding no work. */
export function removeVerdict(repoFound: boolean, linked: boolean, held: Held): Verdict {
  //@ verify
  //@ ensures \result === "remove-it" <==> (repoFound && linked && held === "no-work")
  return removeLooks(repoFound, linked) && held === "no-work" ? "remove-it" : "keep-it";
}

/** WorktreeRemove's exit code: 0 only once git removed it; non-zero keeps it. */
export function removeExit(verdict: Verdict, removalExit: number): number {
  //@ verify
  //@ ensures \result === 0 <==> (verdict === "remove-it" && removalExit === 0)
  return verdict === "remove-it" && removalExit === 0 ? 0 : 1;
}

/** SubagentStop: the subagent's own folder, when it exists and holds no work. */
export function subagentVerdict(agentId: string, present: boolean, held: Held): Verdict {
  //@ verify
  return subagentLooks(agentId) && present && held === "no-work" ? "remove-it" : "keep-it";
}

/** SessionEnd runs, except on /clear and /resume. */
export function sessionEndRuns(sessionId: string, reason: string): boolean {
  //@ verify
  return sessionId !== "" && reason !== "clear" && reason !== "resume";
}

/** `cwd` is the worktree at `path` or inside it. */
export function isInside(cwd: string, path: string, sep: string): boolean {
  //@ verify
  return cwd === path || wtHasPrefix(cwd, path + sep);
}

/** Session end looks at a worktree recorded for this session, outside the session's folder. */
export function sessionPicks(sessionId: string, owner: string, inside: boolean): boolean {
  //@ verify
  return sessionId !== "" && owner === sessionId && !inside;
}

/** SessionEnd: remove a worktree this session made, outside its folder, holding no work. */
export function sessionVerdict(
  sessionId: string,
  reason: string,
  owner: string,
  inside: boolean,
  held: Held,
): Verdict {
  //@ verify
  const picked = sessionEndRuns(sessionId, reason) && sessionPicks(sessionId, owner, inside);
  return picked && held === "no-work" ? "remove-it" : "keep-it";
}

// ---------------------------------------------------------------- the worktrees git lists

/** The paths of the `worktree <path>` lines from `i` on. */
function listedFrom(lines: string[], i: number): string[] {
  //@ verify
  //@ pure
  //@ type i nat
  const acc: string[] = [];
  let j = i;
  while (j < lines.length) {
    //@ invariant i <= j
    //@ decreases lines.length - j
    if (wtHasPrefix(lines[j]!, "worktree ")) acc.push(lines[j]!.slice(9));
    j = j + 1;
  }
  return acc;
}

/** The linked worktrees of `git worktree list --porcelain`: all but the first, the main checkout. */
export function linkedPaths(lines: string[]): string[] {
  //@ verify
  const all = listedFrom(lines, 0);
  return all.length === 0 ? [] : all.slice(1);
}

/** `path` is one of the linked worktrees git lists. */
export function isLinkedWorktree(lines: string[], path: string): boolean {
  //@ verify
  const paths = linkedPaths(lines);
  return wtListEnd(paths, 0, (p: string) => p !== path) < paths.length;
}
