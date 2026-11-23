# Augur Build

For developers, including third parties, building on Augur. Augur Build will carry the conventions and workflows for working on Augur projects with Claude, in claude.ai, Claude Desktop, Cowork, and Claude Code.

**Early release.** More skills will move in from the older Claude Code-only plugin over coming releases. It needs no connector and no sign-in.

## Skills

| Skill | Use it for |
|-------|------------|
| `lemma-driven-design` | A coding design pattern like test-driven design, with proofs: the model and its lemma first, the proof red, the code, the proof green, then tests. For TypeScript it uses LemmaScript and Dafny. Running a prover needs a terminal (Claude Code); in chat it helps plan and review models, specs and code |

## Install

**claude.ai, Claude Desktop, and Cowork** (Pro, Max, Ultra, Team, or Enterprise plan):

1. Add the `augur` marketplace: **Customize > Plugins > Add > Add marketplace**, then enter `simpleapps-com/augur-plugins`.
2. Install **Augur Build** from it.

**Claude Code:**

```
/plugin install augur-build --marketplace simpleapps-com/augur-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install augur-build@augur`.
