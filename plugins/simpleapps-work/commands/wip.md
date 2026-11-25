---
name: wip
description: Tracks a piece of work from a GitHub issue or Basecamp item through to shipped, in a local WIP file. `/wip` with an issue or Basecamp link creates the WIP (source, criteria, attachments) and investigates it, or refreshes an existing one; `/wip triage` shows the repo's issues, PRs and WIPs; `/wip investigate` researches; `/wip implement` does the work against the acceptance criteria; `/wip process` marks shipped work and retires old WIPs. Use when the user gives an issue or Basecamp link to work on, asks what is open or to triage, asks to investigate or implement a WIP, or asks to tidy the WIPs.
argument-hint: "[triage | investigate | implement | process | #N | link | help] [...]"
---

Use the `wip` skill with `$ARGUMENTS`: a subcommand, or an issue or Basecamp link. With no argument, do what the skill says for a bare call.
