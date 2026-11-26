# Fixing what is met

## Leave it better than you found it

Every session SHOULD leave the codebase better than it found it. A broken test, a console error, an error overlay, a lint warning, or any other issue met while working MUST be fixed, whether or not this session caused it and whether or not it is part of the task.

- MUST NOT call an issue "pre-existing" to justify skipping it. Context compaction erases the session's memory of its own earlier changes, so what looks pre-existing is often something the session introduced. Even when it truly was not, the goal is zero issues, not blame.
- MUST NOT argue with the user about whether an issue is the session's to fix. It is.

**Colocated docs are code.** When code has a colocated markdown file (a `README.md`, `helpers/<topic>.md`, `docs/<topic>.md`, or whatever the codebase uses):

- MUST read it before changing the code, not after.
- A change to the behaviour it describes MUST update the file in the same commit as the code.
- A file already stale on arrival (it contradicts the code before the change) MUST be fixed or flagged, never made worse.
- Changing code with a colocated doc and leaving the doc stale is the same kind of defect as leaving a test broken.

**Subsystem READMEs count the same.** Where a subsystem uses an index and leaves (`<subsystem>/README.md` as the entry point, `<subsystem>/<item>.md` for a complex item):

- SHOULD read the README first on landing in the subsystem, then the item doc for the thing being changed.
- A change to the subsystem's shape (an item added, removed or much altered) MUST update the README's index, not only the item doc.

How the wiki points at colocated docs: the `wiki` skill.

## Resolve, never hide

When a check fails, the fix is ALWAYS in the underlying code. MUST NOT:

- Add `--no-verify`, `--force`, or any flag that bypasses a check or hook.
- Disable or weaken a lint rule (`eslint-disable`, removing a rule, editing its config).
- Silence a type error (`@ts-ignore`, `@ts-expect-error`, `any`).
- Skip or delete a failing test (`.skip`, `.only`, deleting the test).
- Suppress a warning, lower a coverage threshold, or edit a quality config to pass.

These hide the problem; they do not fix it.

- **A suppression already in the code is a defect too:** fix it in the same run. The `code` skill's quality run carries the list.
- **Deleting a test that covers removed behaviour is cleanup;** deleting a test because it fails is hiding.
- **A rule or test that seems wrong:** MUST investigate why it exists before concluding it should change; rules exist for reasons. If, after that, it truly does not apply, explain the reasoning to the user and let them decide. MUST NOT disable it unilaterally.
