# Augur API

Read and manage your site's ERP and e-commerce data, such as items, pricing, customers, and orders, by asking Claude. The plugin connects Claude to the Augur API service, so Claude can look data up across the Augur services and make changes when you ask.

**Who can sign in:** site admins (Super Users) of an Augur site. Claude works on the site you sign in to and sees what your admin account can see.

**Changes are live.** Creating, updating, or deleting a record changes your site's data straight away. Claude tells you exactly what it will change and waits for your yes before each change.

## Install

**claude.ai, Claude Desktop, and Cowork** (Pro, Max, Ultra, Team, or Enterprise plan):

1. Add the `augur` marketplace: **Customize > Plugins > Add > Add marketplace**, then enter `simpleapps-com/augur-plugins`.
2. Install **Augur API** from it.

**Claude Code:**

```
/plugin install augur-api --marketplace simpleapps-com/augur-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install augur-api@augur`.

## Sign in

The first time you use it, Claude asks you to sign in in your browser with your site and your admin username and password.

- **claude.ai, Desktop, Cowork:** open the plugin's **Connectors** tab and connect it.
- **Claude Code:** run `/mcp`, choose the Augur API server, and follow the sign-in steps.

### Team and Enterprise

Installing the plugin does not add its connector to your organization. Until an Owner adds it, the connector shows as "Not added". Ask an Owner to add it in **Organization settings > Connectors > Add > Custom > Web** with this URL:

```
https://api.augur-mcp.com/mcp
```

Then connect it with your own account from **Customize > Connectors**.

## Privacy

See the [SimpleApps privacy policy](https://www.simpleapps.com/privacy).
