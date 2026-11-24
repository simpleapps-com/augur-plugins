# augur-php-lsp

**Claude Code only.** For developers working on the Augur monorepo. claude.ai chat and Cowork ignore LSP servers, so this plugin does nothing there.

The Intelephense PHP language server, tuned for Augur. Claude Code's own `php-lsp` plugin runs Intelephense with no settings, and it can't be configured. On the monorepo it indexes every `vendor/` copy (one per app and per package), so first indexing is slow, and "go to definition" and "find references" return vendor duplicates beside the real source. This plugin passes Intelephense the settings the monorepo needs:

- **Left out of the index:** every `vendor/`, `node_modules/`, `build/` and `runtime/` folder, the project's `clones/` and `worktrees/`, and version-control folders. Intelephense's own default exclude list is repeated, because a list replaces it.
- **Memory:** 4096 MB, enough for the whole monorepo.

The trade-off: with `vendor/` left out, third-party types (Spiral, Saloon, Cycle) aren't indexed. An exclude list can't keep one vendor folder and drop the rest, and the duplicates are what made lookups wrong.

## Install

Validated with Claude Code 2.1.331 (`claude plugin validate`). The live check below confirms the settings reach Intelephense.

1. Install Intelephense, once per machine:
   ```
   npm install -g intelephense
   ```
2. Install the plugin:
   ```
   /plugin install augur-php-lsp --marketplace simpleapps-com/augur-plugins
   ```
3. You MUST turn off the official PHP plugin, so two servers don't index the same repo:
   ```
   claude plugin disable php-lsp@claude-plugins-official
   ```
4. Run `/reload-plugins`, or start a new session.

**Licence (optional).** Without one, Intelephense runs its free features. To use your licence, put the key in `~/intelephense/licence.txt` (`license.txt` also works). Intelephense reads that file on its own, so the plugin holds no key and nothing secret is in this repo.

## Check it works

After the first indexing finishes, in the Augur project, ask Claude for the references of a method used across packages, for example `AmznSpHelper::patchFulfillmentQuantity`. The result should include its caller in `packages/markets/src/Helpers/AmznListingsItemsHelper.php`, and nothing under any `vendor/` folder. If vendor results still appear, the settings aren't reaching Intelephense: report it on the plugin's issue.

## Privacy

The language server runs on your computer and reads your project's files. The plugin itself sends nothing anywhere. What Intelephense does with a licence (for example, activating it with its maker) is between you and Intelephense; see its own terms. See https://www.simpleapps.com/privacy.
