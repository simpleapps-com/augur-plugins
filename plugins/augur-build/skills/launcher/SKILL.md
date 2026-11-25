---
name: launcher
description: Installs and keeps current `cld`, a small shell command that updates Claude Code and then starts it, passing every argument through (`cld -c` updates, then continues the last conversation). `/launcher write` puts it in the user's own bin folder on PATH, or updates it there; `/launcher audit` reports whether the installed copy matches this skill's (a report; changes nothing). Use when the user asks to install, set up, update or check `cld`, or how to start Claude Code with an update first.
license: MIT
---

# Launcher

`cld` is a shell command for macOS, Linux and WSL. It runs `claude update` (a failed update is reported and does not block), then `exec claude "$@"`, so every argument reaches `claude` unchanged. `cld -c` updates, then continues the most recent conversation.

The command's only source is this skill's copy, `${CLAUDE_SKILL_DIR}/scripts/cld`. It is copied as a file, never retyped, so the installed copy is byte for byte the skill's.

Key words MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Surface | What happens |
|---------|--------------|
| Claude Code | `write` copies the file into place after a yes; `audit` compares the installed copy with the skill's |
| Cowork | Not supported: the command belongs on the user's own machine. Behaves as chat |
| Chat | Writes nothing. Shows the script from `scripts/cld`, and says to save it as `~/.local/bin/cld` and run `chmod +x ~/.local/bin/cld` |

Plain Windows is not supported (no shell); WSL works.

## Where things are

- **`<skill-copy>`**: `${CLAUDE_SKILL_DIR}/scripts/cld`.
- **`<bin>`**: the first of `~/.local/bin` and `~/bin` that is on `PATH` (`printenv PATH`). When neither is, `~/.local/bin`, and the report gives the line to add to the user's shell profile; the skill never edits a shell profile.
- **`<target>`**: `<bin>/cld`.
- **Ours**: a file is this skill's when it contains the line `Written by the augur-build \`launcher\` skill`.

`printenv PATH` and `command -v cld` run in Claude Code's shell, whose `PATH` can differ from the user's terminal (Claude Code adds plugin folders, for example). The report says so, and that `command -v cld` in a new terminal shows which `cld` the user's terminal runs.

## Subcommands

Run as `/launcher <subcommand>`.

### `audit`

Read-only. Changes no file.

1. `printenv PATH`, then work out `<bin>` and `<target>`.
2. `command -v cld`, and `ls -la <target>`.
3. When `<target>` exists: `diff <target> ${CLAUDE_SKILL_DIR}/scripts/cld`.
4. Report one of:
   - **Current**: `<target>` matches the skill's copy.
   - **Out of date**: it is ours and differs. Show the diff and offer `/launcher write`.
   - **Edited by hand or not ours**: it differs and is edited, or lacks the "ours" line. Show the diff; `write` replaces it only on a yes that names it.
   - **Not installed**: no `<target>`. Offer `/launcher write`.
5. Also report:
   - any other `cld` that `command -v cld` finds first, and whether `<bin>` is on `PATH`;
   - a `cld` under a plugin folder (a path containing `/.claude/plugins/`): it comes from an older plugin and goes when that plugin is uninstalled;
   - whether `<target>` is executable.

### `write`

1. Run the `audit` steps.
2. Current: report it and stop.
3. Show the plan: `<target>`, whether it is new or replaces a file, the diff, and the `PATH` line when `<bin>` is not on `PATH`. Ask for a yes.
4. On a yes, and only then:
   1. `mkdir -p <bin>` when `<bin>` does not exist;
   2. `cp ${CLAUDE_SKILL_DIR}/scripts/cld <target>`;
   3. `chmod +x <target>`;
   4. `diff <target> ${CLAUDE_SKILL_DIR}/scripts/cld`, which MUST print nothing.
5. Report what was written, and that a new terminal (or `hash -r`) picks it up.

## Safeguards

- **Approval.** Writes only when the user typed `/launcher write`, or asked in their own words for `cld` to be installed or updated, and then only after showing the plan and getting a yes. The yes covers `<target>` and creating `<bin>`, nothing else. When the model picked this skill for another request, it runs `audit` and stops.
- **Commands.** Only these: `printenv PATH`, `command -v cld`, `ls -la <bin>` or `<target>`, `diff <target> ${CLAUDE_SKILL_DIR}/scripts/cld`, and, for `write` after the yes, `mkdir -p <bin>`, `cp ${CLAUDE_SKILL_DIR}/scripts/cld <target>` and `chmod +x <target>`. No `sudo`, no other folder, no shell profile edits, no deletes, no git.
- **Never retype the script.** It is always copied from `<skill-copy>`. In chat, show that file's text unchanged.
- **Another `cld`.** A `cld` elsewhere on `PATH` is reported, never removed or edited.
- **Blocked outside the project.** `<bin>` is outside the project folder, so Claude Code may prompt for, or its sandbox may refuse, a read or write there. A refused step is reported as not checked or not written, never worked around with another command; the report gives the exact commands for the user to run themselves (in Claude Code, typed with a leading `!`).
