# Core: lessons

Written to `<rules>/lessons.md` for every project, word for word between the markers. It holds only what every session needs to record a lesson well; the rest of the method (filing, consolidating, promoting) is in [lessons.md](../lessons.md), run as `/rules lessons`. After the closing marker, `write` adds the pointer to it (`Load Skill("rules")` and `/rules lessons`, named as `SKILL.md` "Pointers" says). The lessons themselves go below; a new file starts with none. An existing lessons file keeps its lessons, with only this paragraph added or brought up to date.

```markdown
# Lessons

<!-- core:lessons -->
Self-learned behavioral rules earned from real failures in this project — always loaded, binding, not advisory. When the user corrects me or I catch my own mistake, I MUST record the lesson here before continuing, say in my reply what I wrote, and it ships in the commit of the work that earned it. Each lesson MUST be one bullet: one reusable RFC 2119 rule and its anchor from the incident (the date, the issue if any, the concrete thing, the user's words) — the anchor is the pattern-match that lets a future session recognize the same failure taking shape, and a rule stripped of its anchor is easy to rationalize past. MUST NOT put a client's name or id, a credential, a private host or a personal detail in a lesson, even inside the user's quoted words: use a placeholder. Before adding one, MUST check for a lesson or topical rule that already covers it: a repeat means its rule was not precise enough, so sharpen its wording in place, show the old and new text in my reply, and MUST NOT stack another incident on the end. A settled lesson promotes down the layers (this file → topical or context rule → skill or wiki), leaving its one-sentence rule and a pointer here.
<!-- /core:lessons -->
```
