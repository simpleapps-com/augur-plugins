---
name: wip
description: Tracks a piece of work from a GitHub issue or Basecamp item through to shipped, in a local WIP file. `/wip` with an issue or Basecamp link creates the WIP (source, criteria, attachments) and investigates it, or refreshes an existing one; `/wip triage` shows the repo's issues, PRs and WIPs; `/wip investigate` researches; `/wip implement` does the work against the acceptance criteria; `/wip process` marks shipped work and retires old WIPs. Use when the user gives an issue or Basecamp link to work on, asks what is open or to triage, asks to investigate or implement a WIP, or asks to tidy the WIPs.
license: MIT
---

# WIP

A WIP file holds one piece of work: the request, its acceptance criteria, the research, the plan, and what was done. It lives in a local folder outside the code repo and the wiki and is never committed, because it can hold client content.

Key words MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Invocation | Claude Code | Cowork | Chat |
|------------|-------------|--------|------|
| `/wip` with a reference | Full | Full where the project's files are available (unverified) | A Basecamp item: fetched through the connector and drafted inline, always as `only`, never claiming a WIP exists, naming the file to save it as. A GitHub issue: there is no GitHub access, so ask the user to paste it |
| `investigate`, `implement` | Full | Where the code is available (unverified) | Says it needs Claude Code |
| `triage`, `process` | Full | Where `gh` is available (unverified) | Says it needs Claude Code |

Basecamp items are read through the SimpleApps Basecamp connector this plugin provides, with whatever item and attachment tools it offers; GitHub through `gh`.

## Where things are

- **`<wip-dir>`**: the WIP folder: `wip-dir` if set and valid, else `wip/` in the project folder (the folder holding `repo/`, `wiki/` and `tmp/`).
- **`<repo>`**: the code repo (`repo/` in the project folder, else the git root). **`<wiki>`**: the path the project's `CLAUDE.md` names, else `wiki/`.
- **`<R>`**: `<owner>/<repo>` from `git -C <repo> remote get-url origin` (a GitHub URL; anything else: GitHub steps are skipped).
- **`<default>`**: `repo-branch` on the wiki's `Deployment.md`, else `gh repo view <R> --json defaultBranchRef`.

A WIP is a `*.md` file directly in `<wip-dir>` that starts with WIP frontmatter ([references/schema.md](references/schema.md)). `README.md` and anything without that frontmatter is not a WIP.

**A WIP's issue** is the GitHub issue it tracks: its `issue` URL when that is GitHub, else a GitHub issue among its Source cross-references. A WIP is matched to a reference or a branch by its `issue` URL (owner, repo and number) and its `branch`, never by file name alone; a `GH<N>-` file name only stands for issue N of `<R>`.

## Invocations

The first word decides:

| Invocation | Does | Steps |
|------------|------|-------|
| `/wip triage` | The repo's open PRs, issues with and without a WIP, blocked and unlabelled issues, and the WIP index. Prints; stores nothing | [references/triage.md](references/triage.md) |
| `/wip investigate [file]` | Research: inferred criteria, findings, analysis, the files to change. No code changes | [references/investigate.md](references/investigate.md) |
| `/wip implement [file]` | The work, against the acceptance criteria | [references/implement.md](references/implement.md) |
| `/wip process` | Marks shipped work, retires old WIPs, proposes wiki promotions | [references/process.md](references/process.md) |
| `/wip` with a reference | Creates the WIP and investigates it, or refreshes an existing one | [references/item.md](references/item.md) |
| `/wip` alone | Refreshes the WIP for the current work | [references/item.md](references/item.md) |
| `/wip` with other text | A freeform WIP, after confirming its title | [references/item.md](references/item.md) |

- **Reserved words** (`triage`, `investigate`, `implement`, `process`) as the first word are always the subcommand. The `[file]` after `investigate` or `implement` MUST resolve to one existing WIP (a path, a file name, `GH42`, `BC123`, `#42`); with none given, use the WIP for the current work as bare `/wip` finds it. Anything that does not resolve: stop and ask. A freeform title never starts with a reserved word.
- **A reference**: `#N`; a bare number of 1 to 8 digits (`#N`); `owner/repo#N`; a GitHub issue URL; a Basecamp todo, message, upload or forward URL; or `GH<N>` / `BC<N>` naming an existing WIP. `BC<N>` with no WIP: ask for the Basecamp link. A longer bare number: ask what it is.
- **`only`** right after a reference, and nothing else after it, stops after creating the WIP. Anywhere else it is just a word.
- **Anything else** (a pull request URL, plain text) is a freeform WIP, once the user confirms the title.

Every WIP file MUST follow [references/schema.md](references/schema.md): the frontmatter, the acceptance-criteria rules, and the attachment rules.

## Settings

HTML comments on the wiki's `Development.md`, `<!-- wip-<key>: <value> -->`, read once at the start of a run and printed with their defaults. An unknown `wip-*` key or a malformed value (a non-number for a number) is reported and the default used; if a key appears twice, the first wins.

| Key | Default | Use |
|-----|---------|-----|
| `wip-dir` | `wip/` | The WIP folder: a relative path under the project folder, no `..`, outside `<repo>` and `<wiki>`. Anything else is reported and the default used |
| `wip-retention` | `7` | Days a shipped or abandoned WIP is kept before `process` may delete it |
| `wip-stale` | `30` | Days without review before `process` asks whether an open WIP is still active |

If the project folder is the code repo itself, so `<wip-dir>` would sit inside `<repo>`: stop unless `git -C <repo> check-ignore -q <wip-dir>` succeeds (the folder is gitignored). Client content MUST NOT reach a commit.

## Commands

`wip` makes **no git or GitHub writes** and runs only:

- read-only git, as `git -C <repo>`: `branch --show-current`, `status --porcelain`, `log` (`--oneline`, `-<n>`, `--grep=<text>`, a `<ref>` or range, `-- <path>`), `diff`, `rev-parse <ref>`, `remote get-url origin`, `check-ignore -q <path>`;
- read-only `gh`: `repo view <R> --json <fields>`; and with `--repo <owner>/<repo>`: `issue view`, `issue list`, `pr view`, `pr list`, `label list`;
- files: `ls <path>`, and searches (`grep -rn`, `find`) inside the project folder;
- in `implement` only, the project's scripts by manifest name: `pnpm --dir <repo> run <name>`, `npm --prefix <repo> run <name>`, `composer --working-dir <repo> run-script <name>`;
- the Basecamp connector's read tools; its comment or post tools only on the user's yes;
- deleting WIP files, only in `process` under its rules.

Anything else, including any `gh` write such as a label or a comment, is shown to the user, not run.

## Writes and approval

`wip` writes when the user typed the `/wip` invocation, or asked in their own words for that operation ("work on issue 42", "investigate the cart WIP", "implement it", "tidy the WIPs"). When the model picked this skill for another request, it MUST NOT write: report what it would do, and stop.

| Invocation | Writes | Covered by that request |
|------------|--------|-------------------------|
| reference, bare, `investigate` | WIP files in `<wip-dir>` | Yes |
| `implement` | Code in `<repo>`, and its WIP | Yes |
| `process` | WIP frontmatter; deleting WIPs that are shipped or abandoned, `disposition: delete`, and past `wip-retention` | Yes |
| `process` | A wiki promotion (and deleting the promoted WIP); any other delete | No: the user's yes, each one |
| any | A Basecamp comment or post | No: the user's yes, each one; never automatic |

No secrets, tokens or credentials go in a WIP.

## Works with

- `/repo commit` and `/repo submit` (augur-build, if installed) create the branch and ship the work; `wip` never does. `/wip process` later finds the merged PR.
- `/code quality` and `/code sanity-check` (augur-build, if installed) check the work; `sanity-check` reads the WIP's criteria.
- Without augur-build, say which step is next in words.

## After a run

Report what was read, written or deleted, and the WIP's status and unticked criteria. Then stop: MUST NOT commit, and MUST NOT suggest the next command.
