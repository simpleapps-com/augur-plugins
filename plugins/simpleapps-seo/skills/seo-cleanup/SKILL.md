---
name: seo-cleanup
description: Turns Semrush findings or slow Core Web Vitals for one site the user names into a reviewed list of cleanup tasks, one per fixable problem type, with how many pages, example URLs and the source report. With the simpleapps-work plugin's SimpleApps Basecamp connector it then creates the approved tasks as Basecamp todos, and gives code work a cross-linked GitHub issue; without it, it stops at the reviewed list. Use when the user asks to clean up a site's SEO or page speed, turn a Semrush audit, lost rankings or slow pages into tasks or todos, or plan SEO fixes for a site.
license: MIT
---

# SEO cleanup

Turns Semrush findings, or slow pages, for one chosen site into cleanup work the team can act on. Semrush reports come from the Semrush connector (the `semrush` skill: how a call works, its costs and its errors); page speed comes from the `web-vitals` skill.

Keywords MUST, SHOULD, MAY per RFC 2119.

**Before anything else:**

- MUST work on one site the person names. Sites are chosen, never swept across all clients.
- MUST show every task's exact text before anything is created, and create nothing without the person's yes for that list.
- Step 5 needs the **simpleapps-work** plugin's SimpleApps Basecamp connector. Without it, this skill MUST stop at the reviewed task list (step 4) and say that creating todos needs simpleapps-work.
- A client's domain and findings MUST NOT be written into a repo, wiki or other file: they belong in Basecamp and GitHub.

## Where it runs

| Surface | What works |
|---------|------------|
| Claude Code | Every step; the GitHub issue is filed with `gh` after the person's yes |
| claude.ai, Desktop, Cowork | Steps 1 to 4, and Basecamp todos through the connector. There is no `gh`: the GitHub issue text is drafted for the person to file. Not yet verified |

## Steps

1. **Pick the site and the scope.** The person names the site and what to check: technical issues, lost rankings, broken internal links, missing schema, or slow pages (Core Web Vitals). Ask when either is missing.
2. **Gather.** Say how many reports or measurements the scope will run.
   - Semrush scopes: run the reports with small row limits (`display_limit` 10 to 30) and state the units each one spent (the `semrush` skill). `site_audit` needs a Semrush project for the domain; without one, say so and offer the reports that work on any domain.
   - Slow pages: measure the pages the person names with the `web-vitals` skill (PageSpeed Insights, mobile; no Semrush units), and read the results by its "Reading Core Web Vitals" section.
3. **Group into tasks.** One task per fixable problem type, not per URL: what is wrong, how many pages, a few example URLs, and the report or measurement it came from. For slow pages, one task per cause Lighthouse names (an unoptimised LCP image, render-blocking scripts, layout shifts), with the failing metric and whether it is field or lab data. Drop what the team cannot act on: estimates with no page to fix, and issues outside the site's code or content. Where a task rests on traffic or value, say the numbers are what Semrush calls "traffic estimates" ([Semrush: available data](https://developer.semrush.com/api/v4/introduction/available-data)).
4. **Show the draft.** Every task's exact title and text, the Basecamp project and todo list, and any assignee. Which tasks need code work, and so a GitHub issue in the site's repo. Wait for the person's yes; a change to the list needs a new yes.
5. **Create** (simpleapps-work's SimpleApps Basecamp connector only). Create each approved todo with the connector's create-todo tool, in the project and list the person chose. For a task that needs code work, file a GitHub issue in the site's repo with the approved text, then link the todo and the issue to each other. In chat, give the issue text and the repo instead.

## Report

The site and scope, the reports run and the units each spent (or the pages measured), the tasks (created, or drafted and not created), and the links to every todo and issue created.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
