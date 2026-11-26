---
name: code-docs
description: Answers questions about Claude Code (the CLI and its plugins) from Claude Code's own published documentation at code.claude.com, not from memory; it does not check a project's code (that is the `code` skill). Starts from the docs index (`llms.txt`), fetches the page that covers the question, asks it a specific question, and checks a version requirement against the installed build. Use when looking up a Claude Code feature, setting, settings key, frontmatter field, tool, plugin, skill, hook or permission rule, or when troubleshooting Claude Code.
license: MIT
---

# Claude Code docs

Keywords MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Surface | What happens |
|---------|--------------|
| Chat, Claude Desktop, Cowork | Fetches the docs when a web fetch tool is on; otherwise names the page for the user to open. No version check: there is no shell |
| Claude Code | Fetches with WebFetch, and checks the installed version with `claude --version` |

## Entry point

The docs index is <https://code.claude.com/docs/llms.txt>: every page, one line each, linked as `https://code.claude.com/docs/en/<page>.md`. The full-text dump (`llms-full.txt`) is not an entry point: it is over 10 MB, too large to fetch (seen in use).

MUST fetch the index first, find the page that covers the question, then fetch that page. MUST NOT rely on a remembered page URL: pages are renamed and moved, and the index is current.

## Answer from the docs, not from memory

Claude Code releases often (each release is in the [changelog](https://code.claude.com/docs/en/changelog.md)). Settings keys, frontmatter fields, tool names and defaults move, and training data lags the product, so a recalled detail is stale by default.

MUST fetch the page before asserting that a feature, setting or field exists, even when the answer feels certain. A confidently wrong settings key costs the user a debugging session.

## Check the version

Pages gate some features on a version ([skills](https://code.claude.com/docs/en/skills.md), for example: "This requires Claude Code v2.1.286 or later."). When a page gates the answer, check the installed build (Claude Code only):

```bash
claude --version
```

When the installed build predates the requirement, MUST report the gap, not the feature.

## Fetching is cheap, being wrong is not

A large page fills the context. Two habits keep the cost down:

- SHOULD ask the fetch a specific question ("list every SKILL.md frontmatter field and its exact name"), not "summarize this page": the answer comes back scoped.
- When a fetch saves a large page to a file (Claude Code), SHOULD search the file for the keys needed (`grep -n`) rather than read it whole.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
