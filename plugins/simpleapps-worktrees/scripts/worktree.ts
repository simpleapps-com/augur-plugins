#!/usr/bin/env node
// Claude Code worktree hooks. Places worktrees at {project}/worktrees/<name> in the SimpleApps
// layout ({project}/repo is the git repo), or <repo>/.claude/worktrees/<name> in a plain repo.
// Worktrees are detached (no local branch to clean up). Nothing is removed while it holds work
// (changes, untracked files, commits no branch or remote holds, or a checked-out branch), and
// nothing is ever removed with --force: Claude Code leaves that check to this hook. Each worktree
// records the session that made it, and session end removes that session's worktrees that hold no
// work, so worktrees made for workflow agents do not pile up either.
//
// This file is the shell: hook JSON, files and git. Every decision is a proved function in
// worktree-rules.ts (model: models/Worktrees.dfy). Usage (hooks/hooks.json):
// `node worktree.ts <create|remove|subagent-stop|session-end>`, hook JSON on stdin.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

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
  isLinkedWorktree,
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
  restoresHooks,
  runPlan,
  sessionEndRuns,
  sessionPicks,
  sessionVerdict,
  startRef,
  subagentLooks,
  subagentVerdict,
  warnsNoRemote,
  type BaseMode,
  type Held,
  type Layout,
  type RunPlan,
} from "./worktree-rules.ts";

const FETCH_TIMEOUT_MS = 10_000;
const SESSION_MARKER = "claude-session";
const LEFTHOOK_CONFIGS = ["lefthook.yml", "lefthook.yaml", ".lefthook.yml", ".lefthook.yaml"];

/** A finished program: its exit code (-1 when it did not finish), stdout and stderr. */
export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** The side effects; tests pass their own. */
export interface Deps {
  run: (command: string, args: string[], timeoutMs?: number) => RunResult;
  exists: (path: string) => boolean;
  modifiedMsAgo: (path: string) => number | null;
  readText: (path: string) => string | null;
  writeText: (path: string, text: string) => void;
  copyFile: (from: string, to: string) => void;
  realPath: (path: string) => string;
}

export interface HookResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

type Env = Record<string, string | undefined>;
type Input = Record<string, unknown>;

/** Where the repo and its worktrees are; empty folders when there is no repo. */
interface Found {
  kind: Layout;
  repoDir: string;
  worktreesDir: string;
  projectDir: string;
}

/** What a worktree holds, and the branch `symbolic-ref` printed. */
interface Work {
  held: Held;
  branch: string;
}

/** A JSON string field, or "" when it is missing or not a string. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** One key of a JSON object, or undefined when `value` is not an object. */
function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/** How to start `command` (proved `runPlan`): on Windows a shim runs through cmd.exe, each
    argument quoted, and only when no argument holds a character cmd.exe would read. The Windows
    branch is untested on Windows itself. */
export function spawnPlan(
  platform: string,
  command: string,
  args: string[],
): { kind: RunPlan; command: string; args: string[] } {
  const kind = runPlan(platform, command, args);
  if (kind !== "via-shell") return { kind, command, args };
  return { kind, command: [command, ...args.map((arg) => `"${arg}"`)].join(" "), args: [] };
}

/** git MUST NOT wait for a password, passphrase or host-key answer nobody can give. A user's own
    GIT_SSH_COMMAND is kept. */
export function childEnv(env: Env): Env {
  return {
    ...env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_SSH_COMMAND: env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
  };
}

/** Starts programs as `platform` does; a refused shell line runs nothing and says why. */
export function runOn(platform: string): Deps["run"] {
  return (command, args, timeoutMs) => {
    const plan = spawnPlan(platform, command, args);
    if (plan.kind === "refused-shell") {
      return {
        status: -1,
        stdout: "",
        stderr: `not run: ${command} starts through cmd.exe on Windows, and an argument holds one of " % ! & | < > ^ or a line break`,
      };
    }
    const result = spawnSync(plan.command, plan.args, {
      encoding: "utf8",
      env: childEnv(process.env),
      shell: plan.kind === "via-shell",
      timeout: timeoutMs,
    });
    return {
      status: result.status ?? -1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  };
}

/** The real side effects. */
export const systemDeps: Deps = {
  run: runOn(process.platform),
  exists: (path) => existsSync(path),
  modifiedMsAgo: (path) => {
    try {
      return Date.now() - statSync(path).mtimeMs;
    } catch {
      return null;
    }
  },
  readText: (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  },
  writeText: (path, value) => {
    writeFileSync(path, value);
  },
  copyFile: (from, to) => {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  },
  // Symlinks resolved, as git prints paths; the input unchanged when it does not exist
  realPath: (path) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  },
};

function git(deps: Deps, dir: string, args: string[], timeoutMs?: number): RunResult {
  return deps.run("git", ["-C", dir, ...args], timeoutMs);
}

/** Where the git repo and its worktrees live for a project folder (proved `layoutOf`). */
export function resolveLayout(projectDir: string, deps: Deps): Found {
  const ownGit = deps.exists(join(projectDir, ".git"));
  const projectRepoGit = deps.exists(join(projectDir, "repo", ".git"));
  // A session started in a subfolder of a plain repo; asked only when neither is there
  const top =
    ownGit || projectRepoGit
      ? { status: 1, stdout: "", stderr: "" }
      : git(deps, projectDir, ["rev-parse", "--show-toplevel"]);
  const topDir = top.stdout.trim();
  const kind = layoutOf(ownGit, projectRepoGit, top.status, topDir);
  const repoDirs: Record<Layout, string> = {
    "own-repo": projectDir,
    "project-repo": join(projectDir, "repo"),
    "enclosing-repo": topDir,
    "no-repo": "",
  };
  const repoDir = repoDirs[kind];
  const inRepo = hasRepo(kind) ? join(repoDir, ".claude", "worktrees") : "";
  const worktreesDir = besideRepo(kind) ? join(projectDir, "worktrees") : inRepo;
  return { kind, repoDir, worktreesDir, projectDir };
}

/** Hook input and environment → the layout. */
function layoutFor(input: Input, env: Env, deps: Deps): Found {
  const projectDir = env.CLAUDE_PROJECT_DIR || text(input.cwd);
  return resolveLayout(projectDir, deps);
}

function noRepoMessage(projectDir: string): string {
  return (
    `No git repo for worktrees at ${projectDir}: expected ${projectDir}/repo ` +
    "(SimpleApps project layout) or a git repo at or above the project folder."
  );
}

/** `worktree.baseRef` from one settings file's text, or "" when unset or unreadable. */
function settingValue(fileText: string | null): string {
  if (fileText === null) return "";
  try {
    return text(field(field(JSON.parse(fileText), "worktree"), "baseRef"));
  } catch {
    return "";
  }
}

/** Claude Code's `worktree.baseRef`, which it does not pass to a WorktreeCreate hook, read with
    its precedence: local project settings, shared project settings, then user settings. */
export function configuredMode(projectDir: string, env: Env, deps: Deps): BaseMode {
  const userDir = env.CLAUDE_CONFIG_DIR || (env.HOME ? join(env.HOME, ".claude") : "");
  const files = [
    join(projectDir, ".claude", "settings.local.json"),
    join(projectDir, ".claude", "settings.json"),
    ...(userDir ? [join(userDir, "settings.json")] : []),
  ];
  return modeOf(files.map((file) => settingValue(deps.readText(file))));
}

/** The remote default branch (proved `remoteDefault`), or "". */
function remoteDefaultOf(deps: Deps, repoDir: string): string {
  const head = git(deps, repoDir, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const main = git(deps, repoDir, ["rev-parse", "--verify", "-q", "origin/main"]);
  const master = git(deps, repoDir, ["rev-parse", "--verify", "-q", "origin/master"]);
  return remoteDefault(head.status, head.stdout.trim(), main.status, master.status);
}

/** Fetch `base` unless the repo fetched in the last day (proved `needsFetch`); bounded, and a
    failure only warns. */
function fetchIfStale(
  deps: Deps,
  repoDir: string,
  mode: BaseMode,
  base: string,
  warnings: string[],
): void {
  const fetchHead = git(deps, repoDir, ["rev-parse", "--git-path", "FETCH_HEAD"]);
  const age = deps.modifiedMsAgo(resolve(repoDir, fetchHead.stdout.trim()));
  if (!needsFetch(mode, base, fetchHead.status, age !== null, Math.floor(age ?? 0))) return;
  const branch = fetchBranch(base);
  const fetch = git(deps, repoDir, ["fetch", "-q", "origin", branch], FETCH_TIMEOUT_MS);
  if (fetch.status !== 0) {
    warnings.push(`fetch failed, using local ${base}: ${fetch.stderr.trim() || "timed out"}`);
  }
}

/** The ref a new worktree starts from (proved `startRef`). */
function startFrom(deps: Deps, found: Found, env: Env, warnings: string[]): string {
  const mode = configuredMode(found.projectDir, env, deps);
  const remote = remoteDefaultOf(deps, found.repoDir);
  if (warnsNoRemote(mode, remote)) {
    warnings.push("no origin default branch found; starting from local HEAD");
  }
  fetchIfStale(deps, found.repoDir, mode, remote, warnings);
  return startRef(mode, remote);
}

/** The worktree's own git dir (repo/.git/worktrees/<name>), where the session marker lives. */
function worktreeGitDir(deps: Deps, path: string): string {
  const gitDir = git(deps, path, ["rev-parse", "--absolute-git-dir"]);
  return gitDir.status === 0 ? gitDir.stdout.trim() : "";
}

/** Record which session made the worktree, for session-end cleanup (proved `marksSession`). */
function markSession(deps: Deps, path: string, sessionId: string, warnings: string[]): void {
  if (!marksSession(sessionId)) return;
  const gitDir = worktreeGitDir(deps, path);
  try {
    if (gitDir === "") throw new Error("no git dir");
    deps.writeText(join(gitDir, SESSION_MARKER), sessionId);
  } catch {
    warnings.push(`could not record the session for ${path}; session end will not remove it`);
  }
}

/** The session recorded for a worktree, or "". Not trimmed: markSession writes the bare id, so a
    marker with whitespace was written by something else and its worktree is kept (proved
    `sessionPicks`). */
function ownerOf(deps: Deps, path: string): string {
  const gitDir = worktreeGitDir(deps, path);
  return gitDir === "" ? "" : (deps.readText(join(gitDir, SESSION_MARKER)) ?? "");
}

/** The non-empty lines of a command's output. */
function lines(output: string): string[] {
  return output.split("\n").filter((line) => line !== "");
}

/** Copy the files the repo's `.worktreeinclude` (gitignore syntax) lists that are also
    gitignored, e.g. `.env`. Claude Code does this itself only when no WorktreeCreate hook is set. */
function copyIncluded(deps: Deps, repoDir: string, path: string, warnings: string[]): void {
  if (!deps.exists(join(repoDir, ".worktreeinclude"))) return;
  const listArgs = ["ls-files", "--others", "--ignored", "--exclude-from=.worktreeinclude"];
  const candidates = lines(git(deps, repoDir, listArgs).stdout);
  if (candidates.length === 0) return;
  // check-ignore prints the candidates the repo's own ignore rules cover (exit 1 when none)
  const ignored = git(deps, repoDir, ["check-ignore", "--", ...candidates]);
  for (const file of lines(ignored.stdout)) {
    try {
      deps.copyFile(join(repoDir, file), join(path, file));
    } catch {
      warnings.push(`.worktreeinclude: could not copy ${file}`);
    }
  }
}

/** The install's `prepare` script runs `lefthook install`, which points the shared `.git/hooks`
    at this worktree's lefthook; once the worktree is removed, every push from the main checkout
    would look for a deleted file. Re-install from the main checkout (proved `restoresHooks`). */
function restoreGitHooks(deps: Deps, repoDir: string, warnings: string[]): void {
  const configs = LEFTHOOK_CONFIGS.map((file) => deps.exists(join(repoDir, file)));
  if (!restoresHooks(configs, deps.exists(join(repoDir, "node_modules")))) return;
  const reinstall = deps.run("pnpm", ["--dir", repoDir, "exec", "lefthook", "install"]);
  if (reinstall.status !== 0) {
    warnings.push(
      `git hooks may point at this worktree; run \`pnpm --dir ${repoDir} exec lefthook install\`: ${reinstall.stderr.trim()}`,
    );
  }
}

/** Install dependencies so git hooks (lefthook) can run; subagent worktrees skip it to stay
    fast (proved `installsDeps`). */
function installDependencies(
  deps: Deps,
  repoDir: string,
  name: string,
  path: string,
  warnings: string[],
): void {
  if (!installsDeps(name, deps.exists(join(path, "pnpm-lock.yaml")))) return;
  const install = deps.run("pnpm", ["--dir", path, "install", "--frozen-lockfile"]);
  if (install.status !== 0) {
    warnings.push(
      `pnpm install failed; run it in ${path} before committing: ${install.stderr.trim()}`,
    );
  }
  restoreGitHooks(deps, repoDir, warnings);
}

function nameMessage(name: string): string {
  if (name === "") return "worktree name is missing";
  return `worktree name "${name}" MUST be letters, digits, ".", "_" or "-", start with a letter or digit, and not contain ".."`;
}

/** Add a new detached worktree (proved `addArgs`) and set it up. */
function addNew(deps: Deps, found: Found, input: Input, env: Env, path: string): HookResult {
  const warnings: string[] = [];
  const base = startFrom(deps, found, env, warnings);
  const add = deps.run("git", addArgs(found.repoDir, path, base));
  if (add.status !== 0) {
    return {
      exitCode: 1,
      stderr: [...warnings, `git worktree add failed: ${add.stderr.trim()}`].join("\n"),
    };
  }
  markSession(deps, path, text(input.session_id), warnings);
  copyIncluded(deps, found.repoDir, path, warnings);
  installDependencies(deps, found.repoDir, text(input.name), path, warnings);
  return { exitCode: 0, stdout: path, stderr: warnings.join("\n") };
}

/** WorktreeCreate: the worktree's absolute path is the last line of stdout (proved `createStep`). */
export function create(input: Input, env: Env, deps: Deps): HookResult {
  const name = text(input.name);
  const nameOk = isWorktreeName(name);
  const found = layoutFor(input, env, deps);
  const path = nameOk && hasRepo(found.kind) ? join(found.worktreesDir, name) : "";
  const pathExists = path !== "" && deps.exists(path);
  const step = createStep(
    nameOk,
    found.kind,
    pathExists,
    pathExists && deps.exists(join(path, ".git")),
  );
  if (step === "bad-name") return { exitCode: 1, stderr: nameMessage(name) };
  if (step === "no-layout") return { exitCode: 1, stderr: noRepoMessage(found.projectDir) };
  if (step === "refuse") return { exitCode: 1, stderr: `${path} exists and is not a git worktree` };
  if (step === "add-new") return addNew(deps, found, input, env, path);
  // A kept worktree re-entered (`claude -w <name>` again): the re-entering session now owns it,
  // so the session that made it cannot remove it while it is in use
  const warnings: string[] = [];
  markSession(deps, path, text(input.session_id), warnings);
  return { exitCode: 0, stdout: path, stderr: warnings.join("\n") };
}

/** What the worktree at `path` holds (proved `heldBy`). A failed check counts as work. */
export function workOf(deps: Deps, path: string): Work {
  const status = git(deps, path, ["status", "--porcelain"]);
  const unsaved = git(deps, path, ["rev-list", "HEAD", "--not", "--branches", "--remotes"]);
  // Exit 1 means detached, as this hook made it; 0 means someone checked out a branch
  const branch = git(deps, path, ["symbolic-ref", "-q", "HEAD"]);
  const held = heldBy(status.status, status.stdout, unsaved.status, unsaved.stdout, branch.status);
  return { held, branch: branch.stdout.trim() };
}

/** Why removing it would lose work. */
function problemText(work: Work): string {
  const texts: Record<Held, string> = {
    unreadable: "its state could not be read",
    uncommitted: "it has uncommitted or untracked changes",
    unpushed: "it has commits no branch or remote holds",
    "on-branch": `branch ${work.branch.replace("refs/heads/", "")} is checked out in it`,
    "no-work": "it holds no work",
  };
  return texts[work.held];
}

/** Why WorktreeRemove did not look at the path. */
function notLinkedMessage(found: Found, given: string): string {
  if (!hasRepo(found.kind)) return noRepoMessage(found.projectDir);
  if (given === "") return "worktree_path is missing";
  return `Kept ${given}: it is not a linked worktree of ${found.repoDir}`;
}

/** WorktreeRemove: a non-zero exit keeps the worktree; Claude Code relies on this check (proved
    `isLinkedWorktree`, `removeLooks`, `removeVerdict`, `removeExit`, `removeArgs`). */
export function remove(input: Input, env: Env, deps: Deps): HookResult {
  const found = layoutFor(input, env, deps);
  const repoFound = hasRepo(found.kind);
  const given = text(input.worktree_path);
  // git lists symlink-resolved paths
  const path = deps.realPath(given);
  const listing = repoFound
    ? git(deps, found.repoDir, ["worktree", "list", "--porcelain"]).stdout
    : "";
  const linked = isLinkedWorktree(listing.split("\n"), path);
  if (!removeLooks(repoFound, linked)) {
    return { exitCode: removeExit("keep-it", -1), stderr: notLinkedMessage(found, given) };
  }
  const work = workOf(deps, path);
  const verdict = removeVerdict(repoFound, linked, work.held);
  if (verdict === "keep-it") {
    return { exitCode: removeExit(verdict, -1), stderr: `Kept ${path}: ${problemText(work)}` };
  }
  const removal = deps.run("git", removeArgs(found.repoDir, path));
  const exitCode = removeExit(verdict, removal.status);
  return exitCode === 0
    ? { exitCode }
    : { exitCode, stderr: `Kept ${path}: ${removal.stderr.trim()}` };
}

/** SubagentStop: Claude Code keeps hook-made subagent worktrees, so remove an unchanged one here
    (proved `subagentLooks`, `subagentVerdict`). The `agent-<agent_id>` folder is observed
    behaviour (Claude Code 2.1.322), not documented. Always exits 0: a hook error here would only
    be noise. */
export function subagentStop(input: Input, env: Env, deps: Deps): HookResult {
  const agentId = text(input.agent_id);
  if (!subagentLooks(agentId)) return { exitCode: 0 };
  const found = layoutFor(input, env, deps);
  if (!hasRepo(found.kind)) return { exitCode: 0 };
  const path = join(found.worktreesDir, agentFolder(agentId));
  if (!deps.exists(path)) return { exitCode: 0 };
  const work = workOf(deps, path);
  if (subagentVerdict(agentId, true, work.held) === "keep-it") {
    return { exitCode: 0, stderr: `Kept ${path}: ${problemText(work)}` };
  }
  const removal = deps.run("git", removeArgs(found.repoDir, path));
  if (removal.status === 0) return { exitCode: 0 };
  return { exitCode: 0, stderr: `Could not remove ${path}: ${removal.stderr.trim()}` };
}

/** One linked worktree at session end: a note when it was kept or could not be removed. */
function sessionEndOne(
  deps: Deps,
  repoDir: string,
  path: string,
  session: { id: string; reason: string; cwd: string },
): string {
  const inside = isInside(session.cwd, path, sep);
  const owner = ownerOf(deps, path);
  if (!sessionPicks(session.id, owner, inside)) return "";
  const work = workOf(deps, path);
  if (sessionVerdict(session.id, session.reason, owner, inside, work.held) === "keep-it") {
    return `Kept ${path}: ${problemText(work)}`;
  }
  const removal = deps.run("git", removeArgs(repoDir, path));
  return removal.status === 0 ? "" : `Could not remove ${path}: ${removal.stderr.trim()}`;
}

/** SessionEnd: remove the worktrees this session made that hold no work, including those of
    workflow agents, whose folder names SubagentStop cannot predict. Skipped on /clear and /resume,
    and for the folder the session is in (proved `sessionEndRuns`, `sessionPicks`,
    `sessionVerdict`, `linkedPaths`). Always exits 0. */
export function sessionEnd(input: Input, env: Env, deps: Deps): HookResult {
  const session = {
    id: text(input.session_id),
    reason: text(input.reason),
    cwd: deps.realPath(text(input.cwd)),
  };
  if (!sessionEndRuns(session.id, session.reason)) return { exitCode: 0 };
  const found = layoutFor(input, env, deps);
  if (!hasRepo(found.kind)) return { exitCode: 0 };
  // git prints symlink-resolved paths, so ownership comes from the session marker, not from
  // comparing against the worktrees folder
  const listing = git(deps, found.repoDir, ["worktree", "list", "--porcelain"]);
  const notes = linkedPaths(listing.stdout.split("\n"))
    .map((path) => sessionEndOne(deps, found.repoDir, path, session))
    .filter((note) => note !== "");
  return notes.length > 0 ? { exitCode: 0, stderr: notes.join("\n") } : { exitCode: 0 };
}

type Handler = (input: Input, env: Env, deps: Deps) => HookResult;

const handlers: Record<string, Handler> = {
  create,
  remove,
  "subagent-stop": subagentStop,
  "session-end": sessionEnd,
};

/** Dispatch one hook event. */
export function main(
  event: string | undefined,
  stdinText: string,
  env: Env,
  deps: Deps = systemDeps,
): HookResult {
  const handler = Object.hasOwn(handlers, String(event)) ? handlers[String(event)] : undefined;
  if (!handler) {
    return {
      exitCode: 1,
      stderr: `Unknown event "${event}": use create, remove, subagent-stop or session-end`,
    };
  }
  let input: unknown;
  try {
    input = JSON.parse(stdinText);
  } catch {
    return { exitCode: 1, stderr: "Hook input is not JSON" };
  }
  return handler(typeof input === "object" && input !== null ? (input as Input) : {}, env, deps);
}

// Run only when executed directly, not when imported by the tests
if (import.meta.url === pathToFileURL(realpathSync(String(process.argv[1]))).href) {
  const result = main(process.argv[2], readFileSync(0, "utf8"), process.env);
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.exitCode;
}
