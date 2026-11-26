# Augur Build

For developers, including third parties, building on Augur. Augur Build will carry the conventions and workflows for working on Augur projects with Claude, in claude.ai, Claude Desktop, Cowork, and Claude Code.

**Early release.** More skills will move in from the older Claude Code-only plugin over coming releases. It needs no connector and no sign-in.

## Skills

| Skill | Use it for |
|-------|------------|
| `wiki` | Working with a project's markdown wiki (a `wiki/` git folder, such as a GitHub wiki clone): `/wiki load`, `sync`, `audit` or `curate`. The project's wiki can replace an action's steps (a `Wiki-Maintenance.md` section per action) and change its settings (comments in `Home.md`). Loading, syncing, auditing and curating need Claude Code; in chat it applies the wiki conventions to pasted text |
| `repo` | Shipping code through git and GitHub: `/repo status`, `sync`, `commit`, `submit`, `cleanup`, `publish`, `deploy` or `issue`. `sync` fast-forwards the current branch from `origin`, keeping local changes, and stops on a diverged branch or a conflict. Settings on the project's wiki `Deployment.md` (`repo-*` comments) choose how it behaves; it runs only its own listed commands and the project's scripts, never commands written in the wiki. Fixed safeguards: no force push, no hook bypass, no issue unless asked, cleanup after every merged submit and publish. `publish` and `deploy` never guess: without their settings they offer a draft. Running needs Claude Code; in chat it drafts commit messages, PR bodies and Deployment settings |
| `code` | Checking code without touching git: `/code quality` (every check, fix every failure, no suppressions), `verify` (the wiki's Testing checklist in a browser, then Core Web Vitals and the Lighthouse score on the pages the wiki names, against Google's "good" thresholds), `sanity-check` (did the work solve the request), `contracts` (formal contracts on load-bearing code) or `model` (the formal model and lemmas for a piece of work, from a WIP, issue, spec or the session, before its code). Running needs Claude Code, and `verify` a browser tool; in chat it reviews pasted code and drafts models |
| `rules` | A project's always-loaded instructions for Claude: `/rules write` composes the project's rules (`.claude/rules/`) and `CLAUDE.md` from its own wiki, layout and tools, with the safety rules as fixed text that is never reworded; `/rules audit` reports what they cost every prompt and what is stale, duplicated, drifted or copied in (a report; changes nothing); `/rules lessons` reviews the lessons the agent records from its own mistakes, consolidating repeats and promoting settled ones into topical or file-scoped rules; `/rules file` sends a new rule, or a change to one, back to this marketplace as an issue (scrubbed of private detail) so every project gets it. Reading and writing the project's files needs Claude Code; in chat it drafts the rule files |
| `augur-packages` | Building on the shared `@simpleapps-com/augur-*` packages: check the installed packages' docs before writing custom code, keep site-specific code in the site, report outdated packages with augur-doctor (updating only when asked), and `/augur-packages audit` a site for custom code a package already replaces (a report; changes nothing). Reading the packages, augur-doctor and the audit need Claude Code (or Cowork, where the files are available); in chat it reviews pasted code |
| `augur-services` | Calling the Augur services from code, from their public docs, never from a guess: the service directory and each service's `llms.txt`, then `endpoints.jsonl` for the route and its params, then `openapi.json` for that one operation's schemas, written with the `@simpleapps-com/augur-api` SDK. `/augur-services find <what>` reports the service, route, params, schemas and SDK call (changes nothing). In Claude Code a bundled script pulls one operation out of `openapi.json`; in chat it reads the docs with web fetch where the surface has it, or asks for them to be pasted |
| `launcher` | Installing and updating `cld`, a shell command that updates Claude Code and then starts it with every argument passed through (`cld -c` updates, then continues): `/launcher write` copies it into your own bin folder after a yes; `/launcher audit` reports whether your copy is current (a report; changes nothing). macOS, Linux and WSL; installing needs Claude Code, and in chat it shows the script and where to save it |
| `writing-style` | One standard for everything written, for people and agents: directives with RFC 2119 keywords (MUST, SHOULD, MAY) that are obeyed as written, one term per thing, nouns instead of pointing words, text sized to its reader with the answer first, no em-dashes, unordered lists sorted, and full-word names in code. Text only, so it works the same on every surface |
| `strategize` | The step before code, changing no code: `/strategize research` finds the best long-term approach (existing packages first, then official docs, best practices, community experience, up to three alternatives) with a source for every claim; `/strategize discuss` talks the work through until its what, why and scope are agreed. Works on every surface; research uses web search where the surface has it, and marks unsourced findings as unverified |
| `work-habits` | How Claude works on its own through long tasks: doing what was asked and missing nothing, reading the error first, context and response length, verifying before calling work done, fixing what it meets and never hiding a failing check, keeping unrelated work apart, when to ask, stopping at good enough, recovering from a wrong approach. The detail behind the short `work-habits` rule that `/rules write` adds to a project |
| `bash-simplicity` | Shell work in Claude Code that never waits on a permission prompt: one command per call, the file tools first, plain search, background tasks stopped with TaskStop, other repos through `clones/`. The detail behind the `bash-simplicity` rule. Claude Code only |
| `code-docs` | Answers about Claude Code from its own documentation at code.claude.com, not from memory: the page that covers the question, and a version check against the installed build |
| `lemma-driven-design` | A coding design pattern like test-driven design, with proofs: the model and its lemma first, the proof red, the code, the proof green, then tests. For TypeScript it uses LemmaScript and Dafny. Running a prover needs a terminal (Claude Code); in chat it helps plan and review models, specs and code |

## Augur developer docs

The skills cover how to work. The Augur platform itself has two public starting points.

**[augur-api.info](https://augur-api.info)** is the hub for finding every public Augur API endpoint, for people and agents (its [`llms.txt`](https://augur-api.info/llms.txt) and [FAQ](https://augur-api.info/faq.md)). Start a new system here:

1. **`llms.txt`: what a service is.** The [service directory](https://items.augur-api.com/llms.txt) names every service, and each one answers at `https://{service}.augur-api.com/llms.txt` with its overview and the list of the others.
2. **`endpoints.jsonl`: find the route.** One JSON line per endpoint, generated from the code, covering every route the service exposes: method, path, path, query and header params, each with its type, whether it is required, and constraints such as `maxLength`, `format`, `multipleOf` and the `pattern` a path value must match; a POST that changes nothing is marked `"x-read-only": true` ([FAQ](https://augur-api.info/faq.md)). Grep it for the route and its params; a call with no body (a GET) can be built from that line alone. It is small: for the items service, measured on 2026-11-26, 186 routes in about 70 KB, against 4.3 MB for its `openapi.json`.
3. **`openapi.json`: the detailed spec.** Open it only for the one operation found, for its request and response schemas. `/postman.json` is for testing by hand.

Every call takes `Authorization: Bearer <jwt>` and `x-site-id`; `/ping` and `/health-check` need only `x-site-id`. The `augur-services` skill walks this path for you.

**[augur.build](https://augur.build/docs/getting-started)** is the developer docs:

- [Augur API](https://augur.build/docs/augur-api/overview): auth, the response envelope, pagination, caching and retries.
- [Services](https://augur.build/docs/services/overview): each service's endpoints, OpenAPI spec and `llms.txt`.
- [Packages](https://augur.build/docs/packages/overview): the API clients and the `@simpleapps-com/augur-*` framework packages that the `augur-packages` skill checks first.

For a site's own data from Claude, use the `augur-api` plugin in this marketplace, not this one.

## Install

**claude.ai, Claude Desktop, and Cowork** (Pro, Max, Ultra, Team, or Enterprise plan):

1. Add the `augur` marketplace: **Customize > Plugins > Add > Add marketplace**, then enter `simpleapps-com/augur-plugins`.
2. Install **Augur Build** from it.

**Claude Code:**

```
/plugin install augur-build --marketplace simpleapps-com/augur-plugins
```

On Claude Code older than 2.1.275, add the marketplace first with `/plugin marketplace add simpleapps-com/augur-plugins`, then run `/plugin install augur-build@augur`.
