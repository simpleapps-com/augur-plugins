# `/rules lessons`

## Does

Keeps a project's lessons sharp and cheap. The always-loaded `lessons` core ([core/lessons.md](core/lessons.md)) makes the agent record each lesson the moment it is earned; this subcommand holds the rest of the method: how a lesson is written and filed, and how lessons are reviewed, consolidated and promoted down the layers so the always-loaded file stays small. Run as `/rules lessons` to review the project's lessons; load it while recording one to file it well.

## Reads

`<rules>/lessons.md`, every other file in `<rules>` (topical and `paths` rules a lesson may belong in), `<claude-md>`, and the wiki's page list.

## Writing a lesson

The core already says what a lesson is; this is the detail it leaves out.

- **The rule** is general enough to catch the next case, not a retelling of this one.
- **The anchor:** `Anchor (<YYYY-MM-DD>[, <issue or PR>]): <what was done>; the user: "<their words>"`. The date comes from the machine's `date`. The user's words, quoted exactly except that a private value becomes a placeholder, are what make the failure recognisable; the concrete thing (a function, a file, a measured number) is what makes it findable.
- **A repeat** keeps only the one or two most telling anchors: more examples narrow what the rule is read to cover.
- **File it** under the `##` heading that fits (for example Decisions, Git, Verification, Reading the user, Scope); start a heading, named for the topic, when none does.
- **Private values** include customer values too. Where the project has a banned-strings list, check the file as `SKILL.md` "Nothing private" says.
- **Not a lesson:** a one-off preference for the task in hand, or a fact about the project; those go to the wiki or `CLAUDE.md`.

## Steps (`/rules lessons`)

0. **No lessons:** no `<rules>/lessons.md`, or no lessons below its core: say so, offer `/rules write lessons` if the file is missing, and stop.
1. **Cost.** Words and estimated tokens of `lessons.md`, and how many lessons each heading holds.
2. **Review** every lesson:

   | Finding | Proposal |
   |---------|----------|
   | **Repeated** | Two lessons for one failure, or one lesson with more than two anchors: one lesson, sharper wording, the one or two most telling anchors |
   | **Several rules in one** | A bullet per rule, each with its own anchor |
   | **No anchor, or no rule** | The missing part, from the incident if it can be found; a story with no `MUST`/`SHOULD` becomes a rule, or is left for the user to decide |
   | **Not a lesson** | Its place in the wiki or `CLAUDE.md` |
   | **Misfiled** | The heading it belongs under |
   | **Private** | A placeholder in place of the value; name the lesson, never repeat the value. If the file is committed, say the value stays in git history |
   | **Settled** | Promotion, below |
   | **General** | A lesson with nothing project-specific in it, or one that keeps recurring against a core's wording: offer it upstream as a new rule or a change (`SKILL.md` "Sending a rule upstream"); the lesson stays here meanwhile |

3. **Promote** what has settled: lessons whose latest anchor is old and that this review does not change, especially several on one topic (a judgement from the anchor dates; say so). Each goes one layer down, the whole bullet with its anchor, leaving in `lessons.md` its one-sentence rule and a pointer:
   - **A topical rule** (`<rules>/<topic>.md`) for lessons that hold every prompt. The lessons rule itself stays untouched, and rules grouped by topic are easier for a person to review.
   - **A context rule**, a topical rule with `paths` frontmatter, for lessons about particular files or areas. It loads only when a matching file is read or edited, so it costs nothing elsewhere:

     ```markdown
     ---
     paths:
       - "src/proofs/**"
     ---
     # Proofs
     ```

   - **A skill or wiki page** for detail that only matters when the work comes up; the rule keeps the must and names it. Those are outside `<rules>`, so `lessons` drafts the text and names the place; the lesson stays whole in `lessons.md` until the user confirms it landed.

   Behavioural lessons that are not about any files (how to answer, when to stop, when to ask) cannot take `paths`: they stay in `lessons.md` or a topical rule.
4. **Propose.** Show each change as the lesson's current text and its replacement, the new or changed rule files, and the always-loaded total before and after. A consolidation never drops a rule: its wording may change, its meaning may not narrow. Then wait for a yes.
5. **Write** exactly what was approved, then re-read it: every pointer resolves, the core paragraph is unchanged, and every bullet present before the run is in the report with where it now is.

## Safeguards

`SKILL.md`'s safeguards apply: the review writes only after a yes (recording one lesson under the core is the one exception), no git, nothing private. A lesson is never deleted outright; it is merged, moved or promoted, and the report says where each one went.

## Report

What was consolidated, moved and promoted (each lesson by its first words, and where it went), the always-loaded total before and after, and any lesson left for the user to decide.
