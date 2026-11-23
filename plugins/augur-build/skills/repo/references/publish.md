# Publish

## Contents

- [Does](#does)
- [Reads](#reads)
- [Steps](#steps): settings, pre-flight, bump, release, verify, clean up
- [Writing the wiki settings](#writing-the-wiki-settings)
- [Safeguards](#safeguards)
- [Report](#report)

## Does

Releases the project: pre-flight checks, a version bump, the release `repo-release` names, a check that it landed, and cleanup. Invoking it is the approval to release: MUST NOT ask to confirm the version or the release. It stops only when a check fails.

## Reads

On `Deployment.md`: `repo-release` (required), `repo-versioning`, `repo-version-file`, `repo-release-scope`, `repo-branch`, `repo-merge`, `repo-ci`, `repo-ci-workflow`. On `Development.md`: `code-checks` (through `code quality`).

## Steps

### 1. Settings

- `repo-release` unset: say so, and offer to draft the settings (below). Show the draft; on the user's approval write it to `Deployment.md`, uncommitted; then stop. MUST NOT release in this run.
- `repo-release` `pr`, `push` or `tag` needs `repo-versioning` (not `none`) and `repo-version-file`; missing: stop and say which.

### 2. Pre-flight

Each failure stops the run before any write.

1. **Tree.** `git -C <repo> fetch origin`; `git -C <repo> status --porcelain` is empty; the branch is `<default>`; `git -C <repo> rev-parse HEAD` equals `git -C <repo> rev-parse origin/<default>`.
2. **Checks.** `code quality` in check mode passes.
3. **CI.** For `<sha>` = `rev-parse origin/<default>`: `gh run list --repo <R> --commit <sha> --json databaseId,workflowName,status,conclusion` (only `repo-ci-workflow`'s run when set). A run in progress: `gh run watch <id> --repo <R> --exit-status`. None, or any failure: stop. Skipped with `repo-ci: skip`.
4. **What to release.** The units are each folder matching `repo-release-scope` (list them with `ls <repo>/<dir>`), or the whole repo. For each unit:
   - last release: `git -C <repo> log -1 --format=%H --grep="^chore(release)" -- <unit>` (quote the pattern); with `repo-release: tag`, the newest tag (`git -C <repo> tag -l --sort=-creatordate`) instead;
   - changes: `git -C <repo> log --oneline <last release>..origin/<default> -- <unit>`. With no earlier release (a new unit), every commit touching it: `git -C <repo> log --oneline origin/<default> -- <unit>`. None: skip the unit. Every unit skipped: nothing to release; stop.
5. **Version** (not for `script:<name>`). Read the current version from the unit's `repo-version-file` and compute the next. MUST NOT ask the user.
   - `calver`: year, month and `seq` for today; `seq` is 1 for the first release this month, else one more than the current. Pad a one-digit month only if the repo already does: look for a release version with a one-digit month in the earlier `chore(release)` subjects and tags (`git -C <repo> log --oneline --grep="^chore(release)"`, `git -C <repo> tag -l`). `2026.03.2` means pad, `2026.3.2` means not; months 10 to 12 say nothing. No evidence: do not pad.
   - `semver`: from the commit types since the last release: a breaking change bumps major, any `feat` minor, else patch.
6. **Summary.** Show it, then carry on without waiting:
   ```
   Release: pr, scope plugins/*
   augur-build:  2026.11.4 -> 2026.11.5 (6 commits)
   augur-api:    skipped, no changes
   CI: Validate passing on 1a2b3c4
   ```

### 3. Bump and release

`script:<name>`: run `pnpm --dir <repo> run <name>` (or the manifest's equivalent). The script does the bump and the release.

Otherwise, set the new version in each unit's version file, editing only the version, and run `code quality` in check mode again: the bump is checked before it is committed. A failure: stop, report it, and leave the edit for the user.

The release message (the subject is also the PR title):
- whole repo: `chore(release): <version>`;
- one unit: `chore(release): <unit> <version>`, `<unit>` being the folder name;
- several units: `chore(release): <unit> <version>, <unit> <version>` while the subject stays under 72 characters, else `chore(release): <n> units`; the body lists one `<unit> <version>` per line either way.

Then:

- **`pr`:** `git -C <repo> switch -c chore/release-<version>` (`chore/release-<YYYY-MM-DD>` when several units ship), then commit, push, PR, CI and merge as [submit.md](submit.md) steps 2 to 6. With `repo-merge: none`, the release happens when a reviewer merges the PR.
- **`push`:** commit on `<default>` (as [commit.md](commit.md) steps 4 and 5), then `git -C <repo> push origin <default>`.
- **`tag`:** as `push`, then write the release notes (the commits since the last release) to `<scratch>/release-notes.txt`; `git -C <repo> tag -a v<version> -F <absolute path>`; `git -C <repo> push origin v<version>`; `gh release create v<version> --repo <R> --title v<version> --notes-file <absolute path> --verify-tag`.

### 4. Verify

The release landed: the merged PR (`gh pr view <N> --repo <R> --json state,mergeCommit`), the pushed commit on `origin/<default>`, the tag (`git -C <repo> ls-remote --tags origin v<version>`) and release (`gh release view v<version> --repo <R>`), any release workflow the push started (`gh run list --repo <R> --commit <sha>`), or the script's exit status. A failure: stop and report what ran and what did not.

### 5. Clean up

Run [cleanup.md](cleanup.md).

## Writing the wiki settings

Detect, then ask about what the repo cannot show. MUST NOT guess the release mechanism.

- **Version and scheme:** `VERSION`, a `package.json` / `composer.json` `version`, plugin manifests; tags (`git -C <repo> tag -l --sort=-creatordate`) and earlier `chore(release)` commits show the scheme and padding. One version per folder (a marketplace of plugins): `repo-release-scope`.
- **Mechanism:** a workflow on `push: tags` or `release` → `tag`; branch protection on `<default>` → `pr`; a `release` or `publish` script that does it all → `script:<name>`.
- **Ask:** "What does a release do: a tag, a GitHub release, a package publish, a merged version bump?"

Examples:

```
<!-- repo-release: tag -->
<!-- repo-versioning: semver -->
<!-- repo-version-file: package.json -->
```

```
<!-- repo-release: pr -->
<!-- repo-versioning: calver -->
<!-- repo-version-file: .claude-plugin/plugin.json -->
<!-- repo-release-scope: plugins/* -->
<!-- repo-merge: squash -->
```

## Safeguards

Writes allowed: editing the version in each released unit's version file; commit.md's and submit.md's writes for the release branch and commit; `git -C <repo> push origin <default>` (`push` and `tag`); `git -C <repo> tag -a v<version> -F <file>`; `git -C <repo> push origin v<version>`; `gh release create` with the flags above; `pnpm --dir <repo> run <name>` for `script:<name>`; cleanup.md's writes. The approval covers one release of the units the pre-flight found. Not a deploy to staging or a new issue.

## Report

The resolved settings, each unit's version (old → new) or why it was skipped, the commits shipped, each step and its result, where the release can be seen, and what cleanup did.
