# Commit

## Does

Commits the work on a work branch, with a Conventional Commits message. It does not push. `submit` and `publish` use these steps for their commits.

## Reads

`repo-branch` and `repo-pr` on `Deployment.md`.

## Steps

1. **State.** `git -C <repo> status`. A rebase or merge in progress, unmerged paths, or a detached HEAD: stop and report.
   **Hooks.** When the repo configures git hooks (`lefthook.yml` or `.husky/` in `<repo>`), they MUST be installed before any commit: `git -C <repo> config --get core.hooksPath` names the folder (else `.git/hooks`), and `ls <repo>/<that folder>/pre-commit` MUST find the hook. Missing: stop, and tell the user to install them (for example `pnpm --dir <repo> install`). A commit without them skips the project's scans, such as a banned-strings check.
2. **Branch.** `git -C <repo> branch --show-current`. On `<default>`, create a work branch first: `git -C <repo> switch -c <type>/<slug>`, or `<type>/<N>-<slug>` when the work has an issue (types as in [conventional-commits.md](conventional-commits.md); slug lower case, hyphenated, under 40 characters). Two exceptions commit on `<default>`: `repo-pr: none`, and a first commit (`git -C <repo> ls-remote --heads origin` prints nothing).
3. **What to commit.**
   - **The user staged some files** (`git -C <repo> diff --cached --name-only` lists files): commit exactly those. Name the unstaged changes and untracked files left out.
   - **Nothing staged:** survey `git -C <repo> status --porcelain`. Name every untracked file (`??`) and every change this session did not make, and include them: the user asked to commit the work, not a subset. A file that is not source, docs or config (an archive, a key, an `.env`, a build output, a stray script) is named on its own line and asked about; on a "no", it is left out.
   - Nothing to commit: say so and stop.
4. **Message.** Read the changes (`git -C <repo> diff --cached` for the staged case, `git -C <repo> diff` and a Read of each untracked file otherwise). Write the message per [conventional-commits.md](conventional-commits.md) to `<scratch>/commit-msg.txt`.
5. **Commit.** Nothing staged: `git -C <repo> add -A`, or `git -C <repo> add -- <path>...` for the files to include when one was left out. Then `git -C <repo> commit -F <absolute path to commit-msg.txt>`, and delete the message file.
6. **Hooks.** If a hook fails, the commit did not happen: report its output and stop. If a hook changed files (a formatter), name them; they are not in the commit.

## Writing the wiki settings

Most repos need none. A repo that commits straight to `<default>` without review sets `<!-- repo-pr: none -->`. Detect from the history (`git -C <repo> log --oneline -30`: are commits on `<default>` merges of PRs?) and branch protection; ask when it does not show.

## Safeguards

Writes allowed: `git -C <repo> switch -c <type>/<slug>`, `git -C <repo> add -A`, `git -C <repo> add -- <path>...`, `git -C <repo> commit -F <file>`. The approval covers the work branch and one commit, in `<repo>` only.

## Report

The commit (short SHA and subject), the branch (and whether it was created), the files committed, flagging any untracked or not edited this session, and anything left out.
