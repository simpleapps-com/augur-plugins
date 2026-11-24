# Cleanup

## Does

Leaves the clone tidy once work has merged: on `<default>`, up to date, with no merged branches or this run's files left behind. `submit` and `publish` run it at the end; `/repo cleanup` runs it alone and also clears older merged leftovers.

## Reads

`repo-branch` on `Deployment.md`.

## The decisions are proved

Whether to move and which branches to delete come from `cleanup-plan.ts`, a script proved against a formal model. Run it with the full path `SKILL.md` gives under "Proved decisions", the mode, and the facts gathered as JSON in single quotes (`cleanup-plan.ts move '<json>'`, `cleanup-plan.ts branches '<json>'` below). It prints JSON and runs nothing; this skill runs the git commands it names. Follow its answer; MUST NOT override it. Exit code 2 (bad input) or a failure to run (no Node 22.18 or later): switch nothing, delete no branch, do step 5, and report it. Where no script can run (chat), the rules below decide, read exactly as written.

## Steps

1. **Facts.** `git -C <repo> status --porcelain` (any output: `dirty` is true), `git -C <repo> branch --show-current` (`current`), `<default>`, and, when `current` is not `<default>`, its open PR: `gh pr list --repo <R> --head <current> --state open --json number` (`currentOpenPr`: the list is not empty).
2. **The move.** Run `cleanup-plan.ts move '{"dirty":…,"current":"…","default":"…","currentOpenPr":…}'`. It answers `stays`, `switch`, `fastForward` and `endsOn`.
   - `dirty`: switch nothing, delete no branch; do step 5 only, and report the changes.
   - `switch`: `git -C <repo> switch <default>`.
   - Then, on a clean tree: `git -C <repo> fetch --prune origin`.
   - `fastForward`: `git -C <repo> merge --ff-only origin/<default>`. A fast-forward that fails (local commits on `<default>`): stop and report; delete nothing.
   - `stays`: the branch has an open PR, and review fixes land on it; it stays checked out.

   Rule: an open PR on a branch other than `<default>` stays; otherwise a clean tree switches to `<default>` and fast-forwards.
3. **Branch facts**, after the move. Re-read `status --porcelain` (`dirty`) and `branch --show-current` (`current`). For each local branch (`git -C <repo> branch --format="%(refname:short)"`, quoted):
   - `tip`: `git -C <repo> rev-parse <branch>`;
   - `mergedHeads`: every `headRefOid` from `gh pr list --repo <R> --head <branch> --state merged --json number,headRefOid`;
   - `listedMerged`: `git -C <repo> branch --merged <default>` lists it.
4. **Branches.** Run `cleanup-plan.ts branches '{"dirty":…,"current":"…","default":"…","branches":[{"name":"…","tip":"…","mergedHeads":["…"],"listedMerged":…}]}'`. For each branch it answers a `step` and a `reason`:
   - `force-delete`: `git -C <repo> branch -D <branch>` (a squash merge leaves git calling it unmerged);
   - `safe-delete`: `git -C <repo> branch -d <branch>`;
   - `keep`: nothing. Report the reason.

   Rule: never `<default>` or the branch checked out; `-D` only when the tip equals a merged PR's `headRefOid`; else `-d` when git lists it as merged; else keep it, since it holds work no merge contains.
5. **Leftovers.** Delete the files this run wrote in `<scratch>`, by path, and nothing else there. Report any stash (`git -C <repo> stash list`) or worktree (`git -C <repo> worktree list`); MUST NOT drop or remove them.

## Writing the wiki settings

None. Build folders and dev servers are the project's own business; cleanup touches only git state and its own files.

## Safeguards

Writes allowed: `git -C <repo> switch <default>`, `git -C <repo> fetch --prune origin`, `git -C <repo> merge --ff-only origin/<default>`, `git -C <repo> branch -d <branch>` and `git -C <repo> branch -D <branch>` only for a branch the plan marks so, and deleting this run's files. Running `cleanup-plan.ts` is read-only and needs no approval. A branch whose tip differs from its merged PR holds unpushed work: keep it.

## Report

The branch now checked out and whether it moved; each branch deleted and why; each branch kept and its reason; any stash or worktree; the files removed.
