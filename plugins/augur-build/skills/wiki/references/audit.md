# Audit

Check the wiki's health and report. `audit` MUST NOT write anything: no page, no key, no git. Apply this project's overrides first: the `## Audit` section of `Wiki-Maintenance.md`, and `wiki-token-budget`, `wiki-token-budget-reason`, `wiki-required-pages`, `wiki-min-links` and `wiki-index` in `Home.md` (rules in `SKILL.md`).

Run each check as its own simple command. Quote globs (`"*.md"`): some shells expand them first.

## Checks

1. **Token budget.** Read the budget and reason from `Home.md` (default 20000). Count words with `wc -w <wiki>/*.md` and multiply the total by 1.3 for tokens. Report usage, the budget, the percentage, and the reason if raised.
2. **Required pages.** Each page in `wiki-required-pages` (default `Deployment, Testing`) exists.
3. **Broken links.** List every link: `grep -rEon --include="*.md" "\[\[[^]]+\]\]" <wiki>/` (the bracket expression `[^]]` works under every `grep`; `[^\]]` does not). For each link, the target is the part after any `|` (`[[Display text|Page]]` targets `Page`), without any `#anchor`. The target page MUST exist; for an anchor, the target page MUST have a heading whose slug matches.
4. **Index drift.** If the index page (`wiki-index`, default `llms.txt`) exists, compare it with the pages on disk: pages it lists that do not exist, and pages that exist but it does not list.
5. **Link density.** Count each page's outbound links from the list in check 3. Pages with fewer than `wiki-min-links` (default 2) are isolated: list every page by count, lowest first.
6. **Orphans.** Pages no other page links to. `Home.md`, `_Sidebar.md` and the index page are entry points, not orphans.
7. **Link dumps.** Pages whose trailing "Related" or "See also" links outnumber their inline links (the conventions' cross-linking rules).
8. **Settings.** Report any unknown `wiki-*` key, malformed value or duplicate key in `Home.md`.

## Report

```
## Wiki audit

Overrides: (which applied, or none)
Token budget: X / {budget} (Y%){, reason: "..." if raised}
Required pages: present / missing: Testing.md
Broken links: N
- Page.md:42 → [[Missing-Page]]
Index: in step / N issues
- not in the index: Page.md
- not on disk: Old-Page.md
Link density (below {min}):
| Page | Outbound links |
| Isolated-Page.md | 0 |
Orphans: N
- Orphan-Page.md
Link dumps: N
Settings: fine / issues
```

Then stop.
