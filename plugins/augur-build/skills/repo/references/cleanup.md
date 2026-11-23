# Cleanup

## Does

Leaves the clone tidy once work has merged: on `<default>`, up to date, with no merged branches or this run's files left behind. `submit` and `publish` run it at the end; `/repo cleanup` runs it alone and also clears older merged leftovers.

## Reads

`repo-branch` on `Deployment.md`.

## Steps

1. **State.** `git -C <repo> status --porcelain`. Uncommitted changes: switch nothing, delete no branch; do step 5 only, and report the changes.
2. **Current branch.** If it is not `<default>`, check its PR: `gh pr list --repo <R> --head <branch> --state open --json number`. An open PR: stay on the branch (review fixes land on it). Run only `git -C <repo> fetch --prune origin`, then steps 4 and 5; skip step 3.
3. **Default branch.** `git -C <repo> switch <default>`, `git -C <repo> fetch --prune origin`, then `git -C <repo> merge --ff-only origin/<default>`. A fast-forward that fails (local commits on `<default>`): stop and report.
4. **Branches.** For each local branch except `<default>` and the current branch (`git -C <repo> branch --format="%(refname:short)"`, quoted):
   - `gh pr list --repo <R> --head <branch> --state merged --json number,headRefOid`. If `git -C <repo> rev-parse <branch>` equals a merged PR's `headRefOid`, delete it: `git -C <repo> branch -D <branch>` (a squash merge leaves git calling it unmerged).
   - Else, if `git -C <repo> branch --merged <default>` lists it, `git -C <repo> branch -d <branch>`.
   - Else keep it: it holds work that is not merged. Report it.
5. **Leftovers.** Delete the files this run wrote in `<scratch>`, by path, and nothing else there. Report any stash (`git -C <repo> stash list`) or worktree (`git -C <repo> worktree list`); MUST NOT drop or remove them.

## Writing the wiki settings

None. Build folders and dev servers are the project's own business; cleanup touches only git state and its own files.

## Safeguards

Writes allowed: `git -C <repo> switch <default>`, `git -C <repo> fetch --prune origin`, `git -C <repo> merge --ff-only origin/<default>`, `git -C <repo> branch -d <branch>`, `git -C <repo> branch -D <branch>` under the guard in step 4, and deleting this run's files. A branch whose tip differs from its merged PR holds unpushed work: keep it.

## Report

The branch now checked out and whether it moved; each branch deleted and why; each branch kept and why; any stash or worktree; the files removed.
