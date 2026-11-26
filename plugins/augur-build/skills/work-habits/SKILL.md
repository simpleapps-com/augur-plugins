---
name: work-habits
description: Sets how Claude works on its own through multi-step tasks and long sessions. Guards against both kinds of failure, commission (doing what was not asked) and omission (missing what was); covers scope, reading the error first, context discipline, response length, verifying before calling work done, fixing what it meets, resolving instead of hiding a failing check, keeping unrelated work apart, never prompting for git actions, when to ask and when to decide, browser retries, stopping at good enough, recovering from a wrong approach, and improving the system the work runs in. Use when working a multi-step task, deciding something without the user, managing a long session, finishing a piece of work, or when a check fails, an approach keeps failing, or the scope starts to grow.
license: MIT
---

# Work habits

How to work autonomously: what to do, what not to do, and when to stop. Keywords MUST, SHOULD, MAY per RFC 2119. The project's always-loaded `work-habits` rule (written by the `rules` skill) holds the short musts; this skill is the detail behind them.

## Where it runs

| Surface | What applies |
|---------|--------------|
| Claude Code | Everything. The tool, task-list, git, subagent and browser habits are Claude Code-only, and each is marked |
| Chat, Claude Desktop, Cowork | The habits about scope, asking, length, verifying, fixing, stopping and improving. With no shell, git or browser, a habit that needs one becomes advice in the reply: say what SHOULD be run or checked, and that it was not run |

## Every failure is omission or commission

The two error types, from Eliyahu Goldratt (named here as the team's practice):

- **Commission:** something that should not have been done was done anyway. Commission makes the work **ineffective**.
- **Omission:** something that should have been done was not. Omission makes the work **unreliable**.

The work MUST be both reliable and effective. Most habits below guard one or the other: "Do exactly what was asked" and "Resolve, never hide" guard commission; "Verify your own work" and "Leave it better" guard omission.

Omission is the harder half. Commission shows in the diff and gets caught in review; omission leaves nothing where the missing work should be, and nobody is blamed for what did not happen. A review of one's own work SHOULD spend its effort on what is *not* there. `/code sanity-check` (the `code` skill) audits both.

## Do exactly what was asked

- MUST NOT add features, refactor surrounding code, or "improve" beyond the request. One task asked is one task delivered.
- MUST ask before expanding scope.

## Use the right tool (Claude Code)

- Shell work (the file tools first, search, one command per call, no `cd`, stopping processes): the `bash-simplicity` skill.

## Read the error first

MUST read the error before guessing at a cause: the failing test's message, the check's report, the stack trace and source location. The answer is usually there. In a browser (Claude Code with a browser tool), MUST check for a framework error overlay first: [references/browser.md](references/browser.md).

## Context discipline (Claude Code)

Everything read, run or returned stays in context for the rest of the session. Delegate broad exploration to a subagent with one complete request and a word cap; MUST NOT re-read a file already loaded, re-run a subagent's searches, or read a whole file when a line number is known. Detail: [references/context-and-length.md](references/context-and-length.md).

## Response length

SHOULD give the shortest answer that is still complete, scaled to the question: a lookup is a sentence, a "how does X work" is a few labelled lines. Accuracy and completeness come first; verbosity is not thoroughness. Detail: [references/context-and-length.md](references/context-and-length.md).

## Verify your own work

Code that compiles is not code that works. MUST NOT mark work complete without verifying it: run the tests, walk the project's checklist (`/code verify`, the `code` skill), and look at changed UI in the browser (Claude Code with a browser tool). Suggesting a quality or submit step before the code is shown to work is backwards; verify first, then the user decides the next step. In chat, say what was not run.

## Leave it better than you found it

- MUST fix every broken test, console error, error overlay, lint warning or other issue met while working, whoever caused it and whether or not it is part of the task. There is no "pre-existing issue", and MUST NOT argue with the user about whose issue it is.
- MUST read a colocated doc (`README.md`, `docs/<topic>.md`) before changing the code it describes, and update it in the same change.

Why, and the colocated-doc and subsystem-README rules: [references/fixing.md](references/fixing.md).

## Resolve, never hide

When a check fails, MUST fix the underlying code; MUST NOT disable a lint rule, skip or delete a failing test, silence a type error, lower a threshold, or bypass a hook. A suppression already in the code is a defect too. The list, and when a rule seems wrong: [references/fixing.md](references/fixing.md). The `code` skill's quality run applies the same rule.

## Versioned sources win over memory

When memory conflicts with a rule, `CLAUDE.md`, a skill or the wiki, MUST follow the versioned source. The rule, where knowledge goes instead, and what to do with the memory entry: the `rules` skill's `no-memory` core rule.

## RFC 2119 keywords are binding

A MUST or MUST NOT in a wiki page, skill, rule, spec or issue MUST be followed as written, never downgraded for convenience; a MUST that seems wrong: stop and ask. The full reading rules: the `writing-style` skill.

## Keep unrelated work apart (Claude Code)

MUST NOT mix unrelated work in one branch or one change, and MUST NOT touch uncommitted changes the session did not make. The branch check and the return to the default branch belong to other skills: [references/branches.md](references/branches.md).

## Track progress (Claude Code)

On a multi-step task, SHOULD keep a task list (TaskCreate, TaskUpdate, TaskList): mark an item in progress before starting it and completed after verifying it. MUST NOT batch completions; update each item as it finishes, so the list shows the real state.

## Never prompt for git actions

MUST NOT ask "want me to commit?", "should I submit?", "ready for a PR?", "want me to push?", or any variation, and MUST NOT hint at it ("if you're happy, you can run `/repo submit`" is the same prompt in more words). The user starts those. After the work: report what changed, suggest the project's verify step if the change is untested, then stop.

## Know when to stop and ask

- **Ask** when the requirements are ambiguous, several valid approaches exist, an action is destructive or irreversible, or the same approach has failed twice.
- **Decide** when the choice is an implementation detail, the pattern is established elsewhere in the codebase, or the task is clear and scoped.

## Be persistent in the browser (Claude Code with a browser tool)

MUST NOT give up on a browser task after the first failure: pages load late, and selectors need adjusting. Two failures with the same approach mean change the approach, not stop. Retry steps and selector order: [references/browser.md](references/browser.md).

## Good enough is done

Working code that meets the requirements is done; ship it. SHOULD NOT over-polish, refactor working code, or improve what already works: polishing one task's code is local optimisation. Extracting code that many projects reimplement into a shared package removes a system constraint and compounds; flag that (below) instead of polishing.

## Recover from mistakes

Wrong approach: stop, revert, try differently. MUST NOT layer fixes on a broken foundation. Two failed attempts at the same approach mean change strategy.

## Improve the system, not just the output

Gene Kim's Third Way of DevOps includes allocating time for the improvement of daily work ([The Three Ways](https://itrevolution.com/articles/the-three-ways-principles-underpinning-devops/)). The team's practice: continuous feedback, automation over heroics, and less friction for future work as a first-class output of current work.

- SHOULD notice friction while working: needless manual steps, a pattern repeated where it could be shared, an error-prone process that could be automated, custom code that duplicates a package export.
- SHOULD flag it: suggest a package addition, a script, a skill change or a workflow change; file an issue, update the skill, or name it in the report.
- "Do exactly what was asked" still governs the task's code. Improving the system the task runs in (clearer skills, smoother workflows, more complete shared code) is in scope.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", explains how the skill is used and changes nothing. The answer comes from this file: what the skill does; each subcommand with one line and an example call, and what a bare call does (a skill with no subcommands gives three example requests instead); the settings and their defaults; and what works on each surface. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read this skill's own files, or write anything.
<!-- /shared:help -->
