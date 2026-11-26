# SimpleApps Work

For SimpleApps staff. Work with Basecamp 2 from claude.ai, Claude Desktop, Cowork, or Claude Code: see what is on your plate, read client requests and their attachments, and comment, assign, and post.

**Staff only.** Anyone can install the plugin, but only a SimpleApps staff account can sign in. Claude acts as you in Basecamp, so your comments and posts show under your name.

## Skills

| Skill | Use it for |
|-------|------------|
| `basecamp` | Working in Basecamp the team's way: a client request read in full (every comment and attachment), ids found from a link and the project's site-info document, and comments, todos and assignments drafted for your yes before anything posts. Turns a request into a GitHub issue for code work, cross-linked both ways, and keeps client detail in Basecamp and technical detail in GitHub. Filing the issue needs Claude Code; in chat it drafts the issue for you to file |
| `guide` | A short tour for new staff: the project folder, how work flows from Basecamp to GitHub to a WIP to a pull request, which skill does what, and a typical session, pointing to each skill's own `help` |
| `project` | The SimpleApps project folder (`repo/`, `wiki/`, `wip/`, `tmp/`, `clones/`, `worktrees/`, `goals/`, `.simpleapps/`): a bare `/project` explains it; `/project init` checks a folder and fixes what is missing (symlinks, the per-user settings and their permission defaults), asking before any write outside the project, and hands the rules and `CLAUDE.md` to `/rules write`. Needs Claude Code; in chat it explains the layout |
| `wip` | Tracking a piece of work from a GitHub issue or Basecamp item to shipped, in a local WIP file that is never committed. `/wip <issue or Basecamp link>` creates the WIP (request, acceptance criteria, attachment summaries) and investigates it, or refreshes an existing one. `/wip triage` shows the repo's issues, PRs and WIPs; `/wip investigate` and `/wip implement` research and build against the criteria; `/wip process` marks shipped work and retires old WIPs. It never writes to git or GitHub: with Augur Build installed, `/repo` commits and ships. Everything but drafting needs Claude Code; in chat it drafts a WIP from a Basecamp item, or from a GitHub issue you paste |

## Install

**claude.ai, Claude Desktop, and Cowork** (Pro, Max, Ultra, Team, or Enterprise plan):

1. Add the `augur` marketplace: **Customize > Plugins > Add > Add marketplace**, then enter `simpleapps-com/augur-plugins`.
2. Install **SimpleApps Work** from it.

**Claude Code:**

```
/plugin install simpleapps-work --marketplace simpleapps-com/augur-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install simpleapps-work@augur`.

## Sign in

The first time you use it, Claude asks you to sign in in your browser: first with your SimpleApps staff account, then, once only, to link your own Basecamp account.

- **claude.ai, Desktop, Cowork:** open the plugin's **Connectors** tab and connect it.
- **Claude Code:** run `/mcp`, choose the Basecamp server, and follow the sign-in steps.

### Team and Enterprise

Installing the plugin does not add its connector to your organization. Until an Owner adds it, the connector shows as "Not added". Ask an Owner to add it in **Organization settings > Connectors > Add > Custom > Web** with this URL:

```
https://basecamp.augur-mcp.com/mcp
```

Then connect it with your own account from **Customize > Connectors**.

## Privacy

See the [SimpleApps privacy policy](https://www.simpleapps.com/privacy).
