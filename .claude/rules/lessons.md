# Lessons

<!-- core:lessons -->
Self-learned behavioral rules earned from real failures in this project — always loaded, binding, not advisory. When the user corrects me or I catch my own mistake, I MUST record the lesson here before continuing, say in my reply what I wrote, and it ships in the commit of the work that earned it. Each lesson MUST be one bullet: one reusable RFC 2119 rule and its anchor from the incident (the date, the issue if any, the concrete thing, the user's words) — the anchor is the pattern-match that lets a future session recognize the same failure taking shape, and a rule stripped of its anchor is easy to rationalize past. MUST NOT put a client's name or id, a credential, a private host or a personal detail in a lesson, even inside the user's quoted words: use a placeholder. Before adding one, MUST check for a lesson or topical rule that already covers it: a repeat means its rule was not precise enough, so sharpen its wording in place, show the old and new text in my reply, and MUST NOT stack another incident on the end. A settled lesson promotes down the layers (this file → topical or context rule → skill or wiki), leaving its one-sentence rule and a pointer here.
<!-- /core:lessons -->

Load Skill("rules") and run `/rules lessons` to review, consolidate and promote lessons.

## Asking

- MUST NOT use the AskUserQuestion dialog (multiple-choice "survey" questions); ask in plain text as the last line of the reply, inside the TL;DR, with a recommendation, then stop. Anchor: 2026-11-23, shown the dialog, the user said "NEVER GIVE ME THESE SURVERY ASK ME QUETIONS".

## Folder boundary

- A skill's text MUST be read from the base directory the Skill tool names, or from the repo's plugin source, never from the plugin cache; promoted to `work-habits.md` and the `rules` catalogue. Anchor: 2026-11-25, `/wip 64` read the `wip` skill's files from the plugin cache; the user: "there MUST be a better way to use the skill data than to read outside the folder".

## Issues

- When an issue's build work is merged, the PR MUST close it (`Closes #N`); a live check that a user runs later, elsewhere, MUST NOT keep it open, and MUST be named in the report instead. Anchor: 2026-11-25, #64 (simpleapps-seo) was merged and released with `Refs #64`, left open for a Semrush sign-in test; the user: "that is not a good enough reason to leave it open, if you are complete close it".

## Porting

- When porting a skill, MUST keep every rule about how to write instructions for Claude, and mark a surface-specific one with its surface instead of dropping it; only content that fits nowhere MAY be cut, and the cut is named in the report. Anchor: 2026-11-25, the `writing-style` port dropped the `ultrathink` section as "Claude Code-specific"; the user: "keep ultrathink".

## Docs

- When judging whether a site or page belongs in the docs, MUST weigh what it does for a newcomer (an index, a directory, a discovery entry point), not only whether its facts appear elsewhere; a hub that leads to the other endpoints MUST be named, with each step of the path it lays out and what each file it names can do, read from the file itself, not from its one-line label. Anchor: 2026-11-26, augur-api.info was left out of the augur-build README as "covered by augur.build"; the user: "it is an importnat hub for finding the other putlic APIs".
- A plugin's README MUST NOT document limits or workarounds for tools the team does not use (tmux is one of them). Anchor: 2026-11-25, the simpleapps-worktrees README listed a `claude -w --tmux` limit; the user: "we don't use tmux".

## Reporting

- A `help` answer MUST fit on one screen: one line on what the skill does, one line per subcommand, and how to ask for more (settings, safeguards); MUST NOT list every setting, safeguard and surface; promoted to the shared Help block every skill ships, and wiki Skill-Authoring. Anchor: 2026-11-26, `/repo help` printed two tables, the repo's settings, the safeguards and a surface list; the user: "that help response was so incredibly long I do not think it was helpful".

- When asked what is left, MUST list only open work; MUST NOT mention items the user declined, dropped or retired. Anchor: 2026-11-25, a "what is left" report on the augur-skills migration WIP listed the unrotated OAuth secret and the retired files; the user: "don't mention the think that I have declien to move when I am asking what is left".
