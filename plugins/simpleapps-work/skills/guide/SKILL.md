---
name: guide
description: Gives SimpleApps staff a short tour of how the team works with Claude, the project folder, how work flows from Basecamp to GitHub to a WIP to code to a submitted pull request, which skill in the installed augur plugins does what, and a typical session, pointing to each skill's own help for the detail. Use when someone is new, asks how we work, where to start, what the workflow is, which skill or command to use for a job, or what a skill is for.
license: MIT
---

# Guide

A tour for SimpleApps staff of how everything fits. The tour names each part in a line and points to where it lives; the detail stays in each skill, so the tour cannot drift from it.

Key words MUST, SHOULD, MAY per RFC 2119.

## Where it runs

Text only: the tour works on every surface. The skills it names say for themselves what runs where; most of the workflow needs Claude Code, and in chat they draft.

## How to give the tour

Cover the sections below in order, conversationally, for a developer who has never used the system. For any detail, MUST point to the skill's own `/<skill> help` or its plugin's README (`https://github.com/simpleapps-com/augur-plugins/tree/main/plugins/<plugin>`) instead of restating it. The session's own skill list is the source, not the tables in section 3, which are a snapshot: MUST name only skills the session has installed (a skill not installed is named with its plugin, as one to install), and SHOULD add any installed skill the tables miss, in one line from its description. End by asking what they would like to work on, and offer `/wip triage` to see what is open.

## 1. The project folder

Every project is one folder holding `repo/` (the code repo), `wiki/` (its own git repo), `wip/` (one file per piece of work), `tmp/` (scratch), `clones/` (other repos, read-only), `goals/` (the goals being worked now), `worktrees/` (git worktrees of `repo/`) and `.simpleapps/` (site settings, never committed). Claude Code runs from that folder; git runs as `git -C repo`. The layout and its rules: `/project` (explains, changes nothing); setting one up: `/project init`, then `/rules write`.

## 2. How work flows

1. **Basecamp**: a client request arrives. Basecamp is client-facing; GitHub is developer-facing. `basecamp` reads it in full and drafts replies for your yes.
2. **GitHub**: code work gets a GitHub issue, cross-linked both ways (`basecamp`).
3. **WIP**: `/wip <issue or Basecamp link>` creates the WIP and investigates it.
4. **Code**: `/strategize discuss` or `/strategize research` when the approach is unclear, `/code model` when the work has decisions to prove, `/wip implement`, then `/code quality` and `/code sanity-check`.
5. **Submit**: `/repo submit` commits, pushes and opens the pull request. `/repo publish` releases, less often.
6. **Report back** in Basecamp (`basecamp`), and `/wip process` marks the WIP shipped.

## 3. Which skill does what

Commands are skills: `/<skill> <subcommand>`, and `/<skill> help` explains each. A command that shares a skill's name only adds the typed hint.

**augur-build**

| Skill | For |
|-------|-----|
| `augur-packages` | Using the shared `@simpleapps-com/augur-*` packages; `audit` finds custom code they replace |
| `bash-simplicity` | How Claude runs shell commands: one plain command per call |
| `code` | Checking code: `quality`, `verify`, `sanity-check`, `contracts`, `model` |
| `code-docs` | Questions about Claude Code itself |
| `launcher` | `cld`, which updates Claude Code and then starts it |
| `lemma-driven-design` | Model first, proved code |
| `strategize` | Before code: `research`, `discuss` |
| `repo` | Git and GitHub: `status`, `commit`, `submit`, `cleanup`, `publish`, `deploy`, `issue` |
| `rules` | The project's always-loaded rules and `CLAUDE.md`: `write`, `audit`, `file`, `lessons` |
| `wiki` | The project's wiki: `load`, `sync`, `audit`, `curate` |
| `work-habits` | How Claude works on its own: do what was asked, fix what fails, when to ask |
| `writing-style` | One standard for everything written |

**simpleapps-work**

| Skill | For |
|-------|-----|
| `basecamp` | Basecamp the team's way, and the Basecamp-to-GitHub flow |
| `guide` | This tour |
| `project` | The project folder and its settings; `init` sets one up |
| `wip` | One piece of work from issue to shipped: `triage`, `investigate`, `implement`, `process` |

**Other plugins**

| Plugin | For |
|--------|-----|
| `augur-api` | A site's ERP and e-commerce data, read and changed through the Augur API connector (`site-data`) |
| `augur-intelligence` | Plain-language, read-only questions about a site's ERP data |
| `augur-php-lsp` | PHP language server for the Augur monorepo (Claude Code only) |
| `simpleapps-seo` | `semrush` (any domain's search data), `seo-cleanup` (findings into tasks), `web-vitals` (live page speed) |
| `simpleapps-statusline` | Status lines under the prompt: project, branch, issues, plan limits; `/plan-usage` (Claude Code only) |
| `simpleapps-work-pane` | The Work pane beside the chat: your Basecamp todos and watched issues, and Sync; `/work` (Claude Code only) |
| `simpleapps-worktrees` | Puts Claude Code's git worktrees in the project's `worktrees/` folder, and never removes one holding work (Claude Code only) |

## 4. A typical session

```
/work                       what is yours, what changed (the Work pane)
/wip triage                 open issues, PRs and WIPs
/wip <Basecamp link or #N>  create the WIP and investigate
/strategize discuss               when the approach is unclear
/wip implement              do the work against the acceptance criteria
/code quality               every check, every failure fixed
/code sanity-check          did the work solve the request
/repo submit                commit, push, open the pull request
/wip process                mark shipped work, retire old WIPs
```

## 5. What always holds

The project's rules in `repo/.claude/rules/` load on every prompt (`/rules write` composes them; `/rules audit` checks them). The ones a newcomer meets first: no git write unless you ask for it (`repo`); one plain shell command per call (`bash-simplicity`); MUST, SHOULD, MAY in capitals (`writing-style`); client data stays in Basecamp, never in a repo or the wiki (`basecamp`).

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", explains how the skill is used and changes nothing. The answer comes from this file: what the skill does; each subcommand with one line and an example call, and what a bare call does (a skill with no subcommands gives three example requests instead); the settings and their defaults; and what works on each surface. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read this skill's own files, or write anything.
<!-- /shared:help -->
