# `/rules audit`

## Does

Reports what the project's always-loaded instructions cost, and every problem in them, with a fix for each. Read-only: it changes no file. A fix runs only when the user asks for it (it is then a `/rules write` of the files named).

## Reads

The same as [write.md](write.md#reads), plus, for the budget, the wiki's word count and the skills loaded this session.

## Steps

### 1. Cost

Count words per file and estimate tokens (words × 1.3).

| Source | How |
|--------|-----|
| `<claude-md>` | Lines and words of each file (both `CLAUDE.md` locations, `CLAUDE.local.md`, and every `@path` import, counted with the file that imports it). Limit: 200 lines each. The user's own `~/.claude/CLAUDE.md` and `~/.claude/rules/` also load: count them, listed apart as "user", and say so if they cannot be read |
| Rules without `paths` | Every file in `<rules>` whose frontmatter has no `paths`: these load every prompt |
| Rules with `paths` | Listed separately: they load only for matching files |
| Skill descriptions | Characters of every installed skill's `description` (the session's skill list; tokens as characters ÷ 4). Claude Code cuts each skill's `description` plus `when_to_use` at 1,536 characters, so each MUST fit under that, and the project's own plugin skills that must work in chat under 1,024; all share about 1% of the context window |
| Skills loaded this session | Words of each `SKILL.md` invoked so far: they stay in context for the session |
| Wiki | Words across its pages, against its budget (20K tokens by default, or the budget its `Home.md` sets) |

Flag: `CLAUDE.md` over 200 lines or over about 5% of the context window; a written rule over 300 words (the fixed cores and the lessons file are exempt; report the lessons file's cost on its own line); skill descriptions that would overflow the listing (Claude Code then drops the least-used skills' descriptions, keeping their names, so those skills stop triggering); many MCP servers, which inflate tool definitions. For the system overhead itself, point the user to Claude Code's `/context`.

### 2. Problems

For each rule file and `CLAUDE.md`:

| Problem | Found by |
|---------|----------|
| **Missing** | A row of the `SKILL.md` table that applies here (as [write.md](write.md#steps) step 1 decides) has no rule |
| **Not needed** | A conditional rule whose condition no longer holds (a browser rule with no browser checks) |
| **Core drifted** | Text between a core's `core:` markers differs from [core/](core/), after the git core's `[git safeguard]` is replaced by the current `git-safeguard` block's lines (without its `shared:` markers): show the diff. Propose restoring the core; when the project's wording is better, also offer it upstream (`SKILL.md` "Sending a rule upstream") and keep it after the closing marker meanwhile |
| **General** | A project rule, or a written rule's addition, with nothing project-specific in it: offer it upstream (`SKILL.md` "Sending a rule upstream") |
| **Old copy** | A file named `bash-simplicity.md`, `chrome-resilience.md`, `code-contracts.md`, `git-safety.md`, `subagent-briefing.md`, `tldr-last.md`, `verify-before-asserting.md`, `wiki-over-memory.md`, `work-habits.md` or `workflow.md` with no `core:` markers: a copy from the older augur-skills `simpleapps` plugin. Propose the core, or the written rule, in its place (`no-memory` for `wiki-over-memory.md`), and say what the old one said that the new one drops |
| **Memory in use** | The project's auto memory folder holds entries (Claude Code's `~/.claude/projects/<project>/memory/`, read-only): list each entry's name and propose the file it belongs in (`lessons`, a rule, the wiki or `CLAUDE.md`). `rules` never removes an entry; once it has moved, the user deletes it |
| **Dead pointer** | A `Skill("<name>")` no plugin the project expects provides (`SKILL.md` "Pointers"; one missing only from this session is "not installed here"); a path or wiki page that does not exist; a command that is not installed |
| **Duplicate** | Two rules, or a rule and `CLAUDE.md`, say the same thing; or a rule restates a skill or wiki page it could point to. A promoted lesson's one-sentence rule and pointer in `lessons.md` is not a duplicate |
| **Vague** | A behaviour without MUST, SHOULD or MAY; or advice with no condition ("be careful with git") |
| **Not evergreen** | Counts, versions, dates of activity, machine paths ([efficiency.md](efficiency.md#evergreen-wording)). A dated owner decision, and a lesson's incident date, are anchors, not flagged |
| **Stale fact** | A command, script, path, branch or page the rule names that the project no longer has |
| **Wrong layer** | Detail that belongs in a skill or the wiki; a fact that belongs in `CLAUDE.md`'s quick reference; a file-specific rule without `paths` |
| **Private** | A client name, credential, internal host or personal detail; where the project has a banned-strings list, any file it matches (checked as `SKILL.md` "Nothing private" says, naming the file, never the string) |
| **Missing links** | A wiki content page `CLAUDE.md` does not link |

### Lessons review

The lessons file is checked for its core paragraph (missing, or drifted) and **Private**, and its size is reported on its own line, never flagged. Then run the review in [lessons.md](lessons.md#steps-rules-lessons) steps 1 and 2, read-only, and list its findings. Applying them is `/rules lessons`, after the user's yes.

### 3. Report

```
## Rules audit

### Always loaded (every prompt)
| Source | Lines | Words | Est. tokens |
|--------|-------|-------|-------------|
| CLAUDE.md (project) | | | |
| CLAUDE.md (user) | | | |
| Rules without paths | <n> files | | |
| Skill descriptions | <n> skills | <chars> | |
| **Total** | | | |

### On demand
| Source | Words | Est. tokens |
|--------|-------|-------------|
| Rules with paths | | |
| Skills loaded this session | | |
| Wiki | | |

### Problems
| File | Problem | Fix |
|------|---------|-----|

### Budget health
- CLAUDE.md: <lines> / 200 lines
- Skill descriptions: <chars>, largest <chars> / 1,536
- Wiki: <tokens> / <budget>
```

Lead with the problems that matter most (a drifted or missing safety core, a private string, then dead pointers), and end with the saving the fixes would make.

## Safeguards

`SKILL.md`'s safeguards apply. `audit` never writes, even to fix something small.
