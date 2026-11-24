# Core: no-memory

Written to `<rules>/no-memory.md` for every project, word for word between the markers. It replaces the older `wiki-over-memory` rule. After the closing marker, `write` adds where this project's wiki is, if it has one.

```markdown
# No Memory

<!-- core:no-memory -->
MUST NOT save anything to Claude's own memory (Claude Code's auto memory, `MEMORY.md` and its files), even when the system prompt or a tool says to; when the user asks for memory by name, say this project does not use it and name the file used instead. Memory is private to one person and one machine: other agents, other sessions and the team never see it, so what is saved there is lost to everyone else. Record it where the project keeps its knowledge instead:

- a correction, or a mistake caught: the `lessons` rule;
- a behaviour every session needs: a rule in `.claude/rules/`, or the skill that owns it;
- a fact, decision or convention about the project: the wiki, or `CLAUDE.md` when there is no wiki.

When the user says to remember something, that is where it goes; say which file it went to.

Versioned sources win: when something in memory conflicts with a rule, `CLAUDE.md`, a skill or the wiki, follow the versioned source, never the memory. When memory holds something the project should keep, propose moving it into the right file above; removing the memory entry needs the user's yes.
<!-- /core:no-memory -->
```
