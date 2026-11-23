# Augur Build

For developers, including third parties, building on Augur. Augur Build will carry the conventions and workflows for working on Augur projects with Claude, in claude.ai, Claude Desktop, Cowork, and Claude Code.

**Early release.** More skills will move in from the older Claude Code-only plugin over coming releases. It needs no connector and no sign-in.

## Skills

| Skill | Use it for |
|-------|------------|
| `wiki` | Working with a project's markdown wiki (a `wiki/` git folder, such as a GitHub wiki clone): `/wiki load`, `sync`, `audit` or `curate`. The project's wiki can replace an action's steps (a `Wiki-Maintenance.md` section per action) and change its settings (comments in `Home.md`). Loading, syncing, auditing and curating need Claude Code; in chat it applies the wiki conventions to pasted text |
| `repo` | Shipping code through git and GitHub: `/repo status`, `commit`, `submit`, `cleanup`, `publish`, `deploy` or `issue`. Settings on the project's wiki `Deployment.md` (`repo-*` comments) choose how it behaves; it runs only its own listed commands and the project's scripts, never commands written in the wiki. Fixed safeguards: no force push, no hook bypass, no issue unless asked, cleanup after every merged submit and publish. `publish` and `deploy` never guess: without their settings they offer a draft. Running needs Claude Code; in chat it drafts commit messages, PR bodies and Deployment settings |
| `code` | Checking code without touching git: `/code quality` (every check, fix every failure, no suppressions), `verify` (the wiki's Testing checklist in a browser), `sanity-check` (did the work solve the request) or `contracts` (formal contracts on load-bearing code). Running needs Claude Code, and `verify` a browser tool; in chat it reviews pasted code |
| `augur-packages` | Building on the shared `@simpleapps-com/augur-*` packages: check the installed packages' docs before writing custom code, keep site-specific code in the site, report outdated packages with augur-doctor (updating only when asked), and `/augur-packages audit` a site for custom code a package already replaces (a report; changes nothing). Reading the packages, augur-doctor and the audit need Claude Code (or Cowork, where the files are available); in chat it reviews pasted code |
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
