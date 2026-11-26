# Issue

## Does

Files a GitHub issue the user asked for, on this repo or another one: something to track, or an upstream change the current work depends on. It runs only on the user's request: `/repo issue`, or their own words ("file an issue for that", "file it upstream on `<owner>/<repo>`"). No other subcommand creates an issue, and no issue is created just to link it to a PR.

## Reads

Nothing on `Deployment.md`.

## Steps

1. **Repo.** `<target>` is the one the user named (`<owner>/<repo>`, which MUST match `[A-Za-z0-9._-]+/[A-Za-z0-9._-]+`), else `<R>`. Another repo than `<R>` makes this a **cross-repo** issue.
   **Visibility, before anything is drafted:** `gh repo view <target> --json visibility` and `gh repo view <R> --json visibility`. A command that fails, or a visibility it cannot read, counts as public.
2. **This work's issue.** The issue the current work belongs to, if any, as `<R>#<L>`: the user named it, or the branch carries it (`git -C <repo> branch --show-current`, `fix/42-...` → 42), or a recent commit does (`git -C <repo> log --oneline -20`, `#42`, or `Closes #42` / `Refs #42`). Confirm it exists: `gh issue view <L> --repo <R> --json number,state,title`. None: carry on without one; not all work has an issue.
3. **Duplicates.** `gh issue list --repo <target> --search "<key words>" --state all --limit 10`. A likely duplicate: name it and ask whether to file anyway.
4. **Draft.** Title in Conventional Commits style (`fix: ...`, `feat: ...`), under 70 characters. Body:
   ```
   ## Problem
   What is wrong, missing or needed.
   ## Expected
   What should happen instead.
   ## Acceptance criteria
   - [ ] Concrete, checkable outcomes
   ## Context
   Related issues and PRs, files, reproduction steps, workarounds.
   ```
   A bug also gets steps to reproduce and the actual error text. Write only what the user said or the session showed; mark anything inferred. A cross-repo issue also says, under Context, what is blocked until it lands, and where it comes from: the originating repo `<R>` and the local issue `<R>#<L>`, only when the privacy rule below allows.

   **Privacy (no exception).** A public `<target>` MUST NOT get anything private: a private repo's name (`<R>` or any other, since a client repo's name is the client's name) or its issue numbers, client or person names, site ids, account ids, private hosts or URLs, file paths from a private repo, credentials, or text copied from a private issue, Basecamp or WIP. Where the origin is private, write "a private repo" and describe the need in general terms. Before filing on a public `<target>`, MUST show the user the exact title and body, and file only on their yes for that text.
5. **File.** Write the body to `<scratch>/issue-body.txt`, run `gh issue create --repo <target> --title '<title>' --body-file <absolute path>`, add `--label <label>` only for a label the user named that `gh label list --repo <target>` shows, then delete the file.
6. **Cross-link.**
   - **An upstream dependency** (a cross-repo issue the current work waits on, with a local issue `<R>#<L>`): write `Blocked by <target>#<N>`, with one line on what it waits for, to `<scratch>/blocked-comment.txt`; comment on the local issue (`gh issue comment <L> --repo <R> --body-file <absolute path>`); then delete the file. A comment on a public `<R>` follows the privacy rule too. If `gh label list --repo <R>` shows a `blocked` label, add it: `gh issue edit <L> --repo <R> --add-label blocked`. A cross-repo dependency with no local issue: ask whether to file one to track it.
   - **Any other cross-link**, only when the user asked for one: comment on the other issue with `<target>#<N>`, body in `<scratch>/link-comment.txt`, deleted after. A link from a public issue to a private one is not made: the privacy rule.
   - A closed issue is not reopened unless the user asks.

## Writing the wiki settings

None. Label and template conventions belong in the project's contributing docs; follow `.github/ISSUE_TEMPLATE/` when it exists.

## Safeguards

Writes allowed: `gh issue create` and `gh issue comment` with the flags above, and `gh issue edit <L> --repo <R> --add-label blocked` for an upstream dependency when the label exists. The approval covers one issue on the named repo; for an upstream dependency, the "Blocked by" comment and the `blocked` label on the local issue; otherwise a cross-link comment when the user asked for it. Not assignees the user did not name, no other label change, and not editing or closing other issues.

## Report

The issue URL and title; the local issue found (and how) or that there was none; any cross-link comment and label added.
