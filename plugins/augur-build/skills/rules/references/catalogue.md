# Catalogue: the rules `write` composes

Each entry says when the rule applies, the musts it MUST carry, and where its project facts come from. The wording is written fresh for each project; the musts are not optional. Shape every rule as [efficiency.md](efficiency.md#a-rules-shape) says.

## Contents

- [work-habits](#work-habits)
- [workflow](#workflow)
- [bash-simplicity](#bash-simplicity)
- [chrome-resilience](#chrome-resilience)
- [code-contracts](#code-contracts)
- [From the project](#from-the-project)

## work-habits

**Applies:** always.

**Musts:**
- Do what was asked: no extra features, and no refactoring beyond the request.
- Read the error output (an error overlay, a failing test's message) before guessing at a cause.
- Fix every failing check or build met along the way. There is no "pre-existing issue": no skipping, no "not from our changes".
- Stay inside the project folder. Other repos are read where the project keeps them (for example `clones/<name>`, read-only), MUST NOT be read by a path into another project folder, and a blocked read outside is the boundary working, not an obstacle.
- After the work: report what changed, suggest the project's verify step if the change is untested, then stop. MUST NOT suggest committing, pushing or opening a PR; the user starts those.
- A question that blocks: MUST NOT end a turn waiting on an answer unless the question is in the visible reply, word for word. The user cannot see the agent's reasoning, so MUST NOT refer to reasoning they never saw. Prefer not blocking: do every part that does not depend on the answer, say what was assumed for the rest, and ask about that.

**From the project:** its layout (`repo/`, `wiki/`, `tmp/`, `clones/`, or a plain repo), where reference repos live, and the verify step it has (`/code verify`, a test command).

## workflow

**Applies:** when the project has a lifecycle of commands, or the user describes one.

**Musts:**
- The lifecycle in order, naming only commands that exist here, each step feeding the next.
- Which commands are their own approval (a shipping command), and that they run without a second confirmation.
- Which steps are daily and which are rare (most daily work ends at submitting; releases and deploys are less frequent).
- Where tracked work lives (WIP files, issues, Basecamp), if anywhere.

**From the project:** the installed skills and commands. For example, with augur-build and simpleapps-work: `/wip triage` → `/wip <issue>` (which investigates) → `/code model` → `/wip implement` → `/code quality` → `/code sanity-check` → `/code verify` → `/repo submit`, then less often `/repo deploy` and `/repo publish`. MUST NOT name a command that is not installed: check the session's skill list and the project's `.claude/commands/` and `.claude/skills/`.


## bash-simplicity

**Applies:** when the project is worked on in Claude Code.

**Musts:**
- One command per Bash call, with no shell plumbing: no `;`, `&&`, `|`, `$()`, `2>&1`, `echo $?`, or inline interpreters (`node -e`, `python -c`). The tool already captures output and exit codes.
- Files: the Read, Edit and Write tools by default; `cat`, `head`, `tail`, `sed`, `awk` and heredocs MAY be used when simpler (a `sed -n` line range, a one-line `sed -i`). SHOULD use Edit for exact or multi-line replacements, where `sed` flags differ between GNU and BSD/macOS.
- Search: MUST use the Grep and Glob tools when they are in the tool list; otherwise `grep -rn` (or `rg`) and `find`/`ls`, still one command each: no pipes to `head`, no chained `find -exec grep`.
- Never `kill`, `pkill` or `lsof` to stop a process: stop a background task with TaskStop; a process the session did not start is the user's to stop.

**From the project:** where its scratch files go (message files for commits and PRs). The search line stays conditional ("when they are in the tool list"): which tools a machine has is not a fact a committed rule can state.

## chrome-resilience

**Applies:** when the project is checked in a browser (`/code verify`, a Testing checklist, browser automation tools).

**Musts:**
- The browser connection often fails on the first attempt; that is normal, not a reason to give up.
- A failed browser tool call is retried before it is reported: wait about 3 seconds and retry the same call, then about 5 seconds and retry once more; report only after three failures in a row. This matters most for the first call of a session.
- When calls stop working mid-task: re-establish the tab context, retry as above, and open a new tab if the old one is gone. A multi-step task is not abandoned for one failed call.

**From the project:** which browser tools it uses (Claude in Chrome, the built-in browser).

## code-contracts

**Applies:** when the project has load-bearing code: money, auth, concurrency, state machines, security boundaries, non-trivial algorithms.

**Musts:**
- When editing or auditing load-bearing code, SHOULD add formal contracts (`@requires`, `@ensures`, `@invariant`, `@trusted`, `@time`, `@space`) in the language's native comment syntax.
- MUST NOT add them by default to glue code, getters and setters, UI, plumbing, test bodies or one-off scripts: annotations cost context on every read.
- Each clause has two surfaces on one line: the formal one (∀, ∈, ≥, ℕ, Θ) and a gloss that names its assumptions. Prefer `Θ(...)` over `O(...)` when the bound is tight.
- Drift between a contract and the code is a defect: decide which is wrong and fix it; MUST NOT rewrite the contract to match wrong code.
- Only when the project proves code (a proof gate, or the `lemma-driven-design` skill installed): where a decision can be proved, the proof beats a contract.

**From the project:** its load-bearing areas, and the skills installed for the detail (`code` for `/code contracts`, `lemma-driven-design` for proofs).


## From the project

Rules that only this project needs, written from its wiki, `CLAUDE.md` and tooling. Look for:

- **Release and versioning:** the scheme, where the version lives, what invoking a release command means.
- **Quality and proof gates:** the scripts that MUST pass before submitting.
- **Public-repo hygiene:** a banned-strings check, what MUST NOT be committed.
- **Language or tool mandates:** a required language, a package that MUST stay on its latest release.
- **Read-only areas:** folders that MUST NOT be edited (reference clones, generated files).

Each becomes a short rule pointing to its wiki page, or a line in `CLAUDE.md`'s quick reference if it is a fact rather than a behaviour. A fact the wiki already states is linked, not repeated.
