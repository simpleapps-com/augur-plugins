---
name: writing-style
description: Writes and edits text to one standard, for people and for agents. Directives carry RFC 2119 keywords (MUST, SHOULD, MAY) and are obeyed as written; one term per thing; nouns, not pointing words; concise text sized to its reader, answer first; no em-dashes; unordered lists sorted; full-word names in code. Use when writing or editing documentation, a README, skill, rule, CLAUDE.md, wiki page, spec, PRD, issue, acceptance criteria, pull request, commit message, code comment, a message to a team or a post a client reads, or when asked to tighten, review or rewrite text.
license: MIT
---

# Writing style

One standard for everything written: code comments, docs, specs, PRDs, wiki pages, skills, rules, issues, commit messages and posts to a team or a client.

Keywords MUST, SHOULD, MAY per RFC 2119.

## Where it runs

Text only, so it works the same in chat, Claude Desktop, Cowork and Claude Code: on text Claude writes, and on text pasted in or read from a file.

## Directives use RFC 2119 keywords

A sentence that tells a reader or an agent what to do is a directive. Every directive MUST carry an RFC 2119 keyword in capitals: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY. Agents weight a capitalised keyword reliably; soft wording ("make sure", "try to", "avoid") is silently downgraded or ignored, so it MUST be rewritten.

- Choose by consequence: the system breaks without it, MUST; it degrades, SHOULD; no effect, MAY.
- Lowercase "should" or "must" is for description only: "the build should finish in a minute" observes; "the build SHOULD finish in a minute" requires.
- Prohibitions, approval gates and safety conditions MUST come before the steps they govern, and an approval gate MUST NOT sit in a closing paragraph. A MUST NOT after the procedure is read too late; aerospace manuals put warnings before the step for the same reason.

**Reading them.** Keywords bind the reader; they are not suggestions to weigh against convenience.

- A MUST or MUST NOT MUST NOT be downgraded to a SHOULD because the work is slow, because the codebase or an earlier example in the session does otherwise, or because it looks unnecessary. A MUST that seems wrong or impossible: stop and ask the user; MUST NOT carry on with a weaker version.
- Code or an example in the session that breaks a MUST is wrong, not a permission: flag it; MUST NOT copy it.
- A SHOULD or SHOULD NOT is the default; deviating needs a stated reason from the facts at hand, never convenience or time pressure. "It would take too long" is never a reason.
- A MAY is the reader's choice.

The keyword table (with SHALL, REQUIRED and the rest), the soft-wording rewrite table, the check before saving, emphasis markers, `ultrathink`, and a worked example of a downgraded MUST: [references/directives.md](references/directives.md).

## One term, one meaning

RFC 2119 is controlled language for one word class: it fixes what the modal verbs mean, so they cannot be read two ways. ASD-STE100 (Simplified Technical English, the aerospace maintenance standard) applies the same idea to a whole document: **one word, one meaning, one part of speech**. Its approved dictionary is aerospace vocabulary and MUST NOT be adopted; two of its rules apply here.

- MUST use one word for one thing across a document set, and MUST NOT vary it for style: repetition is correct, and elegant variation is a defect. A synonym reads to an agent as a second thing, and it hunts for a difference that does not exist. Where a project has defined terms (a rule, a skill, a command), MUST use exactly those, never a substitute ("guardrail", "convention", "standard").
- SHOULD define a term once, where the reader first meets it, then reuse it word for word.
- MUST NOT open a sentence with "This" or "It" pointing back at the whole sentence before. Repeat the noun:
  - ❌ "The validator compares same-named files only. This means repo-only rules are safe."
  - ✅ "The validator compares same-named files only. The same-name comparison means repo-only rules are safe."
  - "This", "it" and "that" pointing at a whole clause are the commonest ambiguity in technical prose, and the one agents most often resolve wrongly. Repeating a noun costs a few tokens; the wrong referent costs a wrong edit.

## Short, answer first

Brevity is effort moved from every reader to the author, once. Every token costs the reader time, money and attention. SHOULD default to brief, and expand only where the reader cannot infer the meaning.

- SHOULD put the bottom line up front: the answer first, then context.
- SHOULD start with an action verb (fix, add, update, remove); name files as `path:line`; name the specific thing ("Redis cache", not "caching solution").
- SHOULD cut filler: actually, basically, in order to, it's worth noting.

| Reader | Write |
|--------|-------|
| A client or other non-technical reader | Plain words, no jargon; the effect, not the implementation. Clarity over brevity |
| Developers and agents (issues, PRs, wikis) | Technical and concise, with file references, reproduction steps and acceptance criteria |
| Code comments and commits | Minimal: the reader has the code. Comment only logic the code does not make plain |

- **Expand** for a reader with no context (onboarding, error messages, external docs a reader can't ask about, user stories) and for architecture decisions a future developer needs the "why" of.
- **Cut** where the reader shares the context (internal specs, tasks, code comments), where scanning speed matters (commit messages, PR titles), and whatever repeats the code.
- **By format:** PRDs are bullets, not paragraphs; specs lead with their requirements (MUST, SHOULD, MAY); a task is a verb and its target; a review says what changed, not why.

Two sentences that answer the question beat two pages that fill the context window.

## Punctuation and lists

- SHOULD NOT use the em-dash (`—`): it reads as machine-written. Use a period, comma, colon or parentheses instead. MAY keep one in a quotation that has it, and in a rare aside where commas are ambiguous and parentheses too formal. Replacements, examples and the exceptions: [references/punctuation.md](references/punctuation.md).
- A list with no inherent order MUST be sorted alphabetically: bullet lists, JSON and config arrays, deny rules, feature lists, table rows, any unordered collection. Items are easy to find, and a new one lands in a predictable place with a small diff.

## Names in code

The person reviewing the code MUST be able to read it without deciphering names.

- MUST use full words: `cartItem`, not `ci`; `filePath`, not `p`; `response`, not `r`. A short name also collides with the conversation's terms: `p` for a path, in a discussion of a payment path, gets read as "payment".
- MUST NOT use single-letter names, except loop counters (`i`, `j`, `k`). Well-known abbreviations (`id`, `url`, `db`) MAY be used.
- A function name SHOULD say what it does: `calculateShippingCost`, not `calcShip`.

## Naming a source

A canonical phrase with its author and work calls up a whole body of thought in a few words: cheap tokens, richer reasoning. "Improving daily work" alone calls up generic improvement; "Gene Kim's *The Phoenix Project*, the DevOps Second Way" calls up feedback loops, toil reduction, blameless post-mortems and value streams. It fits where that body of thought shapes the work (Goldratt's errors of commission and omission for a sanity check; RFC 2119 here), with the phrase, the work and its key terms together.

Naming a source goes wrong three ways: a name with no vocabulary calls up almost nothing; a source that does not shape the work pulls in the wrong ideas; one source on every skill becomes decoration and stops working.

Naming a source is a technique, not a rule. Most skills SHOULD NOT name an outside discipline at all; keep it rare and deliberate, for a skill whose guidance comes from a named body of thought, where the agent will reason better for being told which.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
