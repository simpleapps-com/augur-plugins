---
name: wiki
description: Loads, syncs, audits and curates a project's markdown wiki, a git-backed wiki folder such as a clone of the repo's GitHub wiki, and records knowledge in it. One skill with four actions (`/wiki`, `/wiki load`, `/wiki sync`, `/wiki audit`, `/wiki curate`); a project's own wiki can replace an action's steps and change its settings, within fixed safeguards. Use when the user asks to read, load, sync, push, check, audit, improve or curate the wiki, or to save or document knowledge, decisions or conventions.
argument-hint: "[load | sync | audit | curate] [...]"
---

Use the `wiki` skill and run its `$ARGUMENTS` subcommand. With no argument, run `load`.
