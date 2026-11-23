# Submit

## Does

Gets the work in front of reviewers: checks it, commits it, pushes the branch, opens or updates the pull request, waits for CI, merges it when `repo-merge` says to, and cleans up. With `repo-pr: none` it pushes straight to `<default>` instead of opening a PR. Invoking it is the approval for all of that.

## Reads

`repo-branch`, `repo-pr`, `repo-merge`, `repo-ci`, `repo-ci-workflow` on `Deployment.md`; `code-checks` on `Development.md` (through `code quality`).

## Steps

1. **Check.** Run `code quality` in check mode (the `code` skill's `references/quality.md`): it fixes nothing. Any failure, or any file a check changed: stop and report. The user fixes it (`/code quality`) and submits again.
2. **Commit.** If the tree has changes, run [commit.md](commit.md). Then `git -C <repo> branch --show-current`:
   - On `<default>` with `repo-pr: pr` and not a first commit: stop. Work on `<default>` is never pushed by `submit`; say so, so the user can move it to a branch.
   - Nothing to commit and nothing ahead of the remote: nothing to submit; stop.
3. **Push.**
   - `repo-pr: pr`: `git -C <repo> push -u origin <branch>`.
   - `repo-pr: none`: `git -C <repo> push origin <default>`.
   - First commit: `git -C <repo> push -u origin <default>`.

   A rejected push (the remote moved): stop and report; never force.
4. **Pull request** (`repo-pr: pr`). `gh pr view <branch> --repo <R> --json number,url,state`. With no open PR: write the body to `<scratch>/pr-body.txt` (what changed and why, how it was checked, and `Closes #N` when an issue is linked), run `gh pr create --repo <R> --base <default> --head <branch> --title '<subject>' --body-file <absolute path>`, and delete the file. An open PR is updated by the push.
5. **CI** (`repo-ci: wait`).
   - With a PR: `gh pr checks <N> --repo <R> --watch --fail-fast`. With `repo-ci-workflow`, then `gh pr checks <N> --repo <R> --json name,workflow,bucket`: that workflow's checks MUST be present and all `pass`.
   - Without one: the runs for the pushed commit, `gh run list --repo <R> --commit <sha> --json databaseId,workflowName,status,conclusion` (only `repo-ci-workflow`'s when set, and it MUST exist), each watched with `gh run watch <id> --repo <R> --exit-status`.
   - No checks or runs registered: look again about every 30 seconds for up to two minutes. Still none: stop, because unchecked work is never merged.
   - A failure: stop, leave the PR open, and report the failing check.
6. **Merge** (`repo-merge` `squash`, `merge` or `rebase`): `gh pr merge <N> --repo <R> --<method> --delete-branch --match-head-commit <sha>`, where `<sha>` is the full SHA this run pushed (`git -C <repo> rev-parse HEAD`). GitHub refusing (review required, branch protection): stop and report. With `none`: leave the PR open for review.
7. **Linked issue.** If the user named an issue or the branch carries one (`fix/42-...`) and the PR does not close it: `gh issue view <N> --repo <R> --json state`. Open: comment once with the PR link (body to `<scratch>/issue-comment.txt`, `gh issue comment <N> --repo <R> --body-file <absolute path>`, delete the file). Closed: say so in the report; do not reopen it unless the user asks.
8. **Clean up.**
   - Merged: run [cleanup.md](cleanup.md).
   - PR still open: stay on the branch, so review fixes land on it, and only delete this run's files.

## Writing the wiki settings

Detect, then ask about what the repo cannot show:

- **Merge:** `gh repo view <R> --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed` and whether `<default>` requires reviews. Set `repo-merge` to the method used when a PR may merge as soon as CI passes; leave it `none` when a person reviews.
- **CI:** `.github/workflows/` files run on `pull_request`. One that gates merging: `repo-ci-workflow`. No workflows: `repo-ci: skip`.
- **No PRs:** a solo repo pushing to `<default>`: `repo-pr: none`.
- **Checks:** the scripts `submit` runs come from `code-checks` on `Development.md` (the `code` skill). A gate that is not yet a script (a validator CLI, proofs) gets one in the manifest first, so it is reviewed like code.
- **Ask:** "Does a PR merge as soon as CI passes, or wait for a reviewer?"

Example, a repo that squash-merges once its Validate workflow passes:

```
<!-- repo-merge: squash -->
<!-- repo-ci-workflow: validate.yml -->
```

## Safeguards

Writes allowed: commit.md's writes; `git -C <repo> push -u origin <branch>` (`<branch>` not `<default>`); `git -C <repo> push origin <default>` (only with `repo-pr: none`, or `-u` for a first commit); `gh pr create`, `gh pr checks --watch --fail-fast`, `gh pr merge` with the flags above on the PR of the branch this run pushed; `gh run watch <id> --exit-status`; `gh issue comment` on a linked, open issue; cleanup.md's writes. The approval covers those, once. Not a release, a deploy, or a new issue.

## Report

The resolved settings, the PR URL and its checks, the commit, whether it merged (and the merge commit), any linked issue, and what cleanup did.
