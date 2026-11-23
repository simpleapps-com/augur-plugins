# WIP schema

## Contents

- [File name](#file-name)
- [Frontmatter](#frontmatter)
- [Status lifecycle](#status-lifecycle)
- [Sections](#sections)
- [Acceptance criteria](#acceptance-criteria)
- [Attachments](#attachments)
- [What never goes in a WIP](#what-never-goes-in-a-wip)

## File name

- From a GitHub issue: `GH<N>-<slug>.md`. From a Basecamp item: `BC<id>-<slug>.md`. Freeform: `<slug>.md`, no prefix. Work implemented with no WIP: `impl-<slug>.md`.
- `<slug>`: the title lower-cased, every run of other characters turned into one hyphen, trimmed of hyphens, cut at the last whole word within 50 characters.

## Frontmatter

Every WIP starts with this block. A file without it is not a WIP, except when `process` migrates it.

```yaml
---
issue: https://github.com/<owner>/<repo>/issues/<N>
branch:
status: open
created: 2026-11-23
last_reviewed: 2026-11-23
shipped_at:
pr:
disposition:
wiki_candidates:
---
```

| Field | Values | Written by |
|-------|--------|------------|
| `issue` | GitHub or Basecamp URL; empty when freeform | creating |
| `branch` | The work branch, recorded read-only whenever the current branch is not `<default>` | bare `/wip`, `implement`, `process` |
| `status` | `open`, `in-progress`, `shipped`, `abandoned` | see the lifecycle |
| `created` | ISO date; never changes | creating |
| `last_reviewed` | ISO date | every run that changes the WIP, or where the user confirms it is still active (not `triage`, which only reads) |
| `shipped_at` | ISO date (the date part of a timestamp): the PR's merge date, the issue's close date, or the day abandoned | `process`, once |
| `pr` | PR URL, or a commit SHA | bare `/wip`, `implement`, `process` |
| `disposition` | `keep`, `promote`, `delete`, or empty (not decided) | the user, or `process` on their answer |
| `wiki_candidates` | Comma-separated wiki page names | the user, or `process` drafting a promotion |

MUST NOT invent values: leave a field empty until a run knows it.

## Status lifecycle

```
open ──┬─▶ in-progress ──▶ shipped ──▶ kept wip-retention days ──▶ deleted or promoted
       └─▶ abandoned ─────────────────▶ kept wip-retention days ──▶ deleted or promoted
```

- `open`: created, no work yet.
- `in-progress`: set by `investigate` or `implement` when they start.
- `shipped`: set by `process` when it finds the work merged ([process.md](process.md)), or by the user.
- `abandoned`: set by the user, or by `process` on the user's answer.

`open` and `in-progress` WIPs are never deleted automatically.

## Sections

In this order; a section with nothing in it may be left out, except Acceptance criteria.

```
# <GH #N | BC #id | title>: <title>
## Source            links, cross-references (the GitHub issue a Basecamp item tracks, or the reverse)
## Problem           the request, in full
## Acceptance criteria
## Attachments       one entry per attachment (below)
## Comments          each comment: author, date, text
## Research          investigate
## Analysis          root cause, approach, alternatives, risks
## Implementation    implement: changes made, assumptions, deviations, open questions
## Files to modify   a table: file, change
```

## Acceptance criteria

Each criterion is a `- [ ]` line, written before the work so the work can be checked against it:

- **Observable:** an outcome someone can check ("the contact page shows 555-1234"), not a task ("update the phone").
- **Sourced:** ends `_(source: body)_`, `_(source: title)_` or `_(source: comment <author> <date>)_`, or `_(inferred)_` for what the request clearly implies. Inferred means implied, not gold-plating.
- **Proportional:** a one-line request gets one criterion.
- **Permanent:** MUST NOT be reworded, deleted, or unticked once written. A criterion that turns out wrong, impossible or out of scope stays, with the reason under Analysis > Risks.
- **Ownership:** creating writes the explicit ones from the source; `investigate` adds inferred ones; `implement` ticks only what it can point to in the diff, and copies each unticked one to Implementation > Open questions with the reason.

An unticked box is a visible omission; ticking one that was not earned is a false statement the user will read. A WIP from an issue or Basecamp item MUST have the section; a freeform WIP SHOULD, from the user's stated goal.

## Attachments

A WIP created or refreshed from a Basecamp item MUST include every attachment on the item and on every comment:

1. Download each with the Basecamp connector's attachment tool, where it has one; the content comes back in the result, nothing is saved. Without one, record each attachment's name and link and say it could not be read.
2. Write a summary from what was seen, so a later reader need not download it again: for an image, the visible state, error text, highlighted areas and before/after; for a PDF or document, its key facts; for a spreadsheet, the columns and sample rows.
3. A linked document the tool cannot read (such as a Google Doc): record the link and that it was not readable.
4. A failed download: retry once, then record the failure with the attachment's id. MUST NOT drop it silently, and MUST NOT list an attachment by file name alone.

Entry format:

```
### <file name> (<type>)
- ID: <id>
- Link: <the item's web link>
- Summary: <what was seen>
```

A refresh downloads and summarises only attachments whose id is not already in the section.

## What never goes in a WIP

- Secrets, tokens, credentials.
- The raw content of an attachment (the summary and the link go in).
- Final documentation (that belongs in the wiki) or production code (the repo).
