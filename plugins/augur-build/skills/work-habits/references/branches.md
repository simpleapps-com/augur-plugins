# Keeping unrelated work apart (Claude Code)

The behaviour stays here; the procedure belongs to the skills that run git.

## The rules

- MUST NOT mix unrelated work: one branch and one change per piece of work. Work for issue N MUST NOT land on issue M's branch.
- MUST NOT touch uncommitted changes the session did not make (commit, stash, discard or overwrite them) without the user's instruction. A dirty tree that is not this work's: stop, list the files, propose one path, and let the user choose.
- Branch state is the agent's job, not the user's: SHOULD handle a routine, safe transition without ceremony, and SHOULD NOT raise an alarm over one. Branching mistakes compound, and the cost of recovery grows with every command before they are caught, so the check runs before the first edit.
- MUST NOT prompt the user for a git action (SKILL.md, "Never prompt for git actions").

## Where the procedure lives

- **Before the first edit:** `wip implement`'s branch check (the `wip` skill, simpleapps-work): what to do on the default branch, on this work's branch, on another issue's branch, and with uncommitted changes.
- **Branches, commits and the return to the default branch** once the work is merged: the `repo` skill (`/repo commit`, `/repo submit`, `/repo cleanup`), within the project's `git-safety` rule.

## Parallel work in a worktree

When a second piece of work MUST NOT disturb the current checkout, SHOULD delegate it to a subagent with `isolation: "worktree"` (Claude Code's Agent tool) instead of switching branches.

- The main session MUST NOT move into the worktree itself: a session that enters a worktree is sealed off from the project's `wip/` and `tmp/`.
- The subagent is sealed the same way, so its brief MUST carry the WIP and wiki content it needs.
- A kept worktree whose work is pushed MUST be removed, and only after a check that it holds no unpushed commit: git refuses to remove a worktree only for uncommitted files, so an unpushed commit would be orphaned. MUST NOT force the removal; a refusal means it still holds work, so ask.
