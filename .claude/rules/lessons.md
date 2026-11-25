# Lessons

<!-- core:lessons -->
Self-learned behavioral rules earned from real failures in this project — always loaded, binding, not advisory. When the user corrects me or I catch my own mistake, I MUST record the lesson here before continuing, say in my reply what I wrote, and it ships in the commit of the work that earned it. Each lesson MUST be one bullet: one reusable RFC 2119 rule and its anchor from the incident (the date, the issue if any, the concrete thing, the user's words) — the anchor is the pattern-match that lets a future session recognize the same failure taking shape, and a rule stripped of its anchor is easy to rationalize past. MUST NOT put a client's name or id, a credential, a private host or a personal detail in a lesson, even inside the user's quoted words: use a placeholder. Before adding one, MUST check for a lesson or topical rule that already covers it: a repeat means its rule was not precise enough, so sharpen its wording in place, show the old and new text in my reply, and MUST NOT stack another incident on the end. A settled lesson promotes down the layers (this file → topical or context rule → skill or wiki), leaving its one-sentence rule and a pointer here.
<!-- /core:lessons -->

Load Skill("rules") and run `/rules lessons` to review, consolidate and promote lessons.

## Asking

- MUST NOT use the AskUserQuestion dialog (multiple-choice "survey" questions); ask in plain text as the last line of the reply, inside the TL;DR, with a recommendation, then stop. Anchor: 2026-11-23, shown the dialog, the user said "NEVER GIVE ME THESE SURVERY ASK ME QUETIONS".

## Reporting

- When asked what is left, MUST list only open work; MUST NOT mention items the user declined, dropped or retired. Anchor: 2026-11-25, a "what is left" report on the augur-skills migration WIP listed the unrotated OAuth secret and the retired files; the user: "don't mention the think that I have declien to move when I am asking what is left".
