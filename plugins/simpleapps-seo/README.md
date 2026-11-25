# SimpleApps SEO

SEO work by asking Claude: rankings, keywords, traffic, backlinks, competitors, Google Ads and Shopping data for any domain from Semrush; page speed (Core Web Vitals and Lighthouse) from Google's PageSpeed Insights; and a site's findings turned into a reviewed list of cleanup tasks. Built for the SimpleApps team; anyone with a Semrush plan that includes API access can use it.

**It spends your Semrush API units.** Requests through the Semrush MCP use the same API units as direct API requests ([Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/)), and every Semrush report runs on your own Semrush account. Claude keeps row limits small, says how many reports a piece of work will run, and states the units each one used. Check your remaining units in your Semrush account ([Semrush: API units](https://developer.semrush.com/api/v4/get-started/api-units-balance)).

## Skills

| Skill | Use it for |
|-------|------------|
| `semrush` | Asking about any domain: "what does example.com rank for?", "who are its organic competitors?", "show its backlink profile". Small reports, with their unit cost stated |
| `web-vitals` | How fast a live page is for real users: Core Web Vitals (LCP, INP, CLS) and the Lighthouse performance score from Google's PageSpeed Insights, on mobile, against Google's "good" thresholds, with what to fix. Spends no Semrush units |
| `seo-cleanup` | Turning one site's findings (technical issues, lost rankings, broken internal links, missing schema, slow pages) into tasks, one per problem type, shown to you before anything is created. With the **simpleapps-work** plugin's Basecamp connector it then creates the approved todos, and a cross-linked GitHub issue for code work; without it, it stops at the reviewed list |

Each skill answers `help` with how it is used.

## Install

Not yet tested on any surface: the first release check is a Semrush sign-in and one report in Claude Code. On claude.ai, Semrush also offers its own Semrush app inside Claude ([Semrush: MCP server](https://developer.semrush.com/api/v4/introduction/semrush-mcp/)); use that there until this plugin's connector is checked.

**Claude Code:**

```
/plugin install simpleapps-seo --marketplace simpleapps-com/augur-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install simpleapps-seo@augur`.

**claude.ai, Claude Desktop, and Cowork** (Pro, Max, Ultra, Team, or Enterprise plan):

1. Add the `augur` marketplace: **Customize > Plugins > Add > Add marketplace**, then enter `simpleapps-com/augur-plugins`.
2. Install **SimpleApps SEO** from it.

## Sign in

Sign in with your own Semrush account; the account needs a Semrush plan that includes API access, or an API units package; Semrush lists the plans on its [MCP page](https://developer.semrush.com/api/v4/introduction/semrush-mcp/). The plugin holds no credentials. `web-vitals` needs no sign-in: it calls Google's public [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started).

- **Claude Code:** run `/mcp`, choose the Semrush server, and follow the sign-in steps.
- **claude.ai, Desktop, Cowork:** open the plugin's **Connectors** tab and connect it.

### Team and Enterprise

Installing the plugin does not add its connector to your organization. Until an Owner adds it, the connector shows as "Not added". Ask an Owner to add it in **Organization settings > Connectors > Add > Custom > Web** with this URL:

```
https://mcp.semrush.com/v2/mcp
```

Then connect it with your own account from **Customize > Connectors**.

## Privacy

The Semrush connector is Semrush's own server: the domains you ask about and the reports you run go to Semrush under your Semrush account, and the [Semrush Privacy Policy](https://www.semrush.com/company/legal/privacy-policy/) applies to them. SimpleApps does not see or store them. `web-vitals` sends the page URLs you name to Google's PageSpeed Insights, which measures only public pages. For this plugin, see the [SimpleApps privacy policy](https://www.simpleapps.com/privacy).
