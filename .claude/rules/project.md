# Project

This repo's own musts. Each links the wiki section that explains it.

- MUST NOT commit anything private: this repo is public. The banned-strings check runs on every commit and push, and a missing or empty list blocks the commit ([Development](../../../wiki/Development.md#banned-strings-check)).
- Code MUST be TypeScript: no Python, no new JavaScript. Exceptions: tool configs (`*.config.mjs`), `scripts/check-banned-strings.sh`, and the `cld` launcher (`plugins/augur-build/skills/launcher/scripts/cld`) ([Proofs](../../../wiki/Proofs.md#rules)).
- `@simpleapps-com/augur-*` dev packages MUST be on their latest release, never pinned to match another repo ([Development](../../../wiki/Development.md#quality)).
- A plugin's version lives only in its `plugin.json`; MUST NOT set `version` in `marketplace.json` ([Plugin-Format](../../../wiki/Plugin-Format.md#versioning)).
- `clones/` holds read-only references to other repos, maintained by their own projects: MUST NOT edit, install into, branch, or run tools in them. Every check covers `repo/` only.
