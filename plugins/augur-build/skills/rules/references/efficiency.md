# Efficiency: what always-loaded text costs

Always-loaded content (`CLAUDE.md`, and rules without `paths`) is paid on every prompt, even when it is irrelevant. Every token spent there is taken from working context, so it is written as pointers, not content.

## Contents

- [The loading hierarchy](#the-loading-hierarchy)
- [Limits](#limits)
- [Which layer](#which-layer)
- [The pointer pattern](#the-pointer-pattern)
- [Evergreen wording](#evergreen-wording)
- [A rule's shape](#a-rules-shape)
- [Skill frontmatter that changes the cost](#skill-frontmatter-that-changes-the-cost)
- [Navigator tables](#navigator-tables)

## The loading hierarchy

| Layer | Loaded | What belongs there |
|-------|--------|--------------------|
| `CLAUDE.md` | Every prompt | Orient and link. Under 200 lines |
| Rules without `paths` | Every prompt | Short guardrails, one topic per file, each pointing to a skill or page for detail |
| Rules with `paths` frontmatter | When a matching file is read or edited | Guidance that only matters for some files |
| Skill descriptions | Every prompt | One description per skill; all skills share one listing budget |
| A skill's `SKILL.md` | When invoked | Full behavioural detail; stays in context for the rest of the session |
| A skill's references | When read | Conditional detail |
| Wiki | When read | Complete project knowledge, on its own budget (20K tokens by default) |
| Auto memory | The first 200 lines or 25KB of `MEMORY.md` every session; its topic files when read | Nothing: the `no-memory` core keeps everything in versioned files |

## Limits

From Claude Code's docs; re-check them when Claude Code changes ([skills](https://code.claude.com/docs/en/skills.md), [memory](https://code.claude.com/docs/en/memory.md)).

- **`CLAUDE.md`:** under 200 lines. A bloated file makes Claude ignore the instructions that matter.
- **Skill listing:** every skill's description shares a budget of about 1% of the model's context window. Names are always listed; descriptions are what get trimmed. When the listing overflows, the least-used skills lose their descriptions first, so a rarely used skill is the first to lose the words that would trigger it. Users can raise the budget (`skillListingBudgetFraction`, or `SLASH_COMMAND_TOOL_CHAR_BUDGET` for a fixed count).
- **One description:** capped at 1,536 characters in Claude Code, `description` and `when_to_use` together (`skillListingMaxDescChars`). A plugin skill that must also work in claude.ai chat is limited to 1,024 characters. Put the trigger words first: truncation cuts the end.
- **`SKILL.md`:** under 500 lines; move detail to referenced files.
- **Overhead:** the system prompt, tool definitions and the autocompact buffer take a share of the window before the first prompt; MCP servers add to it. Claude Code's `/context` shows the current split.

Estimate tokens as words × 1.3 (about 0.75 words per token), or characters ÷ 4 for counts kept in characters (skill descriptions).

## Which layer

| Question | Layer |
|----------|-------|
| Does the agent need it on every prompt? | `CLAUDE.md` or a rule |
| Is it a critical guardrail? | A rule, pointing to a skill for the detail |
| Does it matter only for some files? | A rule with `paths` |
| Is it detailed behaviour? | A skill |
| Is it project knowledge? | The wiki |
| Is it a correction or a mistake caught? | The `lessons` rule |
| Is it something to remember? | Never memory: a rule, the wiki or `CLAUDE.md` (the `no-memory` core) |

## The pointer pattern

A rule states the must and points to where the detail lives:

```markdown
# Git Safety
MUST NOT commit without the user's approval.
Load Skill("repo") for the full guardrails.
```

That rule costs about 40 tokens a prompt; the skill costs nothing until it is used. Point only at a skill that is installed, or a page that exists; a dead pointer costs tokens and loads nothing.

**Wiki links are the best pointer.** A link in `CLAUDE.md` such as `[Deployment](../../wiki/Deployment.md)` costs about 15 tokens and gives the agent a whole page on demand. `CLAUDE.md` SHOULD link every wiki content page: it is the agent's table of contents, and a missing link means the agent guesses or asks.

## Evergreen wording

Always-loaded text MUST be true whenever it is read. It MUST NOT carry:

- **Counts or lists that change:** "12 skills" is wrong at the next commit; say how to list them (`ls plugins/*/skills/`).
- **Version numbers:** point to the file that holds the version.
- **Process data:** dates, recent activity, who did what; that is git history.
- **Paths that differ per machine.**
- **What the code already says:** describe the pattern, give one or two examples, and link the source.

A dated owner decision ("owner, 2026-11-22") is the exception: it records why a rule exists, not the current state.

## A rule's shape

- One file per concern, named for it (`git-safety.md`).
- The must first, in RFC 2119 words, then at most a short why.
- The detail in a skill or the wiki, named by the rule.
- A rule never restates a skill, a wiki page or another rule; if two say the same thing, keep one and point.
- Project facts (paths, scripts, tools) come from the project, never from this skill's examples.
- Most rules fit in under 150 words; a written rule over 300 words is a skill or a wiki page in the wrong place. The fixed cores are exempt: their length is the cost of not rewording them. So is the lessons file, which grows by design: each lesson is paid for by a failure it stops from coming back.

## Skill frontmatter that changes the cost

These are Claude Code fields, useful in a project's own `.claude/skills/`. Four change what a skill costs:

| Field | Effect |
|-------|--------|
| `disable-model-invocation: true` | Removes the description from the listing; the skill still runs as `/name`. The best saving for a command-shaped skill Claude should never pick itself |
| `user-invocable: false` | Hides the skill from the `/` menu but keeps its description in the listing: no saving; for reference skills other skills load |
| `paths` | Limits auto-activation to matching files |
| `context: fork` | Runs the skill in a subagent; only the result enters the main context |

A plugin skill that must also work in claude.ai chat MUST NOT use them: chat rejects any frontmatter key outside `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`.

## Navigator tables

A lean `SKILL.md` keeps the description, the always-true rules, and a navigator to its references. Each navigator row MUST say WHEN to load the file and WHY (what skipping it costs), not only the topic:

| When you're… | Load | Why |
|--------------|------|-----|
| adding a login or session flow | `auth.md` | the token-refresh edge cases are there; skipping it ships the 401 retry loop |

A bare "Topic | File" table names the files without telling the agent whether it is in the situation that needs one, so it loads nothing (and misses the detail) or everything. A lean `SKILL.md` also keeps a forced load cheap, where a hook makes the agent load a skill whenever it touches a matching file.
