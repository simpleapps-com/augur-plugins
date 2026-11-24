# Core: subagent-briefing

Written to `<rules>/subagent-briefing.md` when the project is worked on in Claude Code, word for word between the markers. After the closing marker, `write` adds one line per tool rule the project has, naming the file to paste (for example: "Shell: paste `bash-simplicity.md`. Git: paste `git-safety.md`. Browser: paste `chrome-resilience.md`.").

```markdown
# Subagent Briefing

<!-- core:subagent-briefing -->
**When to delegate.** A subagent keeps its exploration out of the main context; only its summary comes back. Delegate broad searches, reads across many files whose content will not end up in the answer, verbose output (full test runs, long logs), and research across the wiki, docs or unfamiliar code. One or two targeted reads are cheaper inline. Independent delegations go out together, in one message, not one after another; each still gets its own complete brief.

**A subagent starts with nothing.** It cannot see this conversation, the wiki, or what was tried. Keep the project's conventions in view (the wiki loaded, where there is one) so the brief can cite them. Every brief MUST give:

- the goal, stated plainly;
- what this session learned: what was tried, ruled out or found;
- the exact files and line numbers already found;
- the project conventions that apply: short rules pasted, larger pages pointed to by path, never the whole wiki;
- the expected output: its format, a length cap, and whether to change code or only report.

**Rules do not always carry over.** Not every subagent loads the project's instructions: Claude Code's built-in Explore, Plan and web-fetch agents skip them, and a custom agent can be set to. When it will use a tool a rule governs (the shell, git, a browser), MUST paste that rule into the brief, word for word, and likewise the lessons that bear on its task. A brief passes on an approval the user gave; it cannot create one.

The user cannot see a subagent's report: check what matters in it, then relay that.
<!-- /core:subagent-briefing -->
```
