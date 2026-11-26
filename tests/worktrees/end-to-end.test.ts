// The worktree hooks run the way Claude Code runs them (`node worktree.ts <event>`, hook JSON on
// stdin) against real git repos made under the OS temp folder. git's global and system config are
// shut out, so a user's own config, hooks or signing cannot change what runs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { systemDeps } from "../../plugins/simpleapps-worktrees/scripts/worktree.ts";

const SCRIPT = fileURLToPath(
  new URL("../../plugins/simpleapps-worktrees/scripts/worktree.ts", import.meta.url),
);
const roots: string[] = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A temp folder holding the project, an empty git config and an empty Claude config. */
function sandbox(): { root: string; env: Record<string, string | undefined> } {
  const root = mkdtempSync(join(tmpdir(), "worktree-hook-"));
  roots.push(root);
  writeFileSync(join(root, "gitconfig"), "");
  mkdirSync(join(root, "claude"));
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: join(root, "gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    CLAUDE_CONFIG_DIR: join(root, "claude"),
  };
  return { root, env };
}

/** Run one git command in `dir`, failing the test if it fails. */
function setupGit(env: Record<string, string | undefined>, dir: string, ...args: string[]): void {
  const result = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
}

/** A repo with one commit, a gitignored .env listed in .worktreeinclude. */
function makeRepo(env: Record<string, string | undefined>, repoDir: string): void {
  mkdirSync(repoDir, { recursive: true });
  setupGit(env, repoDir, "init", "-q", "-b", "main");
  writeFileSync(join(repoDir, ".gitignore"), ".env\n");
  writeFileSync(join(repoDir, ".worktreeinclude"), ".env\n");
  writeFileSync(join(repoDir, ".env"), "SECRET=1\n");
  setupGit(env, repoDir, "add", ".gitignore", ".worktreeinclude");
  setupGit(env, repoDir, "commit", "-q", "--no-gpg-sign", "-m", "init");
}

/** Run the hook script the way Claude Code does: event argument, JSON on stdin. */
function runHook(
  env: Record<string, string | undefined>,
  projectDir: string,
  event: string,
  input: object,
) {
  return spawnSync(process.execPath, [SCRIPT, event], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

test("end to end in the SimpleApps layout: create, session end, subagent stop and remove", () => {
  const { root, env } = sandbox();
  const projectDir = join(root, "project");
  makeRepo(env, join(projectDir, "repo"));
  const worktree = (name: string) => join(systemDeps.realPath(projectDir), "worktrees", name);

  const named = runHook(env, projectDir, "create", { name: "feat-77", session_id: "s1" });
  assert.equal(named.status, 0, named.stderr);
  const namedPath = named.stdout.trim();
  assert.equal(systemDeps.realPath(namedPath), worktree("feat-77"));
  assert.equal(systemDeps.readText(join(namedPath, ".env")), "SECRET=1\n");
  // Detached: no branch was made for it
  const head = spawnSync("git", ["-C", namedPath, "symbolic-ref", "-q", "HEAD"], { env });
  assert.equal(head.status, 1);
  const branches = spawnSync("git", ["-C", namedPath, "branch", "--list"], {
    encoding: "utf8",
    env,
  });
  assert.doesNotMatch(branches.stdout, /feat-77/);

  // Session end removes this session's clean worktrees, and leaves another session's alone
  assert.equal(runHook(env, projectDir, "create", { name: "theirs", session_id: "s2" }).status, 0);
  assert.equal(runHook(env, projectDir, "create", { name: "temp", session_id: "s1" }).status, 0);
  const ended = runHook(env, projectDir, "session-end", { session_id: "s1", reason: "other" });
  assert.equal(ended.status, 0, ended.stderr);
  assert.ok(!existsSync(worktree("temp")));
  assert.ok(existsSync(worktree("theirs")));
  // feat-77 holds the gitignored .env only, which is not work: it went too, so recreate it
  assert.ok(!existsSync(worktree("feat-77")));
  assert.equal(runHook(env, projectDir, "create", { name: "feat-77" }).status, 0);

  // Unchanged subagent worktree goes; the worktrees/ folder stays
  assert.equal(runHook(env, projectDir, "create", { name: "agent-a1" }).status, 0);
  assert.equal(runHook(env, projectDir, "subagent-stop", { agent_id: "a1" }).status, 0);
  assert.ok(!existsSync(worktree("agent-a1")));
  assert.ok(existsSync(join(projectDir, "worktrees")));

  // A commit only the detached worktree holds MUST survive a remove request
  setupGit(
    env,
    worktree("feat-77"),
    "commit",
    "-q",
    "--no-gpg-sign",
    "--allow-empty",
    "-m",
    "unpushed",
  );
  const refused = runHook(env, projectDir, "remove", { worktree_path: worktree("feat-77") });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /commits no branch or remote holds/);
  assert.ok(existsSync(worktree("feat-77")));

  // Once a branch holds the commit (the worktree itself stays detached), it can go
  setupGit(env, worktree("feat-77"), "branch", "saved");
  const removed = runHook(env, projectDir, "remove", { worktree_path: worktree("feat-77") });
  assert.equal(removed.status, 0, removed.stderr);
  assert.ok(!existsSync(worktree("feat-77")));

  const unknown = runHook(env, projectDir, "bogus", {});
  assert.equal(unknown.status, 1);
  assert.equal(unknown.stdout, "");
  assert.match(unknown.stderr, /Unknown event/);
});

test("end to end in a plain repo: untracked files and a checked-out branch keep a worktree", () => {
  const { root, env } = sandbox();
  const repoDir = join(root, "plain");
  makeRepo(env, repoDir);
  const made = runHook(env, repoDir, "create", { name: "x", session_id: "s1" });
  assert.equal(made.status, 0, made.stderr);
  const path = made.stdout.trim();
  assert.equal(
    systemDeps.realPath(path),
    join(systemDeps.realPath(repoDir), ".claude", "worktrees", "x"),
  );

  writeFileSync(join(path, "new.txt"), "work\n");
  const untracked = runHook(env, repoDir, "remove", { worktree_path: path });
  assert.equal(untracked.status, 1);
  assert.match(untracked.stderr, /uncommitted or untracked/);
  rmSync(join(path, "new.txt"));

  setupGit(env, path, "switch", "-q", "-c", "topic");
  const onBranch = runHook(env, repoDir, "session-end", { session_id: "s1", reason: "other" });
  assert.equal(onBranch.status, 0);
  assert.match(onBranch.stderr, /branch topic is checked out/);
  assert.ok(existsSync(path));

  setupGit(env, path, "switch", "-q", "--detach");
  const removed = runHook(env, repoDir, "remove", { worktree_path: path });
  assert.equal(removed.status, 0, removed.stderr);
  assert.ok(!existsSync(path));
});
