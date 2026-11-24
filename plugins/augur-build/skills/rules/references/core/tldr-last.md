# Core: tldr-last (optional)

A preference: `write` asks before adding it. Written to `<rules>/tldr-last.md`, word for word between the markers. The always-on must about blocking questions is in `work-habits` ([catalogue](../catalogue.md#work-habits)), so a project without this rule keeps it; this rule only places the questions.

```markdown
# TL;DR Last

<!-- core:tldr-last -->
End every substantive reply with a **TL;DR**, the final block, after the detail; nothing follows it.

- 2-4 lines: enough to act on, or to know what to scroll up for.
- What changed and what is still open: the facts the user acts on, not a changelog.
- Standalone: no "as described above"; name paths (`src/foo.ts:42`), not vague nouns.
- Say plainly what failed, was skipped or is unverified. Wins-only is a lie by omission.
- A suggestion to verify the work goes inside it, not after it.

When it runs long, cut detail and name the section that holds it; do not compress into denser prose. MAY be omitted when the whole reply is already 3 lines or fewer. MUST NOT be omitted after multi-step work, multi-file edits, or a reply long enough to scroll.

Questions that block the turn close the TL;DR, in full, numbered when more than one; they do not count toward its lines.
<!-- /core:tldr-last -->
```
