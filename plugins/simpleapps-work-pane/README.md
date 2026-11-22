# simpleapps-work-pane

**Claude Code only.** For SimpleApps staff. It does nothing in claude.ai chat or Cowork.

A **Work** pane beside the chat for a `simpleapps-work` project: what you track (your open Basecamp todos and the open issues in your watched repos), what changed since your last Sync, and a **Sync** button that brings the project's `work/` folder up to date.

```
Tracking 14
 Basecamp todos 9
 GitHub issues 5

Open GitHub issues
site: 3
tool: 12

[Sync] 2 Basecamp · 1 GitHub changed
synced 09:41
checked 10:02
```

Open it with `/work`. `/work sync` syncs, and `/work check` prints one line about the last check, which works without seeing the pane (`claude -p "/work check"`). Press `s` in the pane to sync. It checks every `sync_minutes` (5 by default); a check in one session counts for every open session, so each interval is checked once.

This plugin is a **mod**: TypeScript that runs inside Claude Code with your permissions. It is its own plugin, so it can be turned off on its own in `/plugin`.

## What it needs

- A session opened in a `simpleapps-work` project: the pane reads and writes that project's `work/` folder where it is, and keeps the Basecamp records it fetches in the project's `tmp/` folder. It moves nothing.
- The **simpleapps-work** plugin, with its **SimpleApps Basecamp** connector signed in (`/mcp`). The pane reads your todos through it; it needs no tools allowed, since a mod's own connector calls ask no permission.
- **Node 22.18 or later** on the PATH, which runs the work scripts (TypeScript, no build step).
- The **GitHub CLI**, signed in (`gh auth login`), for issue counts and syncing issues.

When one of these is missing, the pane says so under the counts (`needs: …`).

## Install

Tested with Claude Code 2.1.330.

```
/plugin install simpleapps-work --marketplace simpleapps-com/augur-plugins
/plugin install simpleapps-work-pane --marketplace simpleapps-com/augur-plugins
/reload-plugins
```

In a folder you have not trusted yet, no mod loads until you answer the trust prompt.

**Moving from the project's own Work pane:** a `simpleapps-work` project that still loads its own `work` mod (from `.claude/skills/work/`) MUST turn that off first. Both register `/work` and a pane named `work`, so with both loaded you cannot tell which one answers. If the project reaches Basecamp through its own `basecamp2` entry in `.mcp.json`, install and sign in to `simpleapps-work` as well: this pane uses that plugin's `SimpleApps Basecamp` connector, not `basecamp2`. The `work/` folder itself needs no change.

## Settings

In the frontmatter of `work/README.md`:

| Key | What it does |
|-----|--------------|
| `me` | Your Basecamp name and GitHub login: what is yours, and who waits on you |
| `aliases` | `<github login>=<Basecamp name>`, for one person under two names |
| `org` | The GitHub org a bare repo name is in; `simpleapps-com` when not set |
| `watch_repos` | Repos whose open issues the pane counts: `<repo>` in the org, or `<owner>/<repo>`; the hubs' repos when not set |
| `auto_sync` | `false` to sync only when you press Sync; on by default |
| `sync_minutes` | How often it checks, 1 to 60; 5 by default |

## Sync

A Sync fetches the Basecamp todos that changed, then runs `work refresh`, which imports them, syncs each hub's GitHub issues, follows references two layers out, removes empty auto-created hubs, rewrites the site briefs, the digest (`work/README.md`), the list (`work/LIST.md`) and the chart (`work/chart.md`), and validates the whole folder. It holds `work/.lock` while it runs and logs one line to `work/sync.log`.

The same scripts run from a shell, from the project folder (`work/` there is the default `--root`):

```bash
node <plugin folder>/scripts/work.ts status
```

Commands: `refresh`, `status`, `brief <hub>`, `validate`, `link`, `sync-gh [hub]`, `follow [--depth N]`, `import-bc <file.json>...`, `chart [all]`, `summary`. See the [Work-Pane](https://github.com/simpleapps-com/augur-plugins/wiki/Work-Pane) wiki page.

## Privacy

The pane reads your Basecamp todos through the SimpleApps Basecamp connector and your GitHub issues through `gh`, and writes them to your project's `work/` and `tmp/` folders on your computer. It sends nothing anywhere else.

## Develop

From the root of this repo:

```bash
claude --plugin-dir plugins/simpleapps-work-pane   # reloads on save; generates API types (gitignored)
claude plugin validate --strict plugins/simpleapps-work-pane
claude plugin test plugins/simpleapps-work-pane
pnpm quality && pnpm proofs                        # the scripts' tests (tests/work-pane/) and their proofs
```

Every decision the pane and the scripts make about a value is a proved rule: `scripts/pane-rules.ts` (model `models/WorkPane.dfy`) and `scripts/work-rules.ts` (model `models/WorkData.dfy`). The rest only reads, calls and writes. See the [Proofs](https://github.com/simpleapps-com/augur-plugins/wiki/Proofs) and [Mods](https://github.com/simpleapps-com/augur-plugins/wiki/Mods) wiki pages.
