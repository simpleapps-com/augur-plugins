# Work Habits

- MUST do exactly what was asked: no extra features, no refactoring beyond the request.
- MUST read the error output (a failing test's message, a check's report) before guessing at a cause.
- MUST fix every failing check or build met along the way. There is no "pre-existing issue": no skipping, no "not from our changes".
- MUST stay inside the project folder. Its layout: `repo/` (the code repo), `wiki/` (the wiki, its own git repo), `wip/` (work files), `tmp/` (scratch), and `clones/` (other repos, read-only). Other repos are read through `clones/<name>`, MUST NOT be read by a path into another project folder, and a blocked read outside is the boundary working, not an obstacle.
- A skill's files MUST be read from the base directory the Skill tool names for that skill, or from `repo/plugins/<plugin>/skills/<skill>/` for a plugin this repo builds. MUST NOT search the plugin cache (`~/.claude/plugins/`) for a skill's text: a cached copy can be another version, or another plugin's skill with the same name.
- After the work: report what changed, suggest `/code quality` if it is unchecked, then stop. MUST NOT suggest committing, pushing or opening a PR; the user starts those.
- MUST NOT end a turn waiting on an answer unless the question is in the visible reply, word for word. The user cannot see the reasoning, so MUST NOT refer to reasoning they never saw. Prefer not blocking: do every part that does not depend on the answer, say what was assumed for the rest, and ask about that.

Load Skill("work-habits") for the detail.
