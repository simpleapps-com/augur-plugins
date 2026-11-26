---
name: project
description: Explains and sets up a SimpleApps project folder, the one that holds `repo/` (the code repo), `wiki/`, `wip/`, `tmp/`, `clones/` and `.simpleapps/`, with the symlinks that let Claude Code run from it, and the per-user settings file and its permission defaults. A bare `/project` explains the layout and changes nothing; `/project init` checks the folder, fixes what is missing, and hands the rules and `CLAUDE.md` to `/rules write`. Use when setting up or checking a project folder, when asked where something belongs (scratch files, other repos, site settings), about `.simpleapps/`, `site.json`, `settings.local.json` or the permission defaults, or before asking the user for a site id or other site setting.
license: MIT
---

# Project

How a SimpleApps project folder is laid out, the settings it carries, and `/project init` to set one up or repair it.

Key words MUST, SHOULD, MAY per RFC 2119.

**Before anything else:**

- `project` writes only on `/project init`, or when the user asks in their own words for that change. A bare `/project`, `help`, or a question about the layout changes nothing.
- Every write outside the project folder (`~/.claude/settings.json`, `~/.simpleapps/settings.json`, a shell profile such as `~/.zshrc`) MUST be shown as the exact change, and made only after the user's yes for that change, even during `/project init`.
- `project` MUST NOT run a git write (an untrack, a branch rename, a `git remote` change): it shows the command, and the user runs it or asks for it. The one GitHub change it makes is creating the standard labels, each only after the user's yes.
- `project` MUST NOT add a hard-deny or other `autoMode` rule anywhere.

## Where it runs

| Surface | What happens |
|---------|--------------|
| Claude Code | Explains the layout; `/project init` checks and fixes the folder |
| Cowork | As Claude Code where the project's files and a shell are available (unverified); otherwise as chat |
| Chat | Explains the layout and settings, and drafts the settings files and the steps for the user to run. Writes nothing, and says so |

## Where things are

`{project}` is the folder that holds `repo/` beside `wiki/`. It is not a git repo; git runs as `git -C repo`.

| Path | Holds |
|------|-------|
| `.claude`, `CLAUDE.md`, `.mcp.json` | Symlinks into `repo/`, so Claude Code loads the repo's settings and rules from `{project}/` |
| `.simpleapps/` | `settings.json` and the site profile `site.json`. Never committed |
| `clones/` | Read-only clones of other repos and wikis: the project boundary |
| `goals/` | The goals being worked now. Never committed |
| `repo/` | The code repo. `repo/.claude/` holds `CLAUDE.md`, `rules/`, `settings.json` and `settings.<login>.json` |
| `tmp/` | Scratch files: commit messages, PR bodies. Never inside `repo/` or `wiki/` |
| `wiki/` | The wiki, its own git repo |
| `wip/` | One file per piece of work (the `wip` skill). Never committed |
| `worktrees/` | Git worktrees of `repo/`, placed there by the `simpleapps-worktrees` plugin (Claude Code only) |

The full layout, each folder's rules, the symlinks, `.simpleapps/` and the default branch: [references/layout.md](references/layout.md). The permission defaults and the user settings: [references/permissions.md](references/permissions.md).

## Subcommands

| Call | Does | Steps |
|------|------|-------|
| `/project` | Explains the layout from this file and [references/layout.md](references/layout.md), and checks nothing. With a question ("where do PR bodies go?"), answers it | |
| `/project init` | Checks the folder against the layout and fixes what is missing: folders, symlinks, the per-user settings, `.simpleapps/`; reports the rest | [references/init.md](references/init.md) |

`/project init` writes no rule and no `CLAUDE.md`: it hands over to `/rules write` (augur-build's `rules` skill). Repo-specific setup lives in the repo's own `repo/procedures/onboarding.md`, which `/project init` points to when it exists.

## Check site.json first

Before asking the user for a credential, a token, a site id, a domain or any other site setting, read `.simpleapps/site.json`: it is the one source for site-level data (identifiers, defaults, auth). What is not there: ask the user to add it to `site.json`, not to paste it in chat; chat is gone next session, and `site.json` stays. Site data MUST NOT be copied into the wiki, a repo or Claude's memory.

## Commands

`/project init` runs only the commands in [references/init.md](references/init.md), one plain command per call, from `{project}/`, with the Read, Write and Edit tools for files. In short: `ls`, `readlink`, `mkdir -p` for the layout's folders, `ln -s` and `ln -sf` for the symlinks, `unlink`, `rmdir .claude`, `find tmp -mindepth 1 -mtime +0 -delete`, `grep -n`, `gh api user --jq .login`, `gh label list`, `gh repo clone` once the user names the repo, `claude plugin list`, `pnpm --dir repo install`, and the read-only `git -C repo` commands `ls-files`, `remote get-url origin`, `symbolic-ref`, `worktree list`, with `status --short` and `log` in a worktree. `gh label create` runs only after the user's yes.

## Safeguards

- **Deletes.** Only what [references/init.md](references/init.md) names: old symlinks it replaces, the empty old `.claude/` folder, `tmp/` files older than a day, and leftovers the user says yes to. Anything unrecognised: stop and ask.
- **Guessing.** MUST NOT guess the repo name, the GitHub login or the site's data: ask, or read it from `gh` or `site.json`.
- **Secrets.** MUST NOT copy a secret into a committed file: `settings.<login>.json` is committed; secrets go in `~/.claude/settings.json`.
- **The boundary.** MUST stay inside `{project}/`; another repo is read through `clones/`. The only exceptions are `/project init`'s reads of `~/.claude/settings.json`, `~/.simpleapps/settings.json` and `~/.zshrc`, and its writes there after a yes. MUST NOT suggest `permissions.additionalDirectories` for other project folders.

## After a subcommand

`/project init` reports a checklist ([references/init.md](references/init.md), Report): what was checked, created, already right, and what waits on the user (a yes, a git command, `/rules write`, the onboarding). Then stop.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", explains how the skill is used and changes nothing. The answer comes from this file: what the skill does; each subcommand with one line and an example call, and what a bare call does (a skill with no subcommands gives three example requests instead); the settings and their defaults; and what works on each surface. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read this skill's own files, or write anything.
<!-- /shared:help -->
