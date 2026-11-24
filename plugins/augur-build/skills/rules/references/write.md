# `/rules write [topic]`

## Does

Writes the project's rules and `CLAUDE.md` from the project's own facts: the fixed cores word for word, every other rule composed from [catalogue.md](catalogue.md). With a topic (a rule name from the table in `SKILL.md`, or a concern the user names), writes or rewrites that one rule only. Writes files; never commits.

## Reads

- `<claude-md>` and every file in `<rules>`.
- The wiki: `Home.md` first, then the pages it links that hold conventions (development, deployment, testing).
- The layout: the project folder's top level, `<repo>`'s top level, its manifest (`package.json`, `composer.json`, `pyproject.toml`) and its scripts.
- The installed skills and commands: the session's skill list, plus `<repo>/.claude/skills/` and `<repo>/.claude/commands/`.
- [efficiency.md](efficiency.md) and the fixed cores in [core/](core/).

## Steps

1. **Survey.** Read the above. Note which conditional rows of the `SKILL.md` table apply, and why (a lifecycle of commands; a wiki exists; the project is worked on in Claude Code; a browser checklist; load-bearing code). Run `/rules audit`'s checks on what exists, so the proposal fixes what is wrong rather than repeating it.
2. **Ask only what the project cannot tell you**, in one short list: whether to add `tldr-last`, and anything a conditional row needs that the files do not show. `lessons` is always written; an existing lessons file keeps its lessons untouched, and only its core paragraph and pointer are added or brought up to date. Consolidating its lessons is `/rules lessons`, not `write`. Do every part that does not depend on the answer.
3. **Propose.** Show one table: each rule file to write, keep, replace or remove; its source (core, written, project); one line of why; and its words and estimated tokens. Then the always-loaded total (`CLAUDE.md` plus rules without `paths`) before and after. For a rule being replaced, say what it said that the new one keeps, moves or drops. Then wait for a yes.
4. **Write**, after the yes, exactly the files shown:
   - **Cores:** from [core/](core/), every line between the `core:` markers unchanged, the markers included. The git core's `[git safeguard]` becomes the lines of the `git-safeguard` block in `SKILL.md` as they stand, without the block's own `shared:` markers. After the closing marker, the lines each core file says to add.
   - **Written rules:** each one's musts from the catalogue, in the project's own words and facts, shaped as [efficiency.md](efficiency.md#a-rules-shape) says.
   - **`CLAUDE.md`:** see below.
   - **Removals:** `rm` only the files the approved proposal named for removal.
   - Where the project has a banned-strings list, check every file first as `SKILL.md` "Nothing private" says; a match stops the write.
5. **Check.** Re-read every file written. Confirm each core matches its source after the same substitution, every pointer resolves as `SKILL.md` "Pointers" says, and the always-loaded total is what the proposal said.

### Pointers

Each rule MAY end with one line naming where its detail lives. Name only what exists: a skill the project expects as `Load Skill("<name>")` (for example the `repo` skill for git, `code` for contracts, `wiki` for wiki conventions; naming as `SKILL.md` "Pointers" says), a wiki page by relative path, or nothing. A rule whose detail lives nowhere else stays self-contained.

### `CLAUDE.md`

Under 200 lines, evergreen ([efficiency.md](efficiency.md#evergreen-wording)):

1. One line on what the project is.
2. A quick reference: setup, the check and test commands (from the manifest's scripts), and the project facts that are not behaviours (where the version lives, what is read-only).
3. A link to every wiki content page, one line each, saying what it holds.

An existing `CLAUDE.md` is edited, not rewritten: keep the project's own lines, and propose each change in step 3.

## Writing for chat

In chat there is no project to read. Ask for, or work from what the user pastes: the layout, the commands, the wiki's pages. Then draft each rule file in full, naming its path, with the cores word for word. Say that nothing was read from the project or written.

## Safeguards

`SKILL.md`'s safeguards apply. Also:
- A core is never shortened, merged with another rule, or reworded to fit a budget; trim the written rules instead.
- A project rule with no counterpart in the table is kept unless the user says otherwise.
- No rule is written that names a command, skill, path or page this project does not have.

## Report

The files written, kept and removed; the always-loaded total before and after; and anything left for the user (an answer still needed, a pointer to a skill that is not installed yet).
