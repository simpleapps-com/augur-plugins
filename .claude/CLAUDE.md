# augur-plugins

The `augur` Claude plugin marketplace (public repo). Plugins live in `plugins/<name>/`, listed in `.claude-plugin/marketplace.json`.

## Quick reference

- Setup, once per clone: `pnpm --dir repo install` (installs the dev tools and the lefthook git hooks)
- Quality: `pnpm --dir repo quality` (format, lint, typecheck, knip, tests at 100% coverage, `scripts/validate.ts`). Pre-push and CI run it
- Code MUST be TypeScript (LemmaScript proves only TypeScript): no Python, no new JavaScript. Scripts run as `node scripts/<name>.ts` (type stripping, no build). Exceptions: tool configs (`*.config.mjs`), `scripts/check-banned-strings.sh`, and the `cld` launcher (`plugins/augur-build/skills/launcher/scripts/cld`, a shell command users install)
- Proofs: `pnpm --dir repo proofs` MUST pass before submit (needs Dafny). Model first (`models/Marketplace.dfy`), then proved code (`scripts/rules.ts`), then the link (`models/links/`); no `assume`/`{:axiom}` in hand Dafny. See wiki Proofs
- Validate: `claude plugin validate repo --strict` (CI runs the same; any warning fails). Per plugin: `claude plugin validate repo/plugins/<name> --profile directory`. Mods also: `claude plugin test repo/plugins/<name>`
- `@simpleapps-com/augur-*` dev packages MUST be on their latest CalVer release (`pnpm --dir repo add -D @simpleapps-com/augur-config@latest`), never pinned to match augur-skills or any other repo
- Versions: each plugin's CalVer lives only in its `plugin.json`; MUST NOT set `version` in `marketplace.json`
- Banned strings: the lefthook hooks (`lefthook.yml`) run `scripts/check-banned-strings.sh` on pre-commit and pre-push, reading `{project}/.simpleapps/banned-strings.txt` (never committed). A missing or empty list blocks the commit
- MUST NOT commit anything private: this repo is public
- `{project}/clones/` holds read-only references to other repos, which their own projects maintain. MUST NOT edit, install into, branch, or run tools in them; `/quality` and every check cover `repo/` only

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
