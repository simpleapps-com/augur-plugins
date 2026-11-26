---
name: bash-simplicity
description: Runs shell work in Claude Code the way that never waits on a permission prompt. One command per Bash call with no shell plumbing; the Read, Edit and Write tools by default, with `cat` and `sed` allowed when simpler; search with the Grep and Glob tools or plain `grep` and `find`; background tasks stopped with TaskStop, never `kill`; other repos read through `clones/<name>`. Claude Code only; in chat there is no shell and the skill does nothing. Use when running a Bash command, when a command is denied or prompts, when stopping a dev server or freeing a port, when searching another repo, or when briefing a subagent that will use the shell.
license: MIT
---

# Bash simplicity

The detail behind the project's short `bash-simplicity` rule, which the `rules` skill writes into `.claude/rules/`. The rule holds the musts; this skill holds why, the tables and the cases.

Keywords MUST, SHOULD, MAY per RFC 2119.

## Where it runs

Claude Code only. Chat, Claude Desktop chat and Cowork have no Bash tool for the project, so the skill does nothing there; a command it would run is shown as text for the user to run.

## Why it matters

A permission prompt blocks the agent until the user answers. If the user is away for an hour, the hour is lost. Ten simple commands that run at once beat one clever command that waits for approval: every prompt puts the user back in the critical path.

Per the [permissions docs](https://code.claude.com/docs/en/permissions.md) ("Compound commands"), every subcommand of a compound command must be allowed for it to run without a prompt, so each added part is another chance to prompt. One command per call also keeps each call readable, matchable by one allow rule, and safe to retry. One command per call is the team's practice, not a docs requirement.

Use the highest tier that does the job:

| Tier | Method | Prompt chance | Example |
|------|--------|---------------|---------|
| 1 | Dedicated tools (Read, Edit, Write) | None for files inside the project | `Read(file_path: "repo/src/foo.ts")` |
| 2 | Simple Bash (one command, no operators) | None when an allow rule or the read-only list covers it | `pnpm typecheck`, `grep -rn pattern repo` |
| 3 | Compound Bash (operators, plumbing) | Any part not allowed prompts | `pnpm typecheck 2>&1; echo $?` |

Tiers 1 and 2 are both fine: pick the simpler. MUST NOT use tier 3.

## The Bash tool is not a terminal

The Bash tool already returns stdout, stderr and the exit code ([tools reference](https://code.claude.com/docs/en/tools-reference.md), Bash). Shell plumbing adds nothing. If the tool already does it, MUST NOT do it in the command:

| Job | The tool already does it | MUST NOT add |
|-----|--------------------------|--------------|
| Capture stderr | Captured | `2>&1`, `2>/dev/null` |
| Get the exit code | Returned | `; echo $?`, `; echo "Exit code: $?"` |
| Limit output | Returned in full | `\| head`, `\| tail`, `\| grep` |
| Pass output to another command | Write it to a scratch file | `$(...)`, backticks |
| Run inline code | Use the Read and Edit tools, or reason over the output | `node -e`, `python -c` |
| Run the next step | Make a separate tool call | `&&`, `;`, `\|\|` |

A command containing `;`, `&&`, `||`, `|`, `$()`, backticks, `2>&1` or `2>/dev/null` is wrong. A `|` inside a quoted `jq` or `gh --jq` filter counts as plumbing too: run the plain command and parse the JSON in the reply.

## Files: tools or shell

Read, Edit and Write are the default: they need no prompt for project files and their output is tracked. `cat`, `head`, `tail`, `sed`, `awk` and heredocs MAY be used when simpler:

| Job | Default | Shell is fine for |
|-----|---------|-------------------|
| Edit | Edit tool | A one-line `sed -i` substitution in one file |
| Read | Read tool | `sed -n '40,60p' file`, `tail -n 50 log` |
| Write | Write tool | A short heredoc |

- SHOULD use Edit for exact or multi-line replacements: `sed` escaping is fragile, and its flags differ between GNU and BSD/macOS (`sed -i ''`).
- MUST NOT batch a multi-file rewrite into one clever `sed` or `rg` command: one file per call, or ask.
- Scratch files (commit messages, PR bodies, output to pass on) go where the project's rule says, and are removed after use.

**Search.** When the Grep and Glob tools are in the tool list, MUST use them. Per the [tools reference](https://code.claude.com/docs/en/tools-reference.md), Claude Code leaves them out of the default tool set on macOS, Linux and WSL, and there `grep` and `find` in Claude's shell run embedded versions of `ugrep` and `bfs`. `rg` is faster and respects `.gitignore`, but MAY be missing. One command each:

| Job | Bash command |
|-----|--------------|
| Find files by name | `find <path> -name <pattern>`, or `rg --files <path>` if installed |
| List a folder | `ls <path>` |
| Search file contents | `grep -rn <pattern> <path>`, or `rg <pattern> <path>` if installed |

Quote a glob passed to `grep` (`--include="*.ts"`): zsh expands an unquoted one and fails with "no matches found".

MUST NOT state tool availability as a version fact ("removed in 2.1.N") in a rule or skill: it depends on platform and launch flags, and a pinned claim goes stale silently.

**JSON: prefer `jq`.** For a large JSON file, SHOULD use `jq` to pull fields rather than Read or `grep`: Read puts the whole structure (base64 blobs, embedding vectors, inlined strings) into context for the rest of the session, and `grep` cannot follow structure.

| Job | Bash command |
|-----|--------------|
| Extract a field | `jq '.field' file.json` |
| Pull values from an array | `jq '.[].itemId' file.json` |
| Strip a noisy field | `jq 'del(.bigField)' file.json` |

Read and `grep` stay right for small JSON whose structure is unknown, for malformed JSON, and for a string search across files.

Bash is also the place for build tools, test runners, git, package managers and system commands.

## Commands to leave alone

- **`cd`**: MUST NOT change folder; pass paths as arguments and use `git -C <dir>`. A project MAY deny `cd` in its settings to keep the session inside the project folder. Seen in use: a compound `cd` plus git command raises Claude Code's own security prompt, which a deny rule does not suppress, and interrupts the user.
- **`kill`, `pkill`**: MUST NOT use; they stop the user's processes. Stop a background task with TaskStop.
- **`lsof`**: MAY read state (what holds a port). MUST NOT be a step toward stopping a process.
- **`node -e`, `python -c`**: MUST NOT run inline scripts. Read a file with the Read tool; process data in the reply.
- **`sleep`**: foreground sleeping burns a turn for nothing. To wait on a condition, use the Monitor tool, which feeds a background command's output back line by line ([tools reference](https://code.claude.com/docs/en/tools-reference.md)). MUST NOT build a poll-and-sleep loop.

## When a command is denied

MUST NOT retry the same command, and MUST NOT ask the user to approve it. First look for a tool or a split:

- `cat`, `head`, `tail` → the Read tool.
- `sed`, `awk` → the Edit tool.
- `|`, `2>&1`, `&&`, `;`, `$()` → separate calls; the Bash tool already returns stdout, stderr and the exit code.

Worked example: `pnpm --filter <package> typecheck 2>&1 | grep -c "error TS"` is denied for the pipe. Run `pnpm --filter <package> typecheck` alone, then count "error TS" in the returned output. `grep` itself is fine; the deny is on the plumbing around it.

## Background tasks

`run_in_background: true` starts a command as a background task and returns its task ID ([tools reference](https://code.claude.com/docs/en/tools-reference.md), Bash). The ID is how the task is managed:

- **Check output**: read the output file the tool names.
- **Stop it**: TaskStop with the task ID. MUST NOT use `kill` or `pkill`.
- **Wait on it**: the completion notice, or Monitor; never `sleep`.

A process started outside the session (by the user in a terminal) is not the session's task: MUST ask the user to stop or restart it.

### Port conflicts (EADDRINUSE)

When a dev server fails with EADDRINUSE, a process already holds the port:

1. If this session started the server, stop that task with TaskStop.
2. Otherwise the process is not the session's. `lsof -i :<port>` MAY name it. Then ask: "Port N is in use by `<process>`, started outside this session. Can you stop it?"
3. MUST NOT run `kill` or `pkill`, or ask for permission to.

MUST NOT retry the server start until the user says the port is free.

## Searching other repos

Another repo is read through the project's `clones/<name>`, MUST NOT be read by a path into another project folder, and a blocked read outside is the boundary working, not an obstacle. `clones/` is read-only. Still one simple command per call:

- Wrong: `find clones/<name> -name "*.ts" -exec grep -l "pattern" {} \; 2>/dev/null | head -10`
- Right: `grep -rln --include="*.ts" "pattern" clones/<name>`
- Wrong: `ls ~/Projects/<other-project>/repo/src/components/`
- Right: `ls clones/<name>/src/components/`

MUST NOT search the whole filesystem. When the clone is missing, MUST ask the user before cloning it.

## Subagents

How to brief a subagent is the `rules` skill's core `subagent-briefing` rule (`references/core/subagent-briefing.md` in the `rules` skill): a subagent that will use the shell gets the project's `bash-simplicity` rule pasted word for word. What is specific to the shell:

- The primary agent owns what comes back. A subagent's plan or command with a forbidden operator MUST NOT be run: reject it and ask for a re-plan, or split it into simple calls.
- A subagent breaking the rule is running on a stale brief: fix the brief.

## Check before prompting

Before a command that will prompt, SHOULD check the project's wiki and its settings' permission allow rules for an approved way to run it.

- A tool run often (linter, formatter, test runner) SHOULD be a `package.json` script, so one allow rule for the package manager covers it. Where a gap shows, SHOULD suggest adding the script.
- Per the [permissions docs](https://code.claude.com/docs/en/permissions.md) ("Read-only commands"), Claude Code runs a set of read-only commands without a permission prompt in every mode. That page holds the list; SHOULD check it before adding an allow rule for a read-only command.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", explains how the skill is used and changes nothing. The answer comes from this file: what the skill does; each subcommand with one line and an example call, and what a bare call does (a skill with no subcommands gives three example requests instead); the settings and their defaults; and what works on each surface. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read this skill's own files, or write anything.
<!-- /shared:help -->
