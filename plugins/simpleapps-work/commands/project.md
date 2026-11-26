---
name: project
description: Explains and sets up a SimpleApps project folder, the one that holds `repo/` (the code repo), `wiki/`, `wip/`, `tmp/`, `clones/` and `.simpleapps/`, with the symlinks that let Claude Code run from it, and the per-user settings file and its permission defaults. A bare `/project` explains the layout and changes nothing; `/project init` checks the folder, fixes what is missing, and hands the rules and `CLAUDE.md` to `/rules write`. Use when setting up or checking a project folder, when asked where something belongs (scratch files, other repos, site settings), about `.simpleapps/`, `site.json`, `settings.local.json` or the permission defaults, or before asking the user for a site id or other site setting.
argument-hint: "[init | help]"
---

Use the `project` skill and run its `$ARGUMENTS` subcommand. With no argument, explain the layout and change nothing.
