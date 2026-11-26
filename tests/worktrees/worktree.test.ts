// The worktree hooks' shell (plugins/simpleapps-worktrees/scripts/worktree.ts) with fake side
// effects: which git commands each hook runs, and what it reports. Ported from augur-skills GH #77
// (`hooks/worktree.test.mjs`). The real git runs are in end-to-end.test.ts.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import {
  childEnv,
  configuredMode,
  create,
  main,
  remove,
  resolveLayout,
  runOn,
  sessionEnd,
  spawnPlan,
  subagentStop,
  systemDeps,
  workOf,
  type Deps,
  type RunResult,
} from "../../plugins/simpleapps-worktrees/scripts/worktree.ts";

const PROJECT = "/project";
const REPO = join(PROJECT, "repo");
const LAYOUT = { CLAUDE_PROJECT_DIR: PROJECT };
const roots: string[] = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Response = Partial<RunResult>;

/** What an untouched detached worktree in a repo with an origin looks like. */
const DEFAULT_RESPONSES: Record<string, Response> = {
  "symbolic-ref -q HEAD": { status: 1 },
  "symbolic-ref --short refs/remotes/origin/HEAD": { stdout: "origin/main\n" },
  "rev-parse --git-path FETCH_HEAD": { stdout: ".git/FETCH_HEAD\n" },
  "rev-parse --show-toplevel": { status: 128 },
  "worktree list --porcelain": {
    stdout: `worktree ${REPO}\nHEAD a\nbranch refs/heads/main\n\nworktree ${join(PROJECT, "worktrees", "feat-77")}\nHEAD b\ndetached\n`,
  },
};

interface FakeOptions {
  existing?: string[];
  responses?: Record<string, Response>;
  fetchedMsAgo?: number | null;
  files?: Record<string, string>;
  failing?: string[];
}

interface Fake extends Deps {
  calls: string[];
  timeouts: (number | undefined)[];
  written: Record<string, string>;
  copied: string[];
}

/**
 * Fake side effects. `responses` maps a substring of the command line to the result it returns,
 * checked before DEFAULT_RESPONSES; unmatched commands succeed with no output. `files` is what
 * readText sees; writeText and copyFile record into `written` and `copied`, and throw for a path
 * listed in `failing`.
 */
function fakeDeps(options: FakeOptions = {}): Fake {
  const existing = options.existing ?? [join(REPO, ".git")];
  const responses = options.responses ?? {};
  const files = options.files ?? {};
  const failing = options.failing ?? [];
  const calls: string[] = [];
  const timeouts: (number | undefined)[] = [];
  const written: Record<string, string> = {};
  const copied: string[] = [];
  const find = (table: Record<string, Response>, line: string) =>
    Object.keys(table).find((pattern) => line.includes(pattern));
  const failFor = (path: string) => {
    if (failing.includes(path)) throw new Error(`cannot write ${path}`);
  };
  return {
    calls,
    timeouts,
    written,
    copied,
    exists: (path) => existing.includes(path),
    modifiedMsAgo: () => options.fetchedMsAgo ?? null,
    readText: (path) => files[path] ?? null,
    realPath: (path) => path,
    writeText: (path, text) => {
      failFor(path);
      written[path] = text;
    },
    copyFile: (from, to) => {
      failFor(to);
      copied.push(`${from} -> ${to}`);
    },
    run: (command, args, timeoutMs) => {
      const line = [command, ...args].join(" ");
      calls.push(line);
      timeouts.push(timeoutMs);
      const own = find(responses, line);
      const fallback = find(DEFAULT_RESPONSES, line);
      const response = own ? responses[own] : fallback ? DEFAULT_RESPONSES[fallback] : {};
      return { status: 0, stdout: "", stderr: "", ...response };
    },
  };
}

test("resolveLayout: a repo folder wins, then the project layout, then a repo above", () => {
  assert.deepEqual(resolveLayout(PROJECT, fakeDeps()), {
    kind: "project-repo",
    repoDir: REPO,
    worktreesDir: join(PROJECT, "worktrees"),
    projectDir: PROJECT,
  });
  // A plain repo that happens to contain repo/.git is still the plain repo
  const nested = fakeDeps({ existing: ["/plain/.git", "/plain/repo/.git"] });
  assert.deepEqual(resolveLayout("/plain", nested), {
    kind: "own-repo",
    repoDir: "/plain",
    worktreesDir: join("/plain", ".claude", "worktrees"),
    projectDir: "/plain",
  });
  assert.equal(nested.calls.length, 0);
  const subfolder = fakeDeps({
    existing: [],
    responses: { "--show-toplevel": { stdout: "/plain\n" } },
  });
  const above = resolveLayout("/plain/src", subfolder);
  assert.equal(above.repoDir, "/plain");
  assert.equal(above.worktreesDir, join("/plain", ".claude", "worktrees"));
  assert.equal(resolveLayout("/nothing", fakeDeps({ existing: [] })).kind, "no-repo");
  const emptyTop = fakeDeps({ existing: [], responses: { "--show-toplevel": { stdout: "" } } });
  assert.deepEqual(resolveLayout("/odd", emptyTop), {
    kind: "no-repo",
    repoDir: "",
    worktreesDir: "",
    projectDir: "/odd",
  });
});

test("childEnv stops git prompting and keeps a user's own ssh command", () => {
  const env = childEnv({ PATH: "/bin" });
  assert.equal(env.PATH, "/bin");
  assert.equal(env.GIT_TERMINAL_PROMPT, "0");
  assert.equal(env.GIT_SSH_COMMAND, "ssh -o BatchMode=yes");
  assert.equal(childEnv({ GIT_SSH_COMMAND: "ssh -i key" }).GIT_SSH_COMMAND, "ssh -i key");
});

test("create makes a detached worktree from a bounded fetch of the default branch, then installs", () => {
  const path = join(PROJECT, "worktrees", "feat-77");
  const deps = fakeDeps({ existing: [join(REPO, ".git"), join(path, "pnpm-lock.yaml")] });
  assert.deepEqual(create({ name: "feat-77" }, LAYOUT, deps), {
    exitCode: 0,
    stdout: path,
    stderr: "",
  });
  assert.deepEqual(deps.calls, [
    `git -C ${REPO} symbolic-ref --short refs/remotes/origin/HEAD`,
    `git -C ${REPO} rev-parse --verify -q origin/main`,
    `git -C ${REPO} rev-parse --verify -q origin/master`,
    `git -C ${REPO} rev-parse --git-path FETCH_HEAD`,
    `git -C ${REPO} fetch -q origin main`,
    `git -C ${REPO} worktree add -q --detach -- ${path} origin/main`,
    `pnpm --dir ${path} install --frozen-lockfile`,
  ]);
  assert.equal(deps.timeouts[4], 10_000);
});

test("create points shared lefthook hooks back at the main checkout after installing", () => {
  const path = join(PROJECT, "worktrees", "feat-77");
  const existing = [
    join(REPO, ".git"),
    join(path, "pnpm-lock.yaml"),
    join(REPO, "lefthook.yml"),
    join(REPO, "node_modules"),
  ];
  const deps = fakeDeps({ existing });
  assert.equal(create({ name: "feat-77" }, LAYOUT, deps).stderr, "");
  assert.equal(deps.calls.at(-1), `pnpm --dir ${REPO} exec lefthook install`);

  const failing = fakeDeps({
    existing,
    responses: { "exec lefthook": { status: 1, stderr: "x" } },
  });
  const warned = create({ name: "feat-77" }, LAYOUT, failing);
  assert.equal(warned.exitCode, 0);
  assert.match(String(warned.stderr), /git hooks may point at this worktree/);

  // No lefthook config, or the main checkout has no node_modules: nothing to restore
  for (const dropped of ["lefthook.yml", "node_modules"]) {
    const without = fakeDeps({ existing: existing.filter((file) => !file.endsWith(dropped)) });
    create({ name: "feat-77" }, LAYOUT, without);
    assert.ok(!without.calls.some((line) => line.includes("lefthook")), dropped);
  }
});

test("configuredMode reads worktree.baseRef: local, then project, then user settings", () => {
  const local = join(PROJECT, ".claude", "settings.local.json");
  const shared = join(PROJECT, ".claude", "settings.json");
  const user = join("/home/me", ".claude", "settings.json");
  const env = { HOME: "/home/me" };
  const head = JSON.stringify({ worktree: { baseRef: "head" } });
  const fresh = JSON.stringify({ worktree: { baseRef: "fresh" } });
  const read = (files: Record<string, string>) => configuredMode(PROJECT, env, fakeDeps({ files }));

  assert.equal(read({}), "from-remote");
  assert.equal(read({ [user]: head }), "from-head");
  assert.equal(read({ [user]: head, [shared]: fresh }), "from-remote");
  assert.equal(read({ [shared]: fresh, [local]: head }), "from-head");
  // Broken JSON, a branch name, no worktree key, or not an object fall through to the next file
  assert.equal(
    read({ [local]: "{", [shared]: '{"worktree":{"baseRef":"dev"}}', [user]: head }),
    "from-head",
  );
  assert.equal(read({ [local]: "null", [shared]: '{"worktree":7}', [user]: head }), "from-head");
  assert.equal(read({ [local]: '{"worktree":{"baseRef":1}}' }), "from-remote");
  const cfgDeps = fakeDeps({ files: { [join("/cfg", "settings.json")]: head } });
  assert.equal(configuredMode(PROJECT, { CLAUDE_CONFIG_DIR: "/cfg" }, cfgDeps), "from-head");
  assert.equal(configuredMode(PROJECT, {}, fakeDeps({ files: { [user]: head } })), "from-remote");
});

test("create with worktree.baseRef head starts from local HEAD without fetching", () => {
  const settings = join(PROJECT, ".claude", "settings.json");
  const deps = fakeDeps({ files: { [settings]: '{"worktree":{"baseRef":"head"}}' } });
  const result = create({ name: "local" }, LAYOUT, deps);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(deps.calls.at(-1) ?? "", /--detach -- \S+local HEAD$/);
  assert.ok(!deps.calls.some((line) => line.includes(" fetch ")));
});

test("create skips the fetch when the repo fetched within a day", () => {
  const recent = fakeDeps({ fetchedMsAgo: 60_000.5 });
  create({ name: "docs" }, LAYOUT, recent);
  assert.ok(!recent.calls.some((line) => line.includes(" fetch ")));
  const stale = fakeDeps({ fetchedMsAgo: 2 * 24 * 60 * 60 * 1000 });
  create({ name: "docs" }, LAYOUT, stale);
  assert.ok(stale.calls.some((line) => line.includes(" fetch ")));
  const unreadable = fakeDeps({
    fetchedMsAgo: 60_000,
    responses: { "--git-path": { status: 128 } },
  });
  create({ name: "docs" }, LAYOUT, unreadable);
  assert.ok(unreadable.calls.some((line) => line.includes(" fetch ")));
});

test("create warns but succeeds when fetch or install fails", () => {
  const path = join(PROJECT, "worktrees", "feat-77");
  const deps = fakeDeps({
    existing: [join(REPO, ".git"), join(path, "pnpm-lock.yaml")],
    responses: {
      " fetch ": { status: 1, stderr: "offline\n" },
      pnpm: { status: 1, stderr: "lockfile out of date\n" },
    },
  });
  const result = create({ name: "feat-77" }, LAYOUT, deps);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, path);
  assert.match(String(result.stderr), /fetch failed, using local origin\/main: offline/);
  assert.match(String(result.stderr), /pnpm install failed.*lockfile out of date/);
  const timedOut = create(
    { name: "x" },
    LAYOUT,
    fakeDeps({ responses: { " fetch ": { status: -1 } } }),
  );
  assert.match(String(timedOut.stderr), /fetch failed.*timed out/);
});

test("create falls back to origin/main, origin/master, then local HEAD with a warning", () => {
  const noRemoteHead = { "refs/remotes/origin/HEAD": { status: 128 } };
  const main = fakeDeps({ responses: noRemoteHead });
  create({ name: "x" }, LAYOUT, main);
  assert.match(main.calls.at(-1) ?? "", /--detach -- \S+ origin\/main$/);

  const master = fakeDeps({ responses: { ...noRemoteHead, "origin/main": { status: 1 } } });
  create({ name: "x" }, LAYOUT, master);
  assert.match(master.calls.at(-1) ?? "", /--detach -- \S+ origin\/master$/);

  const none = fakeDeps({ responses: { ...noRemoteHead, "--verify": { status: 1 } } });
  const result = create({ name: "agent-abc" }, LAYOUT, none);
  assert.equal(result.exitCode, 0);
  assert.match(String(result.stderr), /no origin default branch/);
  assert.match(none.calls.at(-1) ?? "", /--detach -- \S+agent-abc HEAD$/);
  assert.ok(!none.calls.some((line) => line.includes(" fetch ")));
});

test("create skips install for subagents and lockfile-less repos, using cwd without CLAUDE_PROJECT_DIR", () => {
  const agentPath = join(PROJECT, "worktrees", "agent-a1");
  const agent = fakeDeps({ existing: [join(REPO, ".git"), join(agentPath, "pnpm-lock.yaml")] });
  create({ name: "agent-a1" }, LAYOUT, agent);
  assert.ok(!agent.calls.some((line) => line.startsWith("pnpm")));
  const noLock = fakeDeps();
  assert.equal(create({ name: "docs", cwd: PROJECT }, {}, noLock).exitCode, 0);
  assert.ok(!noLock.calls.some((line) => line.startsWith("pnpm")));
});

test("create re-enters an existing worktree but refuses a folder that is not one", () => {
  const path = join(PROJECT, "worktrees", "kept");
  const kept = fakeDeps({ existing: [join(REPO, ".git"), path, join(path, ".git")] });
  assert.deepEqual(create({ name: "kept" }, LAYOUT, kept), {
    exitCode: 0,
    stdout: path,
    stderr: "",
  });
  assert.equal(kept.calls.length, 0);
  const stray = create(
    { name: "kept" },
    LAYOUT,
    fakeDeps({ existing: [join(REPO, ".git"), path] }),
  );
  assert.equal(stray.exitCode, 1);
  assert.match(String(stray.stderr), /is not a git worktree/);
});

test("create fails on a bad name, a missing repo, or a failed git worktree add", () => {
  for (const name of [undefined, "", 42]) {
    const missing = create({ name }, LAYOUT, fakeDeps());
    assert.equal(missing.exitCode, 1);
    assert.match(String(missing.stderr), /missing/);
  }
  const bad = create({ name: "../x" }, LAYOUT, fakeDeps());
  assert.equal(bad.exitCode, 1);
  assert.match(String(bad.stderr), /MUST be letters/);
  const noRepo = create({ name: "x" }, { CLAUDE_PROJECT_DIR: "/elsewhere" }, fakeDeps());
  assert.equal(noRepo.exitCode, 1);
  assert.match(String(noRepo.stderr), /No git repo for worktrees at \/elsewhere/);
  assert.equal(create({ name: "x" }, {}, fakeDeps()).exitCode, 1);
  const failedAdd = create(
    { name: "x" },
    LAYOUT,
    fakeDeps({ responses: { "worktree add": { status: 128, stderr: "already exists\n" } } }),
  );
  assert.equal(failedAdd.exitCode, 1);
  assert.match(String(failedAdd.stderr), /git worktree add failed: already exists/);
});

test("workOf reads every kind of work a removal would lose", () => {
  const path = "/project/worktrees/x";
  assert.deepEqual(workOf(fakeDeps(), path), { held: "no-work", branch: "" });
  const cases: [Record<string, Response>, string][] = [
    [{ "status --porcelain": { stdout: "?? new.txt\n" } }, "uncommitted"],
    [{ "rev-list": { stdout: "abc123\n" } }, "unpushed"],
    [{ "symbolic-ref -q HEAD": { status: 0, stdout: "refs/heads/feature-x\n" } }, "on-branch"],
    [{ "status --porcelain": { status: 128 } }, "unreadable"],
    [{ "rev-list": { status: -1 } }, "unreadable"],
    [{ "symbolic-ref -q HEAD": { status: -1 } }, "unreadable"],
  ];
  for (const [responses, held] of cases)
    assert.equal(workOf(fakeDeps({ responses }), path).held, held, held);
});

test("remove checks for work first, never forces, and keeps the worktree on any doubt", () => {
  const path = join(PROJECT, "worktrees", "feat-77");
  const clean = fakeDeps();
  assert.deepEqual(remove({ worktree_path: path }, LAYOUT, clean), { exitCode: 0 });
  assert.equal(clean.calls.at(-1), `git -C ${REPO} worktree remove -- ${path}`);
  assert.ok(!clean.calls.some((line) => line.includes("--force") || / -f\b/.test(line)));

  const kinds: [Record<string, Response>, RegExp][] = [
    [{ "rev-list": { stdout: "abc123\n" } }, /commits no branch or remote holds/],
    [{ "status --porcelain": { stdout: " M a\n" } }, /uncommitted or untracked/],
    [
      { "symbolic-ref -q HEAD": { status: 0, stdout: "refs/heads/x\n" } },
      /branch x is checked out/,
    ],
    [{ "status --porcelain": { status: -1 } }, /could not be read/],
  ];
  for (const [responses, why] of kinds) {
    const held = fakeDeps({ responses });
    const kept = remove({ worktree_path: path }, LAYOUT, held);
    assert.equal(kept.exitCode, 1);
    assert.match(String(kept.stderr), why);
    assert.ok(!held.calls.some((line) => line.includes("worktree remove")));
  }

  const refused = fakeDeps({
    responses: { "worktree remove": { status: 128, stderr: "locked\n" } },
  });
  const locked = remove({ worktree_path: path }, LAYOUT, refused);
  assert.equal(locked.exitCode, 1);
  assert.match(String(locked.stderr), /Kept .*locked/);
  const missing = remove({}, LAYOUT, fakeDeps());
  assert.equal(missing.exitCode, 1);
  assert.match(String(missing.stderr), /worktree_path is missing/);
  const noRepo = fakeDeps();
  const elsewhere = remove({ worktree_path: "/x" }, { CLAUDE_PROJECT_DIR: "/elsewhere" }, noRepo);
  assert.equal(elsewhere.exitCode, 1);
  assert.match(String(elsewhere.stderr), /No git repo/);
  assert.ok(!noRepo.calls.some((line) => line.includes("worktree list")));
});

test("remove looks only at a linked worktree git lists for this repo", () => {
  // The main checkout, a folder git does not list, and a path that is only a prefix of one
  for (const path of [REPO, join(PROJECT, "worktrees", "other"), join(PROJECT, "worktrees")]) {
    const deps = fakeDeps();
    const kept = remove({ worktree_path: path }, LAYOUT, deps);
    assert.equal(kept.exitCode, 1, path);
    assert.match(String(kept.stderr), /is not a linked worktree of/);
    assert.ok(!deps.calls.some((line) => line.includes("status") || line.includes("remove")));
  }
  // A path through a symlink is resolved first, as git lists it
  const linked = join(PROJECT, "worktrees", "feat-77");
  const viaLink = { ...fakeDeps(), realPath: (path: string) => (path === "/link" ? linked : path) };
  assert.deepEqual(remove({ worktree_path: "/link" }, LAYOUT, viaLink), { exitCode: 0 });
});

test("subagentStop removes an unchanged subagent worktree and keeps one holding work", () => {
  const path = join(PROJECT, "worktrees", "agent-a1");
  const existing = [join(REPO, ".git"), path];
  const clean = fakeDeps({ existing });
  assert.deepEqual(subagentStop({ agent_id: "a1" }, LAYOUT, clean), { exitCode: 0 });
  assert.equal(clean.calls.at(-1), `git -C ${REPO} worktree remove -- ${path}`);

  const branched = fakeDeps({
    existing,
    responses: { "symbolic-ref -q HEAD": { status: 0, stdout: "refs/heads/x\n" } },
  });
  const kept = subagentStop({ agent_id: "a1" }, LAYOUT, branched);
  assert.equal(kept.exitCode, 0);
  assert.match(String(kept.stderr), /Kept .*branch x/);
  assert.ok(!branched.calls.some((line) => line.includes("worktree remove")));
});

test("subagentStop is a no-op without a valid agent id, a repo, or a worktree, and never fails", () => {
  assert.deepEqual(subagentStop({}, LAYOUT, fakeDeps()), { exitCode: 0 });
  const escaping = fakeDeps({ existing: [join(REPO, ".git"), join(PROJECT, "repo")] });
  assert.deepEqual(subagentStop({ agent_id: "x/../../repo" }, LAYOUT, escaping), { exitCode: 0 });
  assert.equal(escaping.calls.length, 0);
  const elsewhere = { CLAUDE_PROJECT_DIR: "/elsewhere" };
  assert.deepEqual(subagentStop({ agent_id: "a1" }, elsewhere, fakeDeps()), { exitCode: 0 });
  const noFolder = fakeDeps();
  assert.deepEqual(subagentStop({ agent_id: "a1" }, LAYOUT, noFolder), { exitCode: 0 });
  assert.equal(noFolder.calls.length, 0);
  const path = join(PROJECT, "worktrees", "agent-a1");
  const failed = subagentStop(
    { agent_id: "a1" },
    LAYOUT,
    fakeDeps({
      existing: [join(REPO, ".git"), path],
      responses: { "worktree remove": { status: 128, stderr: "locked\n" } },
    }),
  );
  assert.equal(failed.exitCode, 0);
  assert.match(String(failed.stderr), /Could not remove .*locked/);
});

test("spawnPlan starts commands directly, except non-git commands on Windows via a quoted shell line", () => {
  assert.deepEqual(spawnPlan("darwin", "pnpm", ["--dir", 'a"b&c']), {
    kind: "direct",
    command: "pnpm",
    args: ["--dir", 'a"b&c'],
  });
  assert.deepEqual(spawnPlan("win32", "git", ["-C", "C:\\a&b"]), {
    kind: "direct",
    command: "git",
    args: ["-C", "C:\\a&b"],
  });
  assert.deepEqual(spawnPlan("win32", "pnpm", ["--dir", "C:\\a b", "install"]), {
    kind: "via-shell",
    command: 'pnpm "--dir" "C:\\a b" "install"',
    args: [],
  });
  assert.equal(spawnPlan("win32", "pnpm", ["--dir", "C:\\R&D"]).kind, "refused-shell");
});

test("runOn Windows refuses a shell line cmd.exe would read, and runs nothing", () => {
  for (const arg of ['C:\\a"b', "C:\\100%", "C:\\R&D", "a|b", "a^b", "a!b", "a\nb"]) {
    const result = runOn("win32")("pnpm", ["--dir", arg, "install"]);
    assert.equal(result.status, -1, arg);
    assert.match(result.stderr, /not run: pnpm starts through cmd\.exe/);
  }
  assert.equal(runOn("win32")("git", ["--version"]).status, 0);
});

test("create records the session that made the worktree", () => {
  const gitDir = "/project/repo/.git/worktrees/feat-77";
  const responses = { "--absolute-git-dir": { stdout: `${gitDir}\n` } };
  const deps = fakeDeps({ responses });
  assert.equal(create({ name: "feat-77", session_id: "s1" }, LAYOUT, deps).stderr, "");
  assert.deepEqual(deps.written, { [join(gitDir, "claude-session")]: "s1" });

  const noGitDir = fakeDeps({ responses: { "--absolute-git-dir": { status: 128 } } });
  const warned = create({ name: "feat-77", session_id: "s1" }, LAYOUT, noGitDir);
  assert.match(String(warned.stderr), /could not record the session/);

  const unwritable = fakeDeps({ responses, failing: [join(gitDir, "claude-session")] });
  const failed = create({ name: "feat-77", session_id: "s1" }, LAYOUT, unwritable);
  assert.equal(failed.exitCode, 0);
  assert.match(String(failed.stderr), /could not record the session/);
});

test("re-entering a kept worktree records the new session as its owner", () => {
  const path = join(PROJECT, "worktrees", "kept");
  const gitDir = "/project/repo/.git/worktrees/kept";
  const existing = [join(REPO, ".git"), path, join(path, ".git")];
  const responses = { "--absolute-git-dir": { stdout: `${gitDir}\n` } };
  const deps = fakeDeps({ existing, responses });
  const reentered = create({ name: "kept", session_id: "s2" }, LAYOUT, deps);
  assert.deepEqual(reentered, { exitCode: 0, stdout: path, stderr: "" });
  assert.deepEqual(deps.written, { [join(gitDir, "claude-session")]: "s2" });

  const noGitDir = fakeDeps({ existing, responses: { "--absolute-git-dir": { status: 128 } } });
  const warned = create({ name: "kept", session_id: "s2" }, LAYOUT, noGitDir);
  assert.equal(warned.exitCode, 0);
  assert.match(String(warned.stderr), /could not record the session/);
});

test("create copies .worktreeinclude matches that are also gitignored", () => {
  const path = join(PROJECT, "worktrees", "feat-77");
  const existing = [join(REPO, ".git"), join(REPO, ".worktreeinclude")];
  const deps = fakeDeps({
    existing,
    failing: [join(path, "broken.env")],
    responses: {
      "ls-files": { stdout: ".env\nconfig/local.env\ntracked-looking.env\nbroken.env\n" },
      "check-ignore": { stdout: ".env\nconfig/local.env\nbroken.env\n" },
    },
  });
  const result = create({ name: "feat-77" }, LAYOUT, deps);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(deps.copied, [
    `${join(REPO, ".env")} -> ${join(path, ".env")}`,
    `${join(REPO, "config/local.env")} -> ${join(path, "config/local.env")}`,
  ]);
  assert.match(String(result.stderr), /could not copy broken\.env/);
  assert.ok(
    deps.calls.includes(
      `git -C ${REPO} check-ignore -- .env config/local.env tracked-looking.env broken.env`,
    ),
  );

  const nothing = fakeDeps({ existing });
  create({ name: "feat-77" }, LAYOUT, nothing);
  assert.ok(!nothing.calls.some((line) => line.includes("check-ignore")));
  const noFile = fakeDeps();
  create({ name: "feat-77" }, LAYOUT, noFile);
  assert.ok(!noFile.calls.some((line) => line.includes("ls-files")));
});

test("sessionEnd removes this session's worktrees that hold no work, and nothing else", () => {
  const wt = (name: string) => join(PROJECT, "worktrees", name);
  const listing = [
    REPO,
    ...["mine", "other", "dirty", "here", "stuck", "unknown", "spaced", "unmarked"].map(wt),
  ]
    .map((path) => `worktree ${path}\nHEAD abc\ndetached\n`)
    .join("\n");
  const gitDirFor = (name: string) => ({
    [`-C ${wt(name)} rev-parse --absolute-git-dir`]: { stdout: `/gd/${name}\n` },
  });
  const deps = fakeDeps({
    responses: {
      "worktree list --porcelain": { stdout: `${listing}worktree /elsewhere/x\n` },
      ...gitDirFor("mine"),
      ...gitDirFor("other"),
      ...gitDirFor("dirty"),
      ...gitDirFor("here"),
      ...gitDirFor("stuck"),
      ...gitDirFor("spaced"),
      ...gitDirFor("unmarked"),
      [`-C ${wt("unknown")} rev-parse --absolute-git-dir`]: { status: 128 },
      [`-C ${wt("dirty")} status --porcelain`]: { stdout: "?? x\n" },
      [`worktree remove -- ${wt("stuck")}`]: { status: 128, stderr: "locked\n" },
    },
    files: {
      "/gd/mine/claude-session": "s1",
      "/gd/other/claude-session": "s2",
      "/gd/dirty/claude-session": "s1",
      "/gd/here/claude-session": "s1",
      "/gd/stuck/claude-session": "s1",
      // Not written by this hook: only the exact session id counts
      "/gd/spaced/claude-session": "s1\n",
    },
  });
  const cwd = join(wt("here"), "src");
  const result = sessionEnd({ session_id: "s1", reason: "other", cwd }, LAYOUT, deps);
  assert.equal(result.exitCode, 0);
  const removals = deps.calls.filter((line) => line.includes("worktree remove"));
  assert.deepEqual(removals, [
    `git -C ${REPO} worktree remove -- ${wt("mine")}`,
    `git -C ${REPO} worktree remove -- ${wt("stuck")}`,
  ]);
  assert.match(String(result.stderr), /Kept .*dirty: it has uncommitted/);
  assert.match(String(result.stderr), /Could not remove .*stuck: locked/);

  const quiet = fakeDeps({ responses: { "worktree list": { stdout: `worktree ${REPO}\n` } } });
  assert.deepEqual(sessionEnd({ session_id: "s1" }, LAYOUT, quiet), { exitCode: 0 });
});

test("sessionEnd does nothing without a session, on /clear or /resume, or without a repo", () => {
  for (const input of [
    {},
    { session_id: "s1", reason: "clear" },
    { session_id: "s1", reason: "resume" },
  ]) {
    const deps = fakeDeps();
    assert.deepEqual(sessionEnd(input, LAYOUT, deps), { exitCode: 0 });
    assert.equal(deps.calls.length, 0);
  }
  const elsewhere = { CLAUDE_PROJECT_DIR: "/elsewhere" };
  assert.deepEqual(sessionEnd({ session_id: "s1" }, elsewhere, fakeDeps()), { exitCode: 0 });
});

test("main dispatches events and rejects bad input", () => {
  assert.equal(main("bogus", "{}", LAYOUT, fakeDeps()).exitCode, 1);
  assert.match(String(main("toString", "{}", LAYOUT, fakeDeps()).stderr), /Unknown event/);
  assert.match(String(main(undefined, "{}", LAYOUT, fakeDeps()).stderr), /Unknown event/);
  assert.match(String(main("create", "not json", LAYOUT, fakeDeps()).stderr), /not JSON/);
  assert.match(String(main("create", "null", LAYOUT, fakeDeps()).stderr), /missing/);
  assert.equal(main("remove", "{}", LAYOUT, fakeDeps()).exitCode, 1);
  assert.deepEqual(main("subagent-stop", "{}", LAYOUT, fakeDeps()), { exitCode: 0 });
  assert.deepEqual(main("session-end", "{}", LAYOUT, fakeDeps()), { exitCode: 0 });
});

test("systemDeps: process start failure, file age, text read and write, copy into new folders", () => {
  const missing = systemDeps.run("definitely-not-a-command-worktrees", []);
  assert.equal(missing.status, -1);
  assert.equal(missing.stdout, "");
  assert.equal(missing.stderr, "");
  const ok = systemDeps.run("git", ["--version"]);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /git version/);

  const folder = mkdtempSync(join(tmpdir(), "worktree-deps-"));
  roots.push(folder);
  writeFileSync(join(folder, "f"), "");
  const age = systemDeps.modifiedMsAgo(join(folder, "f"));
  // mtime and Date.now() differ in precision, so a fresh file can read a few ms in the future
  assert.ok(age !== null && Math.abs(age) < 60_000);
  assert.equal(systemDeps.modifiedMsAgo(join(folder, "missing")), null);
  assert.equal(systemDeps.exists(join(folder, "f")), true);

  systemDeps.writeText(join(folder, "note"), "hello");
  assert.equal(systemDeps.readText(join(folder, "note")), "hello");
  assert.equal(systemDeps.readText(join(folder, "missing")), null);
  systemDeps.copyFile(join(folder, "note"), join(folder, "deep", "er", "note"));
  assert.equal(systemDeps.readText(join(folder, "deep", "er", "note")), "hello");
  assert.equal(systemDeps.realPath(join(folder, "missing")), join(folder, "missing"));
  assert.ok(systemDeps.realPath(folder).endsWith(folder.split("/").at(-1) ?? "?"));
});
