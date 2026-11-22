# Augur Intelligence

Ask plain-language questions about your company's ERP data, such as sales, customers, orders, and inventory, and get answers in business terms. Augur Intelligence is read-only: it never changes your data.

The plugin connects Claude to the Augur Intelligence service. You sign in with your own account, and Claude only sees the data that account can see.

## Install

**claude.ai, Claude Desktop, and Cowork** (Pro, Max, Ultra, Team, or Enterprise plan):

1. Add the `augur` marketplace: **Customize > Plugins > Add > Add marketplace**, then enter `simpleapps-com/augur-plugins`.
2. Install **Augur Intelligence** from it.

**Claude Code:**

```
/plugin install augur-intelligence --marketplace simpleapps-com/augur-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install augur-intelligence@augur`.

## Sign in

The first time you use it, Claude asks you to sign in to Augur Intelligence in your browser.

- **claude.ai, Desktop, Cowork:** open the plugin's **Connectors** tab and connect it.
- **Claude Code:** run `/mcp`, choose the Augur Intelligence server, and follow the sign-in steps.

### Team and Enterprise

Installing the plugin does not add its connector to your organization. Until an Owner adds it, the connector shows as "Not added". Ask an Owner to add it in **Organization settings > Connectors > Add > Custom > Web** with this URL:

```
https://intelligence.augur-mcp.com/mcp
```

Then connect it with your own account from **Customize > Connectors**.

## Privacy

See the [SimpleApps privacy policy](https://www.simpleapps.com/privacy).
