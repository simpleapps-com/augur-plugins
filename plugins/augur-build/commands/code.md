---
name: code
description: Checks, reviews and models a project's code without touching git. Runs the quality checks and fixes what fails, walks the wiki's Testing checklist in a browser and measures page speed (Core Web Vitals, Lighthouse), sanity-checks work against the request, audits formal contracts on load-bearing code, and writes the formal model for a piece of work before its code. One skill with five subcommands (`/code quality`, `verify`, `sanity-check`, `contracts`, `model`); settings on the project's wiki name the checks to run. Use only when the user asks for one of these: run the quality checks, lint, typecheck or tests; verify a change in the browser or check page speed before release; sanity-check the work; audit or add code contracts; or write a formal model from a WIP, issue, spec or the session.
argument-hint: "[quality | verify | sanity-check | contracts | model | help] [...]"
---

Use the `code` skill and run its `$ARGUMENTS` subcommand. With no argument, list the subcommands and ask which to run.
