# Project layout

The full layout of a SimpleApps project folder, what goes where, and why. `SKILL.md` holds the summary; this file holds the detail.

## Contents

- Base folder
- The project folder
- What goes where
- clones/
- goals/
- tmp/
- wip/
- worktrees/
- Symlinks
- settings.<login>.json and settings.local.json
- .simpleapps/
- Default branch

## Base folder

Every project lives under `~/projects/`, in one of two groups (the team's practice):

```
~/projects/
├── clients/      # Client site repos: clients/<site-name>/
├── simpleapps/   # Internal repos (augur-*, shared tools): simpleapps/<repo-name>/
└── workspaces/   # Editor workspace files: <project-name>.code-workspace, one per project
```

`~/Projects/` and `~/projects/` resolve to the same folder on the team's Macs, whose file system ignores case (seen in use). A difference in case MUST NOT be flagged; only a path that does not resolve is an error.

## The project folder

```
{project}/
├── .claude          # → repo/.claude (one symlink for the whole folder)
├── .mcp.json        # → repo/.mcp.json (only when the repo has one)
├── .simpleapps/     # Settings and site profile (not in git)
├── CLAUDE.md        # → repo/.claude/CLAUDE.md
├── clones/          # Read-only clones of other repos and wikis (not in git)
├── goals/           # The goals being worked now (not in git)
├── repo/            # The code repo: simpleapps-com/<name>.git
│   └── .claude/
│       ├── CLAUDE.md
│       ├── rules/
│       ├── settings.<login>.json   # Per user, committed (<login>: the GitHub login)
│       ├── settings.json           # Shared, committed
│       └── settings.local.json     # → settings.<login>.json, gitignored
├── tmp/             # Scratch files (not in git)
├── wiki/            # The wiki repo: simpleapps-com/<name>.wiki.git
├── wip/             # One file per piece of work (not in git)
└── worktrees/       # Git worktrees of repo/, made by Claude Code (not in git)
```

- `{project}/` is not a git repo. It keeps the code and the wiki side by side. Git runs as `git -C repo` (or `git -C wiki`) from `{project}/`.
- A repo-specific folder (a per-person `work/` folder, for one) MUST NOT be added to this layout. The repo's own onboarding (`repo/procedures/onboarding.md`) creates it.
- `repo/` and `wiki/` are git clones and MUST NOT be made with `mkdir`.

## What goes where

| Content | Where | Examples |
|---------|-------|----------|
| Active goals | `goals/` | The objectives of the current cycle or sprint being tracked |
| Always-loaded rules and `CLAUDE.md` | `repo/.claude/` | Short rules pointing to the wiki; a quick reference. `/rules write` composes them |
| Dev docs | `wiki/` | Architecture, guides, specs, conventions |
| Git worktrees | `worktrees/` | `worktrees/agent-<id>` from an isolated subagent |
| One piece of work in progress | `wip/` | `GH42-fix-login.md`, `BC123-new-banner.md` (the `wip` skill) |
| Other repos and wikis | `clones/` | `clones/augur`, `clones/augur.wiki` |
| Product code | `repo/` | Source, tests, configs |
| Scratch files | `tmp/` | Commit messages, PR bodies, intermediate output |
| Settings and site profile | `.simpleapps/` | `settings.json`, `site.json` |

## clones/

`clones/` is the project boundary. Agents MUST stay inside `{project}/`. Another repo or wiki MUST be read through `clones/<name>` or `clones/<name>.wiki`, never by a path into another project folder (`~/projects/<group>/<other>/`). A read blocked by `permissions.blockReadsOutsideWorkingDirectories` ([settings](https://code.claude.com/docs/en/settings#exceptions-to-managed-settings-precedence)) is the boundary working: MUST NOT route around it with `ls`, `rg` or `git -C`.

- Missing clone: ask the user, then `gh repo clone simpleapps-com/<name> clones/<name>` (a wiki: `simpleapps-com/<name>.wiki`, into `clones/<name>.wiki`).
- Pull before reading: `git -C clones/<name> pull`.
- Read-only: MUST NOT edit, commit, push, install into or run tools in `clones/`. To change another repo, file an issue there (`/repo issue`).

## goals/

Project-level scratch space beside `repo/` for the goals being worked now. Short-lived like `wip/`, but scoped to a goal rather than a task: reviewed regularly, archived or deleted when the goal is met. Not in git; lives on one machine. MUST NOT hold durable goals the team shares (those go in `wiki/`) or secrets.

## tmp/

Scratch space beside `repo/`: commit messages, PR and issue bodies, intermediate output, throwaway files. Read, write and delete in it freely; create it if missing; delete each file after use.

- Scratch files MUST go in the project-level `tmp/`, never `repo/tmp/` or `wiki/tmp/`. A file inside a git tree is swept into a commit by `git add -A`; one real incident put a commit message onto a project's main branch that way. A repo MUST NOT have a `tmp/` folder, and its `.gitignore` needs no `tmp/` entry.
- `git -C repo` resolves `-F` and other paths from `repo/`, so a message file there is `../tmp/<file>`: `git -C repo commit -F ../tmp/commit-msg.txt`. `gh` runs from `{project}/`, so its body file is plain `tmp/<file>`.
- `tmp/` is emptied of everything older than one day by `/project init` and `/wip process`: `find tmp -mindepth 1 -mtime +0 -delete`. The one-day margin protects files a running session still needs. Anything worth keeping MUST NOT live in `tmp/`: findings go in `wip/`, durable knowledge in `wiki/`.

## wip/

One file per piece of work: research, plans, decisions, test results. MUST NOT hold secrets, final docs or code. Its schema, names and lifecycle: the `wip` skill.

## worktrees/

Git worktrees of `repo/`, one folder per worktree, not in git. The `simpleapps-worktrees` plugin (Claude Code only) puts each worktree Claude Code makes at `worktrees/<name>` (in a plain repo, `<repo>/.claude/worktrees/<name>`) and never removes one holding work; how it places, starts and cleans up worktrees: its README. Worktrees MUST NOT be made by hand in `tmp/`, `clones/` or inside `repo/`.

- **Sealed.** A session or subagent in a worktree is kept inside it by Claude Code: it cannot write outside it, or read `wip/`, `tmp/`, `wiki/` or `repo/` (seen in use). Workflow commands (`/wip` through `/repo submit`) MUST run from `{project}/`, and a subagent's brief MUST carry the WIP and wiki content it needs.
- **Only what is pushed.** A new worktree holds what is on the default branch, not uncommitted changes in `repo/` (the plugin's README says when local commits come along). Work a subagent needs MUST be pushed first, or its brief MUST say the worktree lacks it.
- **Parallel work** goes to a subagent with worktree isolation; the main session stays in `{project}/` and works on the result by path:
  - Install first: `pnpm --dir worktrees/<name> install --frozen-lockfile`. MUST NOT commit with `--no-verify` when an install failed; install instead. Where the repo uses lefthook, that install points the shared git hooks at the worktree, so MUST then run `pnpm --dir repo exec lefthook install` to point them back at `repo/`; without it, the hooks break once the worktree is removed. The `simpleapps-worktrees` plugin does this itself for the worktrees it makes, except a subagent's `agent-*` worktree, where it installs nothing.
  - Review and test: `git -C worktrees/<name> status`, `pnpm --dir worktrees/<name> test`.
  - Commit: `git -C worktrees/<name> commit -F ../../tmp/commit-msg.txt` (paths resolve from the worktree, two levels down).
  - Push: HEAD is detached, so name the branch: `git -C worktrees/<name> push origin HEAD:refs/heads/<type>/<N>-<slug>`.
  - Remove once pushed or merged: `git -C repo worktree remove ../worktrees/<name>`. Before removing, `git -C worktrees/<name> log --oneline HEAD --not --remotes` MUST print nothing: git refuses only on uncommitted files, so a commit no remote holds would be lost.

These git steps are writes, and run only when the user asks for them (the git-safety rule). `/project init` reports leftover worktrees and what each still holds; it removes none.

## Symlinks

The symlinks let Claude Code run from `{project}/` while everything it loads lives in the repo:

| Symlink | Target | Why |
|---------|--------|-----|
| `{project}/.claude` | `repo/.claude` | Settings and rules; anything added to `repo/.claude/` later appears on its own |
| `{project}/.mcp.json` | `repo/.mcp.json` | The team's shared MCP servers. Only when `repo/.mcp.json` exists |
| `{project}/CLAUDE.md` | `repo/.claude/CLAUDE.md` | Loaded at session start |
| `repo/.claude/settings.local.json` | `settings.<login>.json` | Per-user settings (below). Gitignored |

`CLAUDE.md` and `.mcp.json` link at the project root because Claude Code reads both from `{project}/`, outside `.claude/`. `/project init` creates and repairs them, and migrates a project whose `{project}/.claude/` is still a real folder of per-item symlinks.

## settings.<login>.json and settings.local.json

`.claude/settings.local.json` is the local scope: one person, one project, and kept out of git ([settings](https://code.claude.com/docs/en/settings#settings-files-and-who-they-affect)). The team keeps each person's local settings in `repo/.claude/settings.<login>.json`, committed, so they carry over to a new machine or clone (the team's practice).

- `<login>` MUST come from `gh api user --jq .login`. MUST NOT be guessed.
- `repo/.claude/settings.local.json` is a symlink to `settings.<login>.json` (relative target, same folder). The symlink differs per person, so `repo/.gitignore` MUST list `.claude/settings.local.json`.
- `settings.<login>.json` is committed, so it MUST NOT hold a secret (a token, an API key, a password, `apiKeyHelper`). Secrets go in `~/.claude/settings.json`, which is never committed.
- Its contents: [permissions.md](permissions.md).

## .simpleapps/

SimpleApps settings, in two scopes; the project wins for any field it sets:

```
~/.simpleapps/settings.json           # User: projectRoot, orgName
{project}/.simpleapps/settings.json   # Project: overrides the user file field by field
{project}/.simpleapps/site.json       # Project only: the site profile
```

Read `{project}/.simpleapps/settings.json` first, then `~/.simpleapps/settings.json`, then the defaults. Default `settings.json`:

```json
{
  "projectRoot": "~/projects"
}
```

`site.json` is the site profile of a client project: one per project, the same fields on every site, different values:

```json
{
  "auth": {},
  "defaults": {},
  "siteId": "<site-id>",
  "siteName": "<site name>"
}
```

A repo's own tooling MAY keep its local files here too (this marketplace's banned-strings check reads `.simpleapps/banned-strings.txt`).

- `.simpleapps/` MUST NOT be committed: `site.json` holds personal data and credentials.
- `.simpleapps/` lives on one machine. MUST NOT hold anything the team shares, anything that travels with the repo (it goes in the wiki), or anything a fresh clone needs.
- MUST NOT create a `<siteId>.json` file: the site profile is `site.json`. `/project init` reports an old `<siteId>.json` for the user to move into `site.json`; it MUST NOT move it.
- MUST NOT copy site data into the wiki, a repo or Claude's memory.
- `augur-api.json` and `basecamp.json` are leftovers from retired local servers: unused, holding stale tokens, and safe to delete. The Augur API and Basecamp connectors sign in through Claude and read no `.simpleapps/` file.

## Default branch

New code repos MUST use `main`; older ones are moving from `master`. When `git -C repo symbolic-ref --short refs/remotes/origin/HEAD` prints `origin/master`, tell the user once per session that the standard is `main` and that `/project init` shows the rename, then carry on with `master`. MUST NOT rename it. Wiki repos keep `master` (the team's practice).
