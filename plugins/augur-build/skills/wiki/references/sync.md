# Sync

Commit the wiki's local edits, pull with rebase, then push. Apply this project's overrides first: the `## Sync` section of `Wiki-Maintenance.md`, and `wiki-branch` in `Home.md` (rules in `SKILL.md`).

**Approval.** `sync` writes only when the user approved it in the conversation: they typed `/wiki sync`, or asked in their own words to sync, commit or push the wiki. Then it is the approval for the commit, pull and push below, in `<wiki>` only, and MUST NOT ask to re-confirm. When the model picked this skill for another request ("save that to the wiki"), MUST NOT sync: edit, report, stop. MUST NOT stage, commit or push anything in the code repo or any other repo.

**Why pull before push:** a wiki can be edited in the browser, so the local copy drifts silently. Committing first means the rebase never touches uncommitted work; pulling before pushing avoids a rejected push and any temptation to force.

## Steps

These stops (steps 1 and 2) and pull-before-push hold even when a `## Sync` section replaces the steps (`SKILL.md` safeguards). The overrides were read once at the start of the run; a pull does not change them mid-run.

1. **State.** `git -C <wiki> status`. If it reports a rebase or merge in progress, or unmerged paths, STOP and report it: a previous conflict is unresolved.
2. **Branch.** The current branch is `git -C <wiki> branch --show-current`. If it is empty (a detached HEAD), STOP and report. If `wiki-branch` is set and differs from it, STOP and report both; MUST NOT check out another branch. Otherwise use it as `<branch>`. GitHub wikis default to `master`; MUST NOT assume `master` or `main`.
3. **Survey.** `git -C <wiki> status --porcelain`. Name every untracked file (`??`), page or not, and every modified file this session did not edit, then include them: the user asked to sync the wiki, not a subset. A file that is not a wiki page (a stray script, an archive, a secret) MUST be named on its own line, and the user asked before it is committed. If the tree is clean, skip to step 5.
4. **Commit.**
   1. Read the changes: `git -C <wiki> diff` for tracked files, and Read each untracked file (the diff omits them).
   2. Write a Conventional Commits message (type `docs`, scope `wiki`), summarised by page and by what changed, to `<scratch>/commit-msg.txt`.
   3. `git -C <wiki> add -A`, then `git -C <wiki> commit -F <absolute path to <scratch>/commit-msg.txt>`.
   4. Delete the message file.
5. **Pull.** `git -C <wiki> pull --rebase origin <branch>`. On a conflict: STOP, report the conflicted files and hand them to the user. MUST NOT resolve them, MUST NOT abort the rebase without saying so first, and MUST NOT push. If the pull changed `Wiki-Maintenance.md` or the `wiki-*` keys in `Home.md`, finish this run with the overrides read at its start, then show the user the change and wait for a yes before any run follows the new version.
6. **Push.** `git -C <wiki> push origin <branch>`.

| Push fails with | Do |
|-----------------|----|
| 401 or 403 | Fix the git credentials (for GitHub, `gh auth setup-git`), then retry once |
| non-fast-forward | The pull did not take: run step 5 again. MUST NOT force |

## Report

- The commit (SHA and subject), or "nothing to commit"
- The pages committed, flagging any that were untracked or edited outside this session
- What the pull brought in, or "already up to date"
- The push as `<old>..<new>` on `<branch>`

Then stop: MUST NOT offer to commit or push the code repo, and MUST NOT suggest the next command.
