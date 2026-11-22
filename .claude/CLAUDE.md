# augur-plugins

The `augur` Claude plugin marketplace (public repo). Plugins live in `plugins/<name>/`, listed in `.claude-plugin/marketplace.json`.

## Quick reference

- Validate: `claude plugin validate repo` (CI runs the same, without `--strict` until the first plugin lands)
- Versions: each plugin's CalVer lives only in its `plugin.json`; MUST NOT set `version` in `marketplace.json`
- Banned strings: MUST run `git -C repo config core.hooksPath .githooks` once per clone. The hooks run `scripts/check-banned-strings.sh` on pre-commit and pre-push, reading `{project}/.simpleapps/banned-strings.txt` (never committed). A missing or empty list blocks the commit
- MUST NOT commit anything private: this repo is public

See the wiki for full dev docs:

- [Home](../../wiki/Home.md): what the marketplace is, the plugins, principles
- [Plugin-Format](../../wiki/Plugin-Format.md): marketplace.json vs plugin.json fields, versioning, directory requirements
- [Platform-Support](../../wiki/Platform-Support.md): what each surface loads, adding the marketplace, connectors, updates
- [Development](../../wiki/Development.md): layout, setup, banned-strings check, validation, adding a plugin
- [Testing](../../wiki/Testing.md): automated checks and the per-surface checklist
- [Deployment](../../wiki/Deployment.md): Submit and Publish steps
