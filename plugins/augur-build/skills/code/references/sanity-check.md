# Sanity check

## Does

Checks that the work solved the problem that was asked, without doing what should not have been done (errors of commission) or missing what should have been (errors of omission). Linters and tests catch implementation errors; this catches misunderstanding the request, solving the wrong problem, over-building, and missed requirements. Omissions slip through review because nobody sees what did not happen, so they get the most attention here.

It is a report: it changes nothing. You are reviewing work you may have written; act as a sceptical reviewer who did not. A clean verdict is the exception, and earned.

## Reads

The wiki's `Development.md` prose on where requests and criteria are kept, if any (guidance only); the wiki pages the work touches.

## Steps

1. **The request.** In order of preference: a WIP or plan file for this work, if the project keeps them; the issue, fetched fresh with `gh issue view <N> --repo <R> --json title,body,comments,state` (it may have changed since the work began), with every comment; else the request as stated in this conversation. Note the acceptance criteria, if any were written down. None written: say so; this check has nothing firm to compare against.
2. **The work.** On a work branch, `git -C <repo> diff <default>...HEAD`; with uncommitted work, `git -C <repo> diff HEAD` and the untracked files. Read the substance, not just the file list.
3. **Understanding.** Compare the request, and every comment, with what the diff does. Name each assumption the request does not state, and each ambiguity, and whether the interpretation was reasonable. A misunderstanding makes everything after it wrong: this is the highest-value check.
4. **Commission:** what was done that should not have been. Changes unrelated to the request; abstraction or configurability beyond it; refactoring nobody asked for; patterns that break the wiki's or the codebase's conventions; behaviour nobody requested; side effects on other features. Cite the file and change.
5. **Omission:** what should have been done and was not. Each acceptance criterion against the diff (a criterion ticked with nothing behind it is worse than one left open); requirements the request clearly implies (a new field is visible, saved and validated), not gold-plating; obvious edge cases (empty, error, missing data); tests for new behaviour; wiki pages that now describe the old behaviour; a change another repo needs that has not been raised.
6. **The solution.** Is there a simpler approach (fewer files, an existing library or framework feature)? Root cause or symptom patch? Is the size of the change proportionate to the problem?

## Writing the wiki settings

None. A line of prose on `Development.md` saying where requests and criteria live (an issue tracker, `wip/` files, a plan folder), and anything always checked ("every change to `src/billing/` has a test"), helps; it is read as guidance.

## Safeguards

Report only: no edits, no git writes. Fixing belongs to `/code quality`, `/code verify`, or the user.

## Report

```
## Sanity check
Request: <issue, file, or "this conversation">   Files changed: N
Understanding: <right problem? assumptions, ambiguities>
Commission:  [warning] <finding>: <file>: <why>
Omission:    [critical] <finding>: <expected vs missing>
Solution:    simpler? <...>  root cause? <...>  proportionate? <...>
Verdict: <"Clean, N notes" or "X issues; first: <most severe>">
```

Severities: `critical` (wrong problem, a missed acceptance criterion), `warning` (scope creep, a missing edge case), `note` (a wiki update, a minor omission).
