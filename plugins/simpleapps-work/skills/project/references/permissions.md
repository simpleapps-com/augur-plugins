# Permissions and settings

The settings `/project init` writes or checks: the per-user project settings, auto mode, and the project boundary.

## Contents

- Permission defaults
- Migrating older settings
- Auto mode: no hard deny
- Project boundary

## Permission defaults

Every project SHOULD give `repo/.claude/settings.<login>.json` (loaded as `settings.local.json`) these settings (the team's practice). `env` sets variables for every session ([env-vars](https://code.claude.com/docs/en/env-vars#set-variables-in-settings-files)); `Bash(ls:*)` is the same rule as `Bash(ls *)` ([permissions](https://code.claude.com/docs/en/permissions#wildcard-patterns)); an MCP wildcard names its server literally ([permissions](https://code.claude.com/docs/en/permissions#tool-name-wildcards)).

```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY": "1",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "CLAUDE_CODE_NO_FLICKER": "1"
  },
  "permissions": {
    "allow": [
      "Bash(basename:*)",
      "Bash(dirname:*)",
      "Bash(grep:*)",
      "Bash(ls:*)",
      "Bash(lsof:*)",
      "Bash(md5:*)",
      "Bash(md5sum:*)",
      "Bash(pnpm --dir repo run:*)",
      "Bash(pnpm run:*)",
      "Bash(pwd:*)",
      "Bash(readlink:*)",
      "Bash(rg:*)",
      "Bash(sed -n:*)",
      "Bash(wc:*)",
      "Bash(which:*)",
      "mcp__plugin_augur-api_Augur_API__augur_discover",
      "mcp__plugin_augur-api_Augur_API__augur_get",
      "mcp__plugin_augur-api_Augur_API__augur_list"
    ],
    "ask": [],
    "deny": [
      "Bash(cd:*)",
      "Bash(kill:*)",
      "Bash(pkill:*)"
    ]
  }
}
```

The env variables ([env-vars](https://code.claude.com/docs/en/env-vars#variables)): `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` turns off the session quality survey; `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` turns on agent teams; `CLAUDE_CODE_NO_FLICKER` turns on fullscreen rendering, which stops terminal flicker. `CLAUDE_CODE_NO_FLICKER` MUST be `"1"`.

Every allow rule runs without a prompt, so the list holds only commands that read or run the project's own scripts (the team's practice). Left out on purpose, so each keeps its prompt: `cat` (it reads any file, outside the project and its secrets included; the Read tool is the default), `find` (`-delete` and `-exec` change files), bare `sed` (`-i` edits any file; only `sed -n` is allowed), and bare `pnpm` (`dlx` and `exec` run code from outside the project; only its `run` scripts are allowed).

The Augur API rules allow only its read tools (discover, get, list). Its create, update and delete tools change a site's live data, so they MUST NOT be allowed: each keeps its prompt. A wildcard (`mcp__plugin_augur-api_Augur_API__*`) MUST NOT be used.

Deny rules are checked before allow rules ([permissions](https://code.claude.com/docs/en/permissions#manage-permissions)). The deny list is exactly these three:

- `cd`: keeps the session inside the project folder ([layout.md](layout.md), clones/). Use `git -C repo` and path arguments instead.
- `kill`, `pkill`: protect the user's own processes. Stop a background task this session started with TaskStop; ask the user about anything else.

## Migrating older settings

When `/project init` updates an existing `settings.<login>.json`, it adds any missing `env` variable and allow or deny rule above, and migrates the older defaults, reporting each change ("moved `Bash(grep:*)` from deny to allow"):

- `Bash(awk:*)`, `Bash(for:*)`, `Bash(head:*)`, `Bash(sleep:*)`, `Bash(tail:*)` in `deny`: removed (not added to `allow`).
- `Bash(grep:*)`, `Bash(rg:*)` in `deny`: moved to `allow`, in sorted place. Claude Code on macOS, Linux and WSL often has no Grep or Glob tool, so denying the shell search leaves the agent no way to search (seen in use).
- `Bash(cat:*)`, `Bash(find:*)` in `deny` or `allow`: removed, so they prompt. `Bash(sed:*)` becomes `Bash(sed -n:*)`, and `Bash(pnpm:*)` becomes `Bash(pnpm --dir repo run:*)` and `Bash(pnpm run:*)`, in either list (why: Permission defaults).
- `Edit(~/.claude/plugins/**)`, `Write(~/.claude/plugins/**)` in `deny`: removed. A `Write(...)` rule never matches ([permissions](https://code.claude.com/docs/en/permissions#read-and-edit)), and Claude Code warns about it on every run (seen in use).
- `mcp__plugin_simpleapps_augur-api__*` (the retired plugin's server) or `mcp__plugin_augur-api_Augur_API__*` in `allow`: replaced by the three Augur API read rules above.
- An `autoMode` block in `settings.<login>.json`, `settings.local.json` or `settings.json`: reported as having no effect (below), and offered for removal.

`Bash(cd:*)`, `Bash(kill:*)` and `Bash(pkill:*)` stay in `deny`.

## Auto mode: no hard deny

`/project init` MUST NOT add an `autoMode` rule anywhere (the user, 2026-11-25: "do not hard deny anything"). The git-safety rule (a push needs the user's approval) is the guard, not a settings rule.

- Claude Code reads `autoMode` only from user settings, managed settings and the `--settings` flag, never from a project's `.claude/settings.json` or `.claude/settings.local.json` ([auto mode](https://code.claude.com/docs/en/auto-mode#where-the-classifier-reads-configuration)), so one in a project file does nothing: report it, and offer to remove it.
- The older push guardrail (`"hard_deny": ["Bash(git push:*)"]` in `~/.claude/settings.json`, from the old project setup): report it and offer to remove it. Its entries are prose, not tool patterns, and a list without `"$defaults"` replaces the built-in rules ([auto mode](https://code.claude.com/docs/en/auto-mode#override-the-block-and-allow-rules)), so it dropped Claude Code's own hard-deny rules. `~/.claude/settings.json` is outside the project: the removal MUST be shown, and made only after the user's yes.

## Project boundary

Agents stay inside `{project}/` and read other repos through `clones/`. MUST NOT suggest `permissions.additionalDirectories` ([settings](https://code.claude.com/docs/en/settings#a-committed-key-doesnt-reach-teammates)) for other project folders.

- `permissions.additionalDirectories` in `~/.claude/settings.json` listing other projects (`~/projects/*/repo`, `~/projects/*/wiki`): report it as replaced by `clones/`, and remove it only after a yes.
- A top-level `additionalDirectories` key, outside `permissions`: report it as invalid, since it fails Claude Code's settings check (seen in use), and remove it only after a yes.
