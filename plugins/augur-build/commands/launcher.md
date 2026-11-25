---
name: launcher
description: Installs and keeps current `cld`, a small shell command that updates Claude Code and then starts it, passing every argument through (`cld -c` updates, then continues the last conversation). `/launcher write` puts it in the user's own bin folder on PATH, or updates it there; `/launcher audit` reports whether the installed copy matches this skill's (a report; changes nothing). Use when the user asks to install, set up, update or check `cld`, or how to start Claude Code with an update first.
argument-hint: "[write | audit]"
---

Use the `launcher` skill and run its `$ARGUMENTS` subcommand. With no argument, run `audit`.
