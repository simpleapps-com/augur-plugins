# simpleapps-worktrees

**Claude Code only.** For SimpleApps developers. It does nothing in claude.ai chat or Cowork.

A hooks plugin: Claude Code's [worktree hooks](https://code.claude.com/docs/en/hooks) (`WorktreeCreate`, `WorktreeRemove`), plus `SubagentStop` and `SessionEnd` cleanup, so `claude -w <name>` and subagent worktrees land where SimpleApps projects keep them and committed or tracked work is never removed:

- **Where:** `{project}/worktrees/<name>` in the SimpleApps layout (`{project}/repo` is the git repo), or `<repo>/.claude/worktrees/<name>` in a plain repo. A folder that is itself a repo wins over a nested `repo/`; a session started in a subfolder of a plain repo uses that repo.
- **Detached:** each worktree is made with `git worktree add --detach`, so there is no local branch to clean up.
- **Keeps work git can see:** a worktree is removed only when `git status --porcelain` prints nothing, no commit in it is missing from every branch and remote, and no branch is checked out in it. A check that fails or does not finish counts as work. Removal is plain `git worktree remove`, never `--force`.
- **Gitignored files are not kept.** `git status` does not show them, and `git worktree remove` deletes them with the worktree: an edited `.env`, a local database or build output in a worktree is lost when it is removed. Copy anything you need out first.
- **Session end:** each worktree records the session that made (or re-entered) it; when the session ends, its worktrees that hold no work are removed, except the one the session is in. Nothing is removed on `/clear` or `/resume`.

This hooks plugin runs scripts on your machine with your permissions. It is its own plugin, so it can be turned off on its own in `/plugin`.

## Install

Requires Node 22.18 or later on your `PATH`: the hook is TypeScript run directly by [Node's type stripping](https://nodejs.org/api/typescript.html#type-stripping).

```
/plugin install simpleapps-worktrees --marketplace simpleapps-com/augur-plugins
/reload-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install simpleapps-worktrees@augur`.

Moving from the `augur-skills` marketplace: its `simpleapps` plugin has the same hooks. Uninstall that copy first, or both run.

## How it decides

Every decision is a small TypeScript function in `scripts/worktree-rules.ts`, proved with [LemmaScript](https://www.npmjs.com/package/lemmascript) and [Dafny](https://dafny.org) to match a model (`models/Worktrees.dfy` in this repo); `scripts/worktree.ts` only reads files, runs git and reports.

- **Create** (`WorktreeCreate`): the name MUST match `^[A-Za-z0-9][A-Za-z0-9._-]*$` and not contain `..`, so it is one folder name. An existing worktree at the path is re-entered; any other folder there is refused. A new worktree starts from Claude Code's `worktree.baseRef` setting, read from `.claude/settings.local.json`, then `.claude/settings.json`, then your user settings: `fresh` (the default) starts from `origin/HEAD` (else `origin/main`, else `origin/master`, else local `HEAD`), fetching it first unless the repo fetched in the last day (10 second limit; a failed fetch only warns); `head` starts from the main checkout's commit. Files listed in `.worktreeinclude` that are also gitignored (such as `.env`) are copied in. When the worktree has a `pnpm-lock.yaml`, `pnpm install --frozen-lockfile` runs (not for subagent worktrees, `agent-*`), then lefthook's git hooks are pointed back at the main checkout.
- **Remove** (`WorktreeRemove`): looks only at a path `git worktree list` shows as a linked worktree of the repo (symlinks resolved), never the main checkout or another folder, and removes it only when it holds no work; otherwise exits non-zero so Claude Code keeps it.
- **Subagent stop** (`SubagentStop`): removes the subagent's `agent-<agent_id>` worktree when it holds no work. That folder name was seen in use (Claude Code 2.1.322); the docs do not state it. An id that does not make a valid name is ignored.
- **Session end** (`SessionEnd`): removes only worktrees recorded for the ending session, outside the folder the session is in, that hold no work. It always exits 0. The session marker (`claude-session` in the worktree's git folder) is compared exactly, not trimmed: this hook writes the bare id, so a marker with a newline or spaces was written by something else, and that worktree is kept.

git runs with `GIT_TERMINAL_PROMPT=0` and, unless you set your own `GIT_SSH_COMMAND`, `ssh -o BatchMode=yes`, so a hook never waits on a password prompt.

Where it differs from Claude Code's own worktree setup ([worktrees docs](https://code.claude.com/docs/en/worktrees)): `head` mode starts from the main checkout's commit, where Claude Code uses the current worktree's `HEAD` when run inside one; the fetch gives up after 10 seconds, where Claude Code's is capped at five.

## Limits

- `claude -w "#<PR>"` starts from the default branch, not the PR's head, which Claude Code's own setup fetches ([worktrees docs](https://code.claude.com/docs/en/worktrees)).
- Session-end cleanup is best-effort. The [hooks docs](https://code.claude.com/docs/en/hooks) give SessionEnd hooks a shared 1.5-second budget, raised to match a longer per-hook `timeout` (up to 60 seconds) set in settings; whether this plugin's `timeout` of 30 raises it is not verified. With several worktrees some can be left behind; launching with `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS=30000 claude` gives it more time.
- `ExitWorktree` refuses to remove a hook-made worktree unless Claude passes `discard_changes: true` ([hooks docs](https://code.claude.com/docs/en/hooks)); the hook is then the only check, and it still keeps a worktree holding work.
- On Windows, `pnpm` starts through `cmd.exe`, and the hook refuses to run it when a path holds `"`, `%`, `!`, `&`, `|`, `<`, `>`, `^` or a line break, rather than let `cmd.exe` read it; the install then only warns. The Windows path is untested on Windows itself.

## Privacy

The hooks read your project's git state and settings files and run `git` (and `pnpm` when a lockfile is present) locally. The only network traffic is what those commands do: `git fetch` from your repo's `origin`, and `pnpm install` from your package registry. `plugin.json` declares `github.com` and `registry.npmjs.org`, the hosts for a GitHub repo using npm packages; a repo with another remote or registry reaches that host instead. The declaration informs and blocks nothing ([plugin manifest](https://code.claude.com/docs/en/plugins-reference.md)), and command hooks run with your full access, outside Claude Code's sandbox ([sandboxing](https://code.claude.com/docs/en/sandboxing.md)). Nothing is sent to SimpleApps. See the [SimpleApps privacy policy](https://www.simpleapps.com/privacy).

## Develop

From the root of this repo:

```bash
pnpm proofs      # the model, the proved rules and their link
pnpm quality     # includes tests/worktrees/, which run real git in temp folders
claude plugin validate plugins/simpleapps-worktrees
```
