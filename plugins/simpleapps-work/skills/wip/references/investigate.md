# Investigate

Research a WIP until the root cause, the files to change and an approach are clear. MUST NOT change code.

## Steps

1. **Load the WIP**, and set `status: in-progress` if it was `open`; bump `last_reviewed`.
2. **Load the wiki**, the project's model of how it works: Read `<wiki>/Home.md`, the index page (`llms.txt`) if there is one, and the pages that bear on the problem; read all of them when the problem touches several areas. No wiki: say so and carry on.
3. **Look for what already exists before reading code:**
   - Shared packages the project depends on (for an Augur site, the `@simpleapps-com/augur-*` packages' `llms.txt` and `README.md` in `node_modules`); a package export beats new code.
   - A `README.md` next to the code involved: subsystem notes, invariants, past decisions.
   - `git -C <repo> log --oneline -10 -- <path>` for the files involved.
4. **Explore** the code path the problem runs through: search, read the key files, follow the flow. Review any attachment the WIP lists without a summary. Stop when the root cause, the files to change and an approach are known; the whole system need not be understood.
5. **Acceptance criteria.** Add the implied ones, each marked `_(inferred)_`: what a reasonable developer on this project would expect the request to include (a new field is shown, saved and validated). No gold-plating. MUST NOT reword or remove the existing ones. A WIP with no criteria section gets one built from Problem first.
6. **Write** Research (what the code does now, where the problem starts, related code, edge cases), Analysis (root cause, suggested approach, alternatives, risks) and Files to modify.

## Report

The findings in brief, the suggested approach, the files involved, criteria added, and any decision the user needs to make before implementing.
