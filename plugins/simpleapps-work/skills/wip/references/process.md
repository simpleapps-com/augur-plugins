# Process

## Contents

- [Steps](#steps): enumerate, migrate, reconcile, classify, act
- [Shipped: the matching rule](#shipped-the-matching-rule)
- [Promotion to the wiki](#promotion-to-the-wiki)
- [Report](#report)

Reconcile every WIP with GitHub and Basecamp, retire the old ones, and offer what is worth keeping to the wiki. Typing `/wip process` approves only the automatic deletes below; every other delete and every wiki edit needs the user's yes.

## Steps

1. **Enumerate** the WIPs in `<wip-dir>` (`ls <wip-dir>`): `*.md` directly in it. None: say so and stop.
2. **Migrate** a `*.md` without frontmatter that reads like a WIP (a `GH`/`BC` name, or Source and Problem sections): infer `issue` from the name or Source, `status` from any prose status line (`WIP` → `in-progress`, `Implemented`/`Shipped` → `shipped`, `Closed` → `abandoned`), `created` and `last_reviewed` as today, the rest empty. Write the block above the existing content and report it as migrated. Anything else without frontmatter is not a WIP: leave it and report it.
3. **Reconcile.**
   - Each `open` or `in-progress` WIP: run the matching rule below. Found shipped: set `status: shipped`, `shipped_at` and `pr`.
   - Each `shipped` or `abandoned` WIP with no `shipped_at` (migrated, or set by hand): run the matching rule for the date; nothing found: set today and say so.
   - Each WIP with no `branch` whose shipped match was a PR: record the PR's head branch (`headRefName`) as `branch`, and its URL as `pr`.
   - A `shipped` WIP whose issue is open again: report a conflict, change nothing.
   - A Basecamp WIP whose todo is completed: report it; the todo alone does not mark it shipped.
4. **Classify** with today's date, `wip-retention` (default 7) and `wip-stale` (default 30):

   | Bucket | Rule |
   |--------|------|
   | auto-delete | `shipped` or `abandoned`, `shipped_at` older than retention, `disposition: delete`, and not marked shipped in this run |
   | confirm-promote | as above, with `disposition: promote` |
   | needs-decision | as above, with `disposition` empty |
   | stale | `open` or `in-progress`, `last_reviewed` older than `wip-stale` days |
   | leave | everything else |

5. **Show** the buckets as a compact list, then act:
   - **auto-delete:** delete each file. Approved by typing `/wip process`.
   - **confirm-promote:** per WIP, run the promotion below. The user's yes covers writing the wiki edit and then deleting the WIP. A no leaves both untouched and reports it as deferred.
   - **needs-decision:** per WIP, show the title, one line of problem and the shipped date; ask promote, delete or keep. `promote` sets the disposition and runs the promotion; `delete` deletes; `keep` changes nothing, so the next run asks again.
   - **stale:** ask still active, abandon, or delete. Active bumps `last_reviewed`; abandon sets `status: abandoned` and `shipped_at` to today.
6. **`last_reviewed`** is bumped only on WIPs this run changed or the user answered about. The others keep theirs, so the stale check measures real neglect, not time since the last `process`.

Deletes touch only `*.md` files directly in `<wip-dir>` that carry WIP frontmatter, by their full path.

## Shipped: the matching rule

In order; the first that matches decides:

The WIP's issue is its GitHub issue (`SKILL.md`): its `issue` URL, or a GitHub issue in its cross-references, so a Basecamp WIP tracking an issue matches like a GitHub one.

1. A merged PR in the issue's repo that closes it: `gh pr list --repo <owner>/<repo> --state merged --search "<N>" --json number,url,mergedAt,headRefName,closingIssuesReferences`, keeping only PRs whose `closingIssuesReferences` include `<N>`.
2. A merged PR whose head branch equals the WIP's `branch`: `gh pr list --repo <R> --state merged --head <branch> --json url,mergedAt,headRefName`.
3. The issue is closed as completed: `gh issue view <N> --repo <owner>/<repo> --json state,stateReason,closedAt` with `state: CLOSED` and `stateReason: COMPLETED`. Closed as not planned or duplicate: ask whether to mark it abandoned.
4. Otherwise: not shipped. A commit on `<default>` that names `#<N>` (`git -C <repo> log origin/<default> --oneline --grep="#<N>"`, ignoring `#420` for 42) is a hint only: show it and ask, since "refs #42" can be partial work. A WIP with no GitHub issue and no `branch` cannot be matched: ask the user.

`shipped_at` is the date part of the PR's `mergedAt`, else of the issue's `closedAt`. `pr` is the PR's URL.

## Promotion to the wiki

A WIP is worth promoting only for evergreen content: a convention, a gotcha, a decision with its reasons, a pattern others will meet again. The specific bug, PR and file paths are not.

1. Find the sections that generalise (Analysis > approach, Research gotchas, Implementation > deviations and their reasons), starting from `wiki_candidates`.
2. Match them to wiki pages; propose an edit to an existing page, or a new page when none fits.
3. Draft the exact edit, not a summary, and show it. Write it only on the user's yes, uncommitted; the wiki is synced by the user (`/wiki sync`).
4. Nothing generalises: say so, set `disposition: delete`, and let a later run delete it.

MUST NOT promote a whole WIP.

## Report

```
WIP processing: <n> WIPs
Migrated: <n>          Marked shipped: <n> (how each matched)
Deleted: <n>           Promoted: <n> (pages)
Asked: <n>             Kept: <n>
Conflicts: <list>      Basecamp todos completed: <list>
```

Then stop: MUST NOT commit the wiki or the code.
