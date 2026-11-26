---
name: semrush
description: Gets SEO, traffic and competitor data for any domain through the Semrush connector, on the signed-in user's own Semrush account. Every report spends that account's API units, so calls keep row limits small and state the units each one used. Covers the three-step call (discover a toolkit's reports, read a report's schema, run it), the twelve toolkits, costs and errors. Use when the user asks about a domain's rankings, keywords, traffic, backlinks, competitors, Google Ads, Shopping listings or audience, or about their Semrush projects, position tracking or site audit.
license: MIT
---

# Semrush

The Semrush connector gives Claude Semrush's own SEO, traffic and competitive data for any domain ([Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/)). Every call runs on the signed-in person's Semrush account and spends its API units.

Sources: Semrush's developer docs where linked; "seen in use" marks what the connector's own answers show (its tool and report lists, error fields), and "measured" what the SimpleApps team measured.

Keywords MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Surface | What works |
|---------|------------|
| Claude Code | Everything; sign in with `/mcp` |
| claude.ai, Desktop, Cowork | Not yet verified: the connector is added from the plugin's Connectors tab, and on Team or Enterprise an Owner adds it first. Semrush also offers its own Semrush app inside Claude ([Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/)), the route to use there until the plugin's connector is tested |

## Setup

1. The person signs in with **their own** Semrush account: in Claude Code, `/mcp`, then the Semrush server; elsewhere, the plugin's **Connectors** tab. The account needs a Semrush plan that includes API access, or an API units package; Semrush lists the plans on its [MCP page](https://developer.semrush.com/api/v4/introduction/semrush-mcp/).
2. **Connection check:** call the `domain_overview` toolkit tool with no report. It lists that toolkit's reports and costs nothing measurable. A tool that is missing, or a sign-in error: tell the person to connect Semrush, and stop. MUST NOT fill the gap with guessed or remembered numbers.

## Cost: API units

Requests through the Semrush MCP use the same API units as direct API requests ([Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/)), from the signed-in person's plan; unit costs vary by report ([Semrush: API units](https://developer.semrush.com/api/v4/get-started/api-units-balance)), and grow with the rows returned (measured):

| Report | Rows | Units | Per row |
|--------|------|-------|---------|
| `domain_ranks` | 19 | 190 | 10 |
| `resource_rank_history` | 50 | 690 | about 14 |

Measured by the SimpleApps team, 2026-10-14. Keyword and backlink reports have not been measured.

- MUST keep `display_limit` small (10 to 30) unless the person asks for more.
- MUST state the units each call used, from `metadata.usage.api_units` in its response (seen in use).
- SHOULD say up front how many reports a multi-report piece of work (an audit, a competitor gap) will run.
- The connector has no balance tool (seen in use): the person checks the remaining units in their Semrush account, under subscription info ([Semrush: API units](https://developer.semrush.com/api/v4/get-started/api-units-balance)).

## How a call works

Three steps; each step's answer describes the next ([Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/); the tool names as seen in use).

1. **Discover:** call a toolkit tool (for example `domain_overview`). It lists the toolkit's reports, each with a description and when to use it.
2. **Schema:** `get_report_schema(report)` returns the report's parameters. Use the report name exactly as listed, with no toolkit prefix.
3. **Run:** `execute_report(report, params)` returns the data as CSV text plus metadata: the units used, and a link to the same view in Semrush.

Defaults, as the report schemas give them (seen in use): `database` is `us` when no region is given (others include `ca`, `uk` and `mobile-us`); `target` takes a domain, subdomain, subfolder or full URL. `get_report_schema` is the source of truth for every parameter.

## Toolkits

| Tool | What it covers |
|------|----------------|
| `audience_research` | Audience overlap and demographics |
| `backlinks_research` | Backlinks, referring domains, anchors |
| `competitors_research` | Organic and paid competitors, keyword gaps |
| `domain_overview` | Rank, keyword, traffic and cost totals: `domain_rank` (one region, one date), `domain_ranks` (every region), `resource_rank_history` (monthly totals back to 2012) |
| `keyword_research` | Volume, difficulty, intent, CPC, related and question keywords |
| `organic_research` | Keywords a domain ranks for, positions, top pages |
| `paid_search_research` | Google Ads keywords and ad copy |
| `position_tracking` | Rank tracking for a Semrush project |
| `projects` | The signed-in account's Semrush projects |
| `shopping_research` | Google Shopping (PLA) listings and competitors |
| `site_audit` | Technical SEO issues for a Semrush project |
| `traffic_overview` | Estimated visits, traffic sources, geography |

`projects`, `position_tracking` and `site_audit` need a project set up in the person's Semrush account; the rest work on any domain. The toolkits are as the connector lists them (seen in use; [Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/)). Only `domain_overview` has been run so far; the other toolkits' report lists are not yet checked.

## Errors

A failed call returns JSON with `code` (`validation_failed`, `no_subscription`, `no_api_units`, `rate_limit`, `internal`), `message`, and sometimes `retryable`, `hint`, `url` and `trace_id` (seen in use; Semrush's general troubleshooting: [Semrush: troubleshooting](https://developer.semrush.com/api/v4/get-started/troubleshooting)).

- Relay `message` as it is, and show `url` to the person.
- Retry only when `retryable` is true, after applying `hint`. Otherwise stop and report.

## Estimates

Semrush calls its traffic figures "traffic estimates" ([Semrush: available data](https://developer.semrush.com/api/v4/introduction/available-data)), and API results do not always match the Semrush app ([Semrush: troubleshooting](https://developer.semrush.com/api/v4/get-started/troubleshooting)). Results that go to a client SHOULD say so where it matters (traffic, value), not for hard facts (a 404, a missing title). A client's domain and findings MUST NOT be written into a repo or wiki.

To turn a site's findings into cleanup tasks, use the `seo-cleanup` skill. For page speed (Core Web Vitals, Lighthouse), use the `web-vitals` skill: it needs no Semrush units.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
