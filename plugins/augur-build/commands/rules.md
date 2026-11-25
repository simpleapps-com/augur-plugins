---
name: rules
description: Writes and audits a project's always-loaded instructions for Claude, its rules (`.claude/rules/*.md`) and `CLAUDE.md`, from the project's own wiki, layout and tools, so they fit the project and cost as little context as possible. Also keeps the project's lessons, the rules the agent learns from its own mistakes: how to record one, and reviewing, consolidating and promoting them into topical or file-scoped rules. Also files a new rule, or a change to one, upstream as an issue so every project gets it. One skill with four subcommands (`/rules write`, `/rules audit`, `/rules lessons`, `/rules file`); safety rules come from fixed text that is never reworded. Use when the user asks to write, add, set up, update, check, trim or audit a project's rules or CLAUDE.md, asks what is using the context window, when recording, reviewing or consolidating a lesson, or when a rule should be shared with every project.
argument-hint: "[write | audit | file | lessons | help] [...]"
---

Use the `rules` skill and run its `$ARGUMENTS` subcommand. With no argument, run `audit`.
