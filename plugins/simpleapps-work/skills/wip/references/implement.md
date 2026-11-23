# Implement

Do the work a WIP describes, against its acceptance criteria. Code changes only: no git writes. Branching, committing and shipping belong to `/repo` (augur-build).

## Steps

1. **Branch check**, before any edit. Set `status: in-progress` and bump `last_reviewed` once it passes.
   - `git -C <repo> branch --show-current` and `git -C <repo> status --porcelain`.
   - **The branch belongs to this WIP** when it equals the frontmatter `branch`, or carries the number of the WIP's issue (`SKILL.md`: its GitHub issue, from `issue` or a cross-reference). A Basecamp or freeform WIP with no GitHub issue and no `branch` has no number to compare: any branch other than `<default>` is treated as belonging to other work.
   - **Off `<default>` on a branch that is not this WIP's** (`feat/41-...` for a WIP whose issue is 42): stop and report; the work would land in the other issue's PR.
   - **Uncommitted changes** that are neither this session's nor this WIP's (files already listed under Implementation > Changes made or Files to modify, and model files carrying this WIP's criterion ids, count as this WIP's, so a new session can resume): stop and report them; MUST NOT mix work.
   - **On `<default>`:** work in place; `/repo commit` creates the branch later. MUST NOT switch or create branches.
   - **On this WIP's branch:** record `branch` (and `pr` if one is open) in the frontmatter if empty.
2. **Ready?** The WIP MUST have Acceptance criteria, Research, Analysis and Files to modify. Criteria empty or missing: stop; there is nothing to build or check against. The rest missing: say so and suggest `/wip investigate`.
3. **No WIP at all** (the user asks to implement what was discussed): summarise the plan, confirm it, and write `<wip-dir>/impl-<slug>.md` with frontmatter (`status: in-progress`) and criteria from that plan before changing code.
4. **Load context:** the wiki pages that bear on the work, each file in Files to modify, and any `README.md` next to them.
   **A formal model** (from `/code model`, augur-build): find it by its criterion ids (`grep -rn "GH<N> c" <repo>/models`, or the WIP's file name for a WIP with no issue). Model files written for this WIP count as this WIP's in the branch check. Then follow the `lemma-driven-design` loop: **write the link first, run the proof script, and see it fail (red); report the red; only then write the code**, until model and link are green. A link that passes before the code changes means the model change did not take: report it and stop. Record the criterion-to-lemma map (from the ids) under Implementation.
5. **Work.** Make the changes without stopping for confirmation after each file. Make small decisions (names, placement) and record them. A change needs a file not on the list: make it and add the row. Stop and ask only when stuck, or when the scope turns out larger than planned. Keep any `README.md` next to changed code current. Run the project's own scripts by name (`pnpm --dir <repo> run <name>`, or the npm or composer form in `SKILL.md`) to check the work as you go.
6. **Tick criteria** as each is met, only when you can name the file and change that meets it. Each still unticked goes to Implementation > Open questions with the reason (out of scope, blocked, needs a decision, deferred).
7. **Record** an Implementation section: changes made (file and why), assumptions, deviations from the plan, open questions. Update Files to modify to match what changed; `status` stays `in-progress`.

## Report

What was built, the files changed, **criteria ticked out of total with each unticked one and its reason**, assumptions and deviations, open questions. The next checks are `/code quality` and `/code sanity-check` (augur-build), then `/repo submit`.
