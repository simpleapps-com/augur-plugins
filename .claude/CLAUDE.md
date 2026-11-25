# augur-plugins

The `augur` Claude plugin marketplace (public repo). Plugins live in `plugins/<name>/`, listed in `.claude-plugin/marketplace.json`. This repo's musts are in `.claude/rules/project.md`.

## Quick reference

- Setup, once per clone: `pnpm --dir repo install` (installs the dev tools and the lefthook git hooks)
- Quality: `pnpm --dir repo quality` (format, lint, typecheck, knip, tests at 100% coverage, `scripts/validate.ts`). Pre-push and CI run it
- Proofs: `pnpm --dir repo proofs` (needs Dafny); the model alone: `pnpm --dir repo proofs:model`
- Validate: `pnpm --dir repo run plugin:validate` (`claude plugin validate . --strict`; CI runs the same, and any warning fails). Per plugin: `claude plugin validate repo/plugins/<name> --profile directory`. Mods also: `claude plugin test repo/plugins/<name>`
- Scripts run as `node scripts/<name>.ts` (type stripping, no build)
- Versions: each plugin's CalVer is in its own `plugin.json`
- Banned strings: `scripts/check-banned-strings.sh`, run by the lefthook hooks (`lefthook.yml`) on pre-commit and pre-push, reads `{project}/.simpleapps/banned-strings.txt` (never committed)

See the wiki for full dev docs:

- [Home](../../wiki/Home.md): what the marketplace is, the plugins, principles
- [Plugin-Format](../../wiki/Plugin-Format.md): marketplace.json vs plugin.json fields, versioning, directory requirements
- [Skill-Authoring](../../wiki/Skill-Authoring.md): writing skills with progressive disclosure, chat-safe rules, links to Anthropic's docs
- [Proofs](../../wiki/Proofs.md): LemmaScript + Dafny, the model, links, running the proofs
- [Mods](../../wiki/Mods.md): Claude Code-only plugins that run code, security, layout, API, testing
- [Work-Pane](../../wiki/Work-Pane.md): the Work pane mod and its scripts: where it runs, work/, references, check and Sync
- [Platform-Support](../../wiki/Platform-Support.md): what each surface loads, adding the marketplace, connectors, updates
- [Development](../../wiki/Development.md): layout, setup, banned-strings check, validation, adding a plugin
- [Testing](../../wiki/Testing.md): automated checks and the per-surface checklist
- [Deployment](../../wiki/Deployment.md): Submit and Publish steps
