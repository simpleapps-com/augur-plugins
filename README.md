# augur

Claude plugins for Augur, from SimpleApps. Add the marketplace once and install its plugins in claude.ai (chat, Desktop, Cowork) and in Claude Code.

## Plugins

| Plugin | For | Install in Claude Code |
|--------|-----|------------------------|
| [Augur Intelligence](plugins/augur-intelligence/README.md) | Business users asking plain-language questions about their company's ERP data | `/plugin install augur-intelligence --marketplace simpleapps-com/augur-plugins` |
| [Augur API](plugins/augur-api/README.md) | Site admins reading and managing their site's ERP and e-commerce data, with Claude asking before every change | `/plugin install augur-api --marketplace simpleapps-com/augur-plugins` |
| [SimpleApps Work](plugins/simpleapps-work/README.md) | SimpleApps staff working with Basecamp 2 from any Claude surface | `/plugin install simpleapps-work --marketplace simpleapps-com/augur-plugins` |
| [Augur Build](plugins/augur-build/README.md) | Developers, including third parties, building on Augur: wiki, shipping, code checks and proofs | `/plugin install augur-build --marketplace simpleapps-com/augur-plugins` |
| [SimpleApps Status Line](plugins/simpleapps-statusline/README.md) | SimpleApps developers: status lines under the prompt. **Claude Code only** | `/plugin install simpleapps-statusline --marketplace simpleapps-com/augur-plugins` |
| [Augur PHP LSP](plugins/augur-php-lsp/README.md) | Developers on the Augur monorepo: the Intelephense PHP language server with vendor copies and caches left out of the index. **Claude Code only**; needs `npm install -g intelephense` | `/plugin install augur-php-lsp --marketplace simpleapps-com/augur-plugins` |
| [SimpleApps Work Pane](plugins/simpleapps-work-pane/README.md) | SimpleApps staff: a Work pane for a `simpleapps-work` project, with what you track and a Sync. **Claude Code only**; needs SimpleApps Work | Runs only in the project that holds `work/`: see its [Install](plugins/simpleapps-work-pane/README.md#install) |

On claude.ai, Desktop, and Cowork, add the marketplace (below), then install plugins from it.

## Add the marketplace

The marketplace lives in the `simpleapps-com/augur-plugins` repo and is named `augur`. Plugins install as `<plugin>@augur`.

### claude.ai, Claude Desktop, and Cowork

Plugins need a paid plan: Pro, Max, Ultra, Team, or Enterprise.

1. Open **Customize > Plugins**. In Cowork, open the Cowork tab first.
2. Choose **Add**, then **Add marketplace**.
3. Enter `simpleapps-com/augur-plugins`.

Install plugins from the `augur` marketplace in the same place. The marketplace is added to your account for the organization you are in, and its plugins show in chat, Cowork, and Claude Code.

To get updates as they are published, turn on **Sync automatically** for the marketplace. Otherwise use **Check for updates**.

#### Team and Enterprise

- Each member adds the marketplace themselves. Organization sync only accepts private repos, and this one is public.
- A plugin's connector is not added when the plugin is installed. An Owner adds it for the organization in **Organization settings > Connectors > Add > Custom > Web**. Members then connect with their own account from **Customize > Connectors**. Until then the plugin shows its connector as "Not added"; its skills still load.
- If **Add marketplace** is missing, an admin has turned off member-added plugins.

### Claude Code

```
/plugin marketplace add simpleapps-com/augur-plugins
/plugin install <plugin>@augur
```

From a shell: `claude plugin marketplace add simpleapps-com/augur-plugins`.

#### Auto-update

Claude Code does not auto-update third-party marketplaces by default. To turn it on, run `/plugin`, open the **Marketplaces** tab, select `augur`, and enable auto-update. Auto-update runs in interactive sessions.

To update by hand: `claude plugin marketplace update augur`.

## Versioning

Each plugin has its own version in CalVer (`YYYY.M.seq`, no leading zeros), set only in that plugin's `.claude-plugin/plugin.json`. The marketplace file carries no versions. Users get a new release only when its version changes, so every release MUST bump it.

## Contributing

Needs Node 24 and pnpm. Run once per clone:

```
pnpm install
```

That installs the dev tools and the git hooks (lefthook). Before every commit and push, the hooks run `scripts/check-banned-strings.sh`: it reads a list of strings that MUST NOT be published from a file kept outside the repo, and blocks the commit or push on any match, or when the list is missing. Before every push they also run `pnpm quality` (format, lint, typecheck, unused-code check, tests, and `scripts/validate.ts`), which CI runs too.

## License

MIT. See [LICENSE](LICENSE).
