# Sync

## Does

Brings the current branch up to date with its upstream on `origin`, keeping every local change. It fetches, shows what is incoming, and fast-forwards. It never commits, pushes, switches branches, merges a diverged branch or resolves a conflict: those stop the sync and go to the user.

## Reads

Nothing on `Deployment.md`: it syncs the branch checked out, whatever `repo-branch` says.

## Steps

1. **State.** `git -C <repo> status --porcelain` and `git -C <repo> branch --show-current`. A rebase or merge in progress, unmerged paths (`UU`, `AA`, `DU` and the like), or an empty branch name (a detached HEAD): stop and report.
2. **Upstream.** `git -C <repo> rev-parse --abbrev-ref <branch>@{upstream}` gives `<upstream>`, such as `origin/main`. No upstream, or one that does not start with `origin/`: stop and report; MUST NOT set one.
3. **Fetch and survey.** `git -C <repo> fetch origin`, then:
   - `git -C <repo> log --oneline HEAD..<upstream>`: the incoming commits;
   - `git -C <repo> log --oneline <upstream>..HEAD`: local commits not on the remote;
   - `git -C <repo> diff --name-only HEAD..<upstream>`: the incoming files;
   - `git -C <repo> diff --name-only HEAD`: the local changes, staged and unstaged;
   - `git -C <repo> diff --cached --name-only`: the staged ones.

   Show the incoming commits (`<old>..<upstream>`, with subjects) before changing anything. The **overlap** is the local changes that are also incoming files.
4. **Decide.**
   - Nothing incoming: report "up to date", with any local commits as "ahead by N", and stop.
   - Incoming commits and local commits too: the branch has diverged. Report both lists and stop: rebasing or merging is the user's call, made in their own words. MUST NOT rebase, merge or force.
   - Otherwise go on.
5. **Bring in.**
   - **No overlap** (a clean tree included): `git -C <repo> merge --ff-only <upstream>`. Local changes, staging included, stay as they were.
   - **Overlap:** `git -C <repo> merge --ff-only --autostash <upstream>`. Git stashes the local changes, fast-forwards, and re-applies them. When they apply cleanly the stash is cleared by git; staged files come back unstaged, so name them in the report.
   - **Conflict** ("Applying autostash resulted in conflicts"): stop. Run `git -C <repo> status --porcelain` and `git -C <repo> stash list`, and report each conflicted file and the `autostash` entry, which still holds the local changes. MUST NOT resolve, restore or drop anything: the user resolves the files and drops the stash.
   - **Git refuses** (an untracked file the incoming commits would overwrite, or a git older than 2.27, which lacks `--autostash`): stop and report git's message. Nothing was changed.

## Writing the wiki settings

None.

## Safeguards

Writes allowed: `git -C <repo> fetch origin`, `git -C <repo> merge --ff-only <upstream>`, and `git -C <repo> merge --ff-only --autostash <upstream>`, with `<upstream>` from step 2 only. `--ff-only` refuses whenever the branch has diverged ([git-merge](https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---ff-only)), so no local commit is rewritten. `--autostash` keeps the local changes in a stash when re-applying them conflicts ([git-merge](https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---autostash); merge has it from [git 2.27](https://github.com/git/git/blob/master/Documentation/RelNotes/2.27.0.adoc)). No commit, push, branch switch, rebase, `restore`, `reset`, `stash pop` or `stash drop`.

## Report

```
Branch: main, origin/main
Incoming: 3 commits (a1b2c3d..e4f5a6b): <subjects>
Files brought in: 5 (<paths>)
Local changes: 2 kept; re-applied over incoming: notes.md (was staged, now unstaged)
Result: fast-forwarded a1b2c3d..e4f5a6b
```

On a stop, the reason in one line, with the facts behind it (the diverged commits, the conflicted files and the stash, or git's message).
