---
paths:
  - "**/plugins/*/skills/**"
  - "**/plugins/*/commands/**"
  - "**/plugins/*/.claude-plugin/plugin.json"
---

# Skills and Commands

- Skill frontmatter MUST use only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`. Any other key is a hard error on claude.ai, and `claude plugin validate` does not catch it ([Skill-Authoring](../../../wiki/Skill-Authoring.md#rules-for-augur-plugins)).
- A skill does the work; a command only adds the typed hint: `commands/<skill>.md` with `argument-hint`, the skill's `description` word for word, and a body that hands `$ARGUMENTS` to the skill ([Skill-Authoring](../../../wiki/Skill-Authoring.md#subcommands-and-argument-hints)).
- A fact or piece of advice in a skill or README that comes from outside this repo (a vendor's API, a threshold, a standard, a ranking claim) MUST link the page that states it, worded no stronger than that page; what was only seen in use, or measured by the team, MUST say so ("seen in use", "measured", "the team's practice"). The owner, 2026-11-25: "make sure all advice and facts in the SEO and build are backed up with links".
- `plugin.json` `commands` MUST be a path or a list, never an object: claude.ai rejects the object form ([Platform-Support](../../../wiki/Platform-Support.md#what-each-surface-loads)).
- Outside a Claude Code-only plugin, MUST NOT add a top-level `bin/`, or depend on hooks, agents or local MCP servers for core behaviour: chat refuses or ignores them ([Platform-Support](../../../wiki/Platform-Support.md#what-each-surface-loads)).
