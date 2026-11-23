# Curate

## Contents

- [Before starting](#before-starting)
- [1. Budget](#1-budget)
- [2. Load](#2-load)
- [3. Assess](#3-assess)
- [4. Missing required pages](#4-missing-required-pages)
- [5. Propose](#5-propose)
- [6. Apply](#6-apply)
- [7. Final budget check](#7-final-budget-check)
- [8. Report](#8-report)

## Before starting

Improve the wiki: each run targets the highest-value gaps, not every possible improvement, and keeps the wiki within its token budget. Apply this project's overrides first: the `## Curate` section of `Wiki-Maintenance.md`, and the settings in `Home.md` (rules in `SKILL.md`). Read [the conventions](conventions.md) before assessing.

The code is the ground truth; this session is the hint where to start. Use what was learned, discussed or changed this session to find where the wiki most needs attention, then check it against the code.

**Priority:** fix inaccuracies and critical gaps first (a missing required page, outdated instructions, wrong claims), then clarity and organisation. An accurate wiki with rough prose beats a polished one that delays shipping. MUST NOT polish pages that are already accurate and clear.

**Writes and waits.** Steps 1 to 5 read and plan only: nothing is written before the user approves the proposal in step 5. Run the steps in order without stopping, except at the four waits: the user's answers to questions about a missing page (step 4), their approval of the proposal (step 5), and in step 7 their approval of further pruning or their choice on the budget. `curate` MUST NOT commit or push, MUST NOT change a `wiki-*` key except `wiki-token-budget` and `wiki-token-budget-reason` as step 7 allows, and MUST NOT change a `repo-*`, `code-*` or `wip-*` setting.

## 1. Budget

Read `wiki-token-budget` and `wiki-token-budget-reason` from `Home.md` (default 20000). Count: `wc -w <wiki>/*.md`, times 1.3. Record the starting usage, the budget and the reason.

- **Under 90%:** curate freely.
- **90% to 100%:** pruning is a priority this run. Find pruning candidates before assessing; propose nothing new without matching cuts.
- **Over 100%:** recovery. Propose nothing new; the run is about cutting back under budget, or the budget prompt in step 7.

## 2. Load

List `<wiki>/` and Read every page with the Read tool, without a subagent: the whole wiki MUST be in this context.

## 3. Assess

Check each page against the conventions and the code:

- **Accuracy.** Are claims true? Check them against the code (search, Read, or an exploring subagent). What did this session reveal that is missing?
- **Context.** Does each page explain why, not just what? Are decisions recorded with their reasons? Could an agent act on it without guessing?
- **Organisation.** Is information where a reader would look? Is the sidebar complete and logical?
- **Cross-links.** Are concepts explained elsewhere linked to the section that explains them? Are there isolated pages (fewer than `wiki-min-links`)? Link where a reader needs to go next, not to raise a count.
- **Usability.** Can a reader find what they need fast? Is each page self-contained?
- **Directive language.** Every requirement uses MUST, MUST NOT, SHOULD, SHOULD NOT or MAY. Rewrite soft wording ("always", "never", "make sure", "try to", "should probably", "needs to", "remember to"): agents downgrade soft language.
- **Consolidation.** Merge duplicated or scattered content; one page is the source, others link to it.
- **Pruning.** Remove what is outdated, filler, or not worth its tokens.
- **Relocation.** A page over about 1,000 tokens on one subsystem's internals, needed in fewer than half of sessions, is a candidate to move next to the code with a signpost left behind (the conventions' "Colocated detail docs"). Prefer relocating to compressing when the detail is valuable and tied to code. If a stale colocated file already exists, reconcile the two against the code first.
- **Always-loaded files (report only).** The repo's `CLAUDE.md` and `.claude/rules/*.md` load on every prompt. Flag: over 200 lines in `CLAUDE.md`; hardcoded counts, versions or dates; rules carrying full guidance instead of pointing to a skill or page; content that duplicates the wiki. `CLAUDE.md` SHOULD hold only pointers.

## 4. Missing required pages

For each page in `wiki-required-pages` (default `Deployment, Testing`) that does not exist, drafting it is the highest-priority proposal. Draft it in this context only; it is written in step 6, once approved.

**Deployment** explains, for people, how the project submits (commit and open a PR, or push), deploys to staging, and releases. The `repo` skill's `repo-*` settings live on it too; propose them through `/repo publish` or `/repo deploy`, which draft them, not here.

1. Scan for the process: CI workflows, package scripts (`deploy`, `release`, `build`), deploy configs, version files and their scheme, tag-triggered workflows, branch rules. In a pnpm workspace, Submit MUST include running `pnpm install` at the root after any package change and committing the updated lockfile (CI installs with `--frozen-lockfile`).
2. Draft from what was found.
3. Ask the user about anything the code does not show ("Does merging to main deploy to staging?"). MUST NOT guess; wait for the answers.
4. Finish the draft from the code and the answers.

**Testing** covers the test tiers (automated and manual), the test data, and a checklist of concrete, checkable conditions by area ("the price shows $9.26", not "works"). Include what this session learned: new edge cases, failure patterns, test data.

If a required page exists, check it still matches the code, and propose fixes for any drift.

## 5. Propose

List the improvements in priority order, so the user can draw the line:

```
N. [ACTION] Page.md: what changes
   Why: what it fixes or improves
   To: <path in the code repo>   (RELOCATE only: where the detail file goes)
```

Actions: CORRECT, EXTEND, CONSOLIDATE, PRUNE, REORGANIZE, TIGHTEN, RELOCATE, CREATE. A CREATE includes adding the page to `_Sidebar.md`, `Home.md` and the index page. Ask the user to confirm; they MAY approve all, some, or change the plan. Wait for the answer.

## 6. Apply

Make each approved change: Edit for an existing page, Write for a new one (`<wiki>/<Pascal-Case-Name>.md`). Follow the conventions: three audiences, RFC 2119 keywords, principles not pasted code, links to source files, pages self-contained, no filler. Apply only what was approved.

For an approved RELOCATE, write the detail file in the code repo first (at the path the proposal named, uncommitted), check it holds the detail, and only then cut the wiki page to its summary and signpost. A RELOCATE writes nothing else outside `<wiki>`.

## 7. Final budget check

Count again and compare with step 1.

- **At or under 90%:** done.
- **90% to 100%:** list pruning candidates for the next run.
- **Over budget:** if there are cuts that remove nothing a reader needs, propose them as in step 5, wait for approval, apply them, and count again. When every remaining cut would remove needed content, show the prompt below and STOP.

> "The wiki is at {final} tokens; its budget is {budget}. Further pruning would remove [specific content]. Options: (a) prune anyway, (b) raise the budget to a number you name (recorded in Home.md with your reason)."

Running `curate` is NOT approval to raise the budget: every agent in every session pays for it. MUST NOT edit the budget until the user chooses (b) AND names the number ("raise to 25000"); "ok", "yes" or "go ahead" are not enough. Then ask for the reason in one sentence, MUST NOT write one for them, and record both in `Home.md`. If the two comments already exist, update them in place; otherwise add them directly after the top `# Title`:

```
<!-- wiki-token-budget: 25000 -->
<!-- wiki-token-budget-reason: <the user's reason> -->
```

## 8. Report

- Each change applied, with its page and action
- The budget: before → after (X / budget, and the reason if raised)
- What improved, in a line or two
- That nothing is committed

Then stop: MUST NOT commit, push, or suggest the next command.
