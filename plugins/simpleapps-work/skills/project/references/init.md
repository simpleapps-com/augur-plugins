# /project init

Check `{project}/` against the layout ([layout.md](layout.md)) and fix what is missing. Run from `{project}/`, one plain command per call.

**Before any step:**

- Outside `{project}/` it reads only `~/.claude/settings.json`, `~/.simpleapps/settings.json` and `~/.zshrc`. A write to any of them MUST be shown, as the exact change, and made only after the user's yes for that change.
- MUST NOT run a git write: an untrack, a branch rename, a `git remote` change. Show it; the user runs it or asks for it. The one GitHub change it makes is creating the standard labels, each only after the user's yes (step 8).
- MUST NOT delete a file the steps do not name. Anything unrecognised: stop and ask.
- `repo/` or `wiki/` missing: ask the user for the repo name; MUST NOT guess it from the folder or the plugin. Once confirmed: `gh repo clone simpleapps-com/<name> repo`, and `gh repo clone simpleapps-com/<name>.wiki wiki`.

## Contents

1. Folders
2. Symlinks
3. Rules and CLAUDE.md
4. .simpleapps/
5. Per-user settings
6. User settings
7. Launcher and status line
8. GitHub labels
9. Dependencies
10. Worktrees
11. Default branch
12. Final check and onboarding

## 1. Folders

1. `ls -la`.
2. Each missing folder: `mkdir -p clones`, `mkdir -p goals`, `mkdir -p tmp`, `mkdir -p wip`, `mkdir -p worktrees`, `mkdir -p .simpleapps`.
3. `tmp/` already there: `find tmp -mindepth 1 -mtime +0 -delete`, and report how much went.
4. `ls repo/tmp` and `ls wiki/tmp`: one that exists is reported, since a repo MUST NOT have one; ask before deleting it, as it may hold files the user has not moved.

MUST NOT create `.claude` with `mkdir` (it is a symlink, step 2) or a repo-specific folder such as `work/` (step 12).

## 2. Symlinks

1. `readlink .claude`, `readlink CLAUDE.md`, `readlink .mcp.json`.
2. `repo/` exists: `mkdir -p repo/.claude/rules`. `ls repo/.claude/settings.json`; missing: Write `{}` and report it as a stub.
3. **An old `.claude/` folder.** `.claude` is a real folder (the old per-item layout): `ls -la .claude`, then for each entry:
   - A symlink into `repo/.claude/`: `unlink .claude/<name>`.
   - A real `settings.local.json`: `ls repo/.claude/settings.local.json`. That exists too: stop and ask which to keep. Otherwise Read it, Write it unchanged to `repo/.claude/settings.local.json`, then `unlink .claude/settings.local.json`. Step 5 screens it for secrets; MUST NOT merge it here.
   - Anything else: stop and ask.

   Then `rmdir .claude`.
4. `.claude`: `readlink .claude` prints `repo/.claude`: skip. A symlink to anything else: `unlink .claude` first. Then `ln -s repo/.claude .claude`. MUST NOT use `ln -sf` here: on a symlink to a folder it makes the new link inside the target (seen in use).
5. `ln -sf repo/.claude/CLAUDE.md CLAUDE.md`.
6. `.mcp.json`: `ls repo/.mcp.json`; it exists: `ln -sf repo/.mcp.json .mcp.json`; it does not: skip. `{project}/.mcp.json` is a real file: MUST NOT overwrite it; report it and ask whether to move it into the repo.

## 3. Rules and CLAUDE.md

`/project init` writes no rule and no `CLAUDE.md`. `ls repo/.claude/CLAUDE.md` and `ls repo/.claude/rules`: report what is there, and end the report (step 12) by handing over to `/rules write` (augur-build's `rules` skill), which composes `repo/.claude/rules/` and `repo/.claude/CLAUDE.md` from the project's wiki, layout and tools. `/rules audit` reports drift after a plugin update.

## 4. .simpleapps/

1. Read `~/.simpleapps/settings.json`. Missing: show `{"projectRoot": "~/projects"}`, ask the user to confirm `projectRoot`, and Write it after the yes. Compare the project's path with `projectRoot` ignoring case; flag only a path that does not resolve.
2. `ls .simpleapps`. A `.json` file other than `settings.json` and `site.json`:
   - `augur-api.json`, `basecamp.json`: report as unused leftovers of retired local servers, safe to delete; delete only after a yes.
   - Anything else: likely an old `<siteId>.json`. Report it and suggest moving its content into `site.json`. MUST NOT move it: it holds personal data, and the user reviews it.
3. A client project with no `site.json`: suggest creating it. MUST NOT create it: the user supplies the site's data.

## 5. Per-user settings

1. `gh api user --jq .login`. Not signed in: ask the user to run `gh auth login`. MUST NOT guess the login.
2. Read `repo/.claude/settings.<login>.json`. Missing: Write it from [permissions.md](permissions.md), Permission defaults. Present: add what is missing and migrate the older defaults ([permissions.md](permissions.md), Migrating older settings), reporting each change.
3. `git -C repo ls-files .claude/settings.local.json`. It prints the path: the file is tracked, and `.gitignore` alone will not untrack it. Report that it MUST be untracked with `git -C repo rm --cached .claude/settings.local.json`, a git write the user runs or asks for. Continue.
4. `readlink repo/.claude/settings.local.json` prints `settings.<login>.json`: skip to 6.
5. `repo/.claude/settings.local.json` is a real file (including one moved there in step 2): Read it and check for secrets before merging, since `settings.<login>.json` is committed: `env` values that look like tokens, keys or passwords; names holding `KEY`, `PASSWORD`, `SECRET` or `TOKEN`; `apiKeyHelper`; `Authorization` headers. MUST NOT copy a secret: list each for the user and suggest `~/.claude/settings.json`. Merge the rest into `settings.<login>.json`, then `unlink repo/.claude/settings.local.json`.
6. `ln -sf settings.<login>.json repo/.claude/settings.local.json` (relative target: the link sits in the same folder).
7. `grep -n "settings.local.json" repo/.gitignore`. No match: add `.claude/settings.local.json` with Edit (Write when there is no `.gitignore`).

## 6. User settings

Read `~/.claude/settings.json` once for these checks. Each change is shown, and written only after its yes:

- MUST NOT add an `autoMode` rule ([permissions.md](permissions.md), Auto mode: no hard deny).
- The older push guardrail (`autoMode.hard_deny` holding `Bash(git push:*)`): report it and offer to remove it, since it replaced Claude Code's built-in hard-deny rules.
- An `autoMode` block found in a project settings file (step 5): report that it has no effect there, and offer to remove it.
- `permissions.additionalDirectories` or a top-level `additionalDirectories`: [permissions.md](permissions.md), Project boundary.

## 7. Launcher and status line

- **Launcher.** `cld` (update Claude Code, then start it) is augur-build's `launcher` skill: point the user to `/launcher audit`, and `/launcher write` to install. `grep -n "augur-skills/plugins/simpleapps/bin" ~/.zshrc`: a match is a PATH line for the retired scripts; show the line and remove it only after a yes.
- **Status line.** `claude plugin list`. No `simpleapps-statusline`: suggest `/plugin install simpleapps-statusline@augur`, then `/reload-plugins`. `~/.claude/settings.json` has a `statusLine` running `statusline-full` or `statusline-basic` (the retired scripts): show removing it, so a second status line is not drawn, and remove it only after a yes.

## 8. GitHub labels

`git -C repo remote get-url origin` gives `<owner>/<repo>`; `gh label list --repo <owner>/<repo>`. Compare with the standard set (the team's practice):

| Label | Color | Purpose |
|-------|-------|---------|
| `a11y` | `7c3aed` | Accessibility |
| `blocked` | `fbbf24` | Waiting on an outside dependency |
| `bug` | `d73a4a` | Broken behaviour users can see |
| `enhancement` | `0075ca` | New feature |
| `perf` | `7dd3fc` | Performance, Core Web Vitals |
| `production-blocker` | `7f1d1d` | Must be resolved to reach, or stay in, production |
| `refactor` | `a855f7` | Code quality, no user impact |
| `security` | `e11d48` | Exploitable vulnerability |
| `SEO` | `14b8a6` | Search engine optimisation |

Report the missing labels. Labels change the repo for everyone: on the user's yes, create each with `gh label create "<name>" --color "<color>" --description "<purpose>" --repo <owner>/<repo>`.

## 9. Dependencies

`ls repo/package.json`; it exists: `pnpm --dir repo install`, which also runs the repo's `prepare` script (git hooks, for one). No `package.json`: skip.

## 10. Worktrees

`claude plugin list` (from step 7): no `simpleapps-worktrees`: suggest `/plugin install simpleapps-worktrees@augur` (Claude Code only), which puts worktrees in `worktrees/` ([layout.md](layout.md), worktrees/).

`git -C repo worktree list`. For each worktree other than `repo/`, under `worktrees/` or a stray outside it (in `tmp/`, for one): `git -C <path> status --short` and `git -C <path> log --oneline HEAD --not --remotes`, then report what it holds. Suggest `git -C repo worktree remove <path>` (never `--force`) only when both print nothing. MUST NOT move or remove one here.

## 11. Default branch

`git -C repo symbolic-ref --short refs/remotes/origin/HEAD`:

- `origin/main`: report it as on the standard.
- `origin/master`: tell the user the standard is `main`, and show the rename for them to run or ask for. It changes the repo for everyone. On GitHub (renames the branch, retargets open PRs, redirects old links): `gh api -X POST repos/<owner>/<repo>/branches/master/rename -f new_name=main`, or Settings, Branches. Then locally: `git -C repo branch -m master main`, `git -C repo fetch origin`, `git -C repo branch -u origin/main main`, `git -C repo remote set-head origin -a`. Other clones need the same four local commands; CI workflows and branch protection naming `master` need updating.
- It fails (no `origin/HEAD`): show `git -C repo remote set-head origin -a` for the user to run, then check again.

`wiki/` stays on `master`: do not check it.

## 12. Final check and onboarding

`ls -la` (the `.claude`, `CLAUDE.md` and `.mcp.json` symlinks) and `ls -la repo/.claude/` (the `settings.local.json` symlink). Then `ls repo/procedures/onboarding.md`: it exists: end the report by telling the user to ask Claude to follow it. Repo-specific setup (connector sign-ins, per-person data, folders such as `work/`) lives there, not here.

## Report

A checklist of what was checked, created, already right, and waiting on the user:

- [x] `repo/` and `wiki/` exist
- [ ] `clones/` created
- [ ] `goals/` created
- [x] `wip/` exists
- [ ] `worktrees/` created
- [x] `.claude` → `repo/.claude`
- [x] `CLAUDE.md` → `repo/.claude/CLAUDE.md`
- [x] `.mcp.json` → `repo/.mcp.json` (or: skipped, no `repo/.mcp.json`)
- [x] `repo/.claude/settings.local.json` → `settings.<login>.json`, gitignored
- [x] No `autoMode` rule added (or: the old push guardrail found, removal offered)
- [x] Standard GitHub labels present (or: the missing ones, created after a yes)
- [x] Dependencies installed (or: skipped, no `repo/package.json`)
- [x] No worktrees besides `repo/` (or: each, with what it holds)
- [x] Default branch is `main` (or: still `master`, rename shown)
- Next: `/rules write` for the rules and `CLAUDE.md`; `repo/procedures/onboarding.md` when it exists
