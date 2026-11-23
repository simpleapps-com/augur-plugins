# Status

## Does

Shows where the repo stands, so the user and the agent know what is safe to do next. It changes no branch, file or remote: its only write is `git fetch`, which updates what the clone knows about the remote.

## Reads

`repo-branch` on `Deployment.md`.

## Steps

1. `git -C <repo> fetch origin`
2. `git -C <repo> status --short --branch`: the branch, how far ahead or behind its remote, and the changes. Name any rebase or merge in progress, unmerged paths, or a detached HEAD.
3. `git -C <repo> log --oneline origin/<default>..HEAD`: commits not yet on `<default>`.
4. `git -C <repo> branch -vv`: local branches, and which have lost their remote (`gone`).
5. `git -C <repo> stash list` and `git -C <repo> worktree list`: leftovers.
6. `gh pr list --repo <R> --state open --author @me`, and for the current branch `gh pr view <branch> --repo <R> --json number,state,mergeable,statusCheckRollup` (no PR is not an error).
7. `gh run list --repo <R> --branch <default> --limit 3`: CI on `<default>`.

## Writing the wiki settings

None needed. `repo-branch` only when the branch work lands on is not the remote's default.

## Safeguards

Read-only apart from the fetch. Writes allowed: none.

## Report

```
Branch: feat/x (2 ahead, 0 behind origin/feat/x); 3 commits not on main
Changes: 2 modified, 1 untracked (notes.txt)
PR: #42 open, checks passing, mergeable
Main CI: passing
Leftovers: branch old-fix (gone), 1 stash
```
