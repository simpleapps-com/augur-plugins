# Issue

## Does

Files a GitHub issue the user asked for. It runs only on the user's request: `/repo issue`, or their own words ("file an issue for that"). No other subcommand creates an issue, and no issue is created just to link it to a PR.

## Reads

Nothing on `Deployment.md`.

## Steps

1. **Repo.** The one the user named (`<owner>/<repo>`, which MUST match `[A-Za-z0-9._-]+/[A-Za-z0-9._-]+`), else `<R>`.
2. **Duplicates.** `gh issue list --repo <target> --search "<key words>" --state all --limit 10`. A likely duplicate: name it and ask whether to file anyway.
3. **Draft.** Title in Conventional Commits style (`fix: ...`, `feat: ...`), under 70 characters. Body:
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
   A bug also gets steps to reproduce and the actual error text. Write only what the user said or the session showed; mark anything inferred.
4. **File.** Write the body to `<scratch>/issue-body.txt`, run `gh issue create --repo <target> --title '<title>' --body-file <absolute path>`, add `--label <label>` only for a label the user named that `gh label list --repo <target>` shows, then delete the file.
5. **Cross-link**, only when the user asked for one: comment on the other issue with `<target>#<N>` (`gh issue comment <N> --repo <other> --body-file <absolute path>`). A closed issue is not reopened unless the user asks.

## Writing the wiki settings

None. Label and template conventions belong in the project's contributing docs; follow `.github/ISSUE_TEMPLATE/` when it exists.

## Safeguards

Writes allowed: `gh issue create` and `gh issue comment` with the flags above. The approval covers one issue on the named repo, and a cross-link comment when the user asked for it. Not assignees the user did not name, and not editing or closing other issues.

## Report

The issue URL and title, and any cross-link.
