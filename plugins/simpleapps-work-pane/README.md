# simpleapps-work-pane

**Claude Code only.** For SimpleApps staff. It does nothing in claude.ai chat or Cowork.

A **Work** pane beside the chat for a `simpleapps-work` project: what you track (your open Basecamp todos and the open issues in your watched repos), what changed since your last Sync, and a **Sync** button that brings the project's `work/` folder up to date.

```
Summary  List
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

**List** (the toggle at the top) shows the work list itself, the same items in the same order as `work/LIST.md`: Basecamp, with a heading per site, then a heading per watched repo. Each row is one line: the id, which opens the item's page in your browser; `⧉`, which copies the id (`BC1234`, `repo#123`); and the title, cut to the pane's width, so a wider pane shows more of it. Click `Basecamp` or a repo to show only that group; click it again, or `All`, for the whole list.

```
Summary  List
All Basecamp site
Basecamp
 acme
BC1234 ⧉ Fix the cart tot…
site
site#12 ⧉ Checkout erro…
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

The pane SHOULD run only in the project that holds `work/`. Installed the usual way (user scope), it loads in every project. Outside a project with `work/README.md` it stays idle: no pane, no `gh`, no checks, and `/work` says where it runs. To keep it from loading there at all, install it for yourself switched off, and let the project switch it on:

1. **The project enables it.** The project that holds `work/` lists the pane in its checked-in `.claude/settings.json` (the `simpleapps-work` project already does):
   ```json
   { "enabledPlugins": { "simpleapps-work-pane@augur": true } }
   ```
2. **You install it at user scope, then disable it at user scope**, with `simpleapps-work` for the connector:
   ```
   claude plugin install simpleapps-work@augur
   claude plugin install simpleapps-work-pane@augur --scope user
   claude plugin disable simpleapps-work-pane@augur --scope user
   ```
   Then `/reload-plugins` in any open session.
3. **Check.** In the project, `claude plugin list` shows the pane `enabled`, with a note that it is disabled in `~/.claude/settings.json` but the project's settings enable it. In any other project it shows disabled.

Step 1 is what turns the pane on: without it, step 2 leaves it off everywhere.

`--scope local` and `--scope project` fail when the project's `.claude` folder is a symlink, as it is in `simpleapps-work` (`SymlinkWriteRefusedError: Refusing to write into symlinked directory`). Claude Code will not write settings through it; use the steps above.

In a folder you have not trusted yet, no mod loads until you answer the trust prompt.

**Moving from the project's own Work pane:** a `simpleapps-work` project that still loads its own `work` mod (from `.claude/skills/work/`) MUST turn that off first. Both register `/work` and a pane named `work`, so with both loaded you cannot tell which one answers. If the project reaches Basecamp through its own `basecamp2` entry in `.mcp.json` (or any server at `https://basecamp.augur-mcp.com`), you MUST remove that entry and sign in to `simpleapps-work`'s `SimpleApps Basecamp` connector instead: Claude Code drops the plugin's connector when another server has the same URL, and this pane uses only its own connector. The pane names such a server in its `needs:` line until it is removed. The `work/` folder itself needs no change.

## Settings

In the frontmatter of `work/README.md`:

| Key | What it does |
|-----|--------------|
| `me` | Your Basecamp name and GitHub login: what is yours, and who waits on you |
| `aliases` | `<github login>=<Basecamp name>`, for one person under two names |
| `org` | The GitHub org a bare repo name is in; `simpleapps-com` when not set |
| `watch_repos` | Repos whose open issues the pane counts, checks for changes and lists: `<repo>` in the org, or `<owner>/<repo>`. When not set, none: the GitHub count is 0 and the list shows Basecamp todos only. A Sync still updates every hub's `repos`, but only a watched repo's new issues start one |
| `auto_sync` | `false` to sync only when you press Sync; on by default. It works while a session has the pane loaded, or from a scheduled check ([below](#sync-without-an-open-session)) |
| `sync_minutes` | How often it checks, 1 to 60; 5 by default |

## Sync

A Sync fetches the Basecamp todos that changed, then runs `work refresh`, which imports them, syncs each hub's GitHub issues, follows references two layers out, removes empty auto-created hubs, rewrites the site briefs, the digest (`work/README.md`), the list (`work/LIST.md`) and the chart (`work/chart.md`), and validates the whole folder. It holds `work/.lock` while it runs and logs one line to `work/sync.log`.

`work/LIST.md` is two tables, one row per item:
- **Basecamp todos** assigned to you: Site (the hub's first `sites` entry, else the hub id), BC, Title; by site, then newest first.
- **GitHub issues** open in a watched repo: Repo, Issue, Title; by repo, then issue number.

`work/list.json` is the same list, written in the same step, in groups by site and repo: the pane's List view reads it, so the two never disagree.

Every check the pane runs logs one line to `work/check.log` (`<time> <trigger> ok|failed · <what it saw> · sync started|no sync`). Each line is appended in one atomic write, and line breaks in an error become spaces. Once the log passes 400 lines it is trimmed back to the last 200. Some checks write nothing:
- a check that is not due, because another session just checked, so a gap in the log means no session was checking;
- while the connector keeps failing, a retry that still has retries to come: the first and the last failure are logged.

When there has been no ok check and no ok sync for 3 × `sync_minutes`, `work status` says `STALE` (and `"stale": true` with `--json`). The pane shows a red `stale:` line after a failed check, or when `work status` itself can't be read, going by its own record of the last ok check. A changed `sync_minutes` takes effect from the next check.

A headless check or sync waits up to 6 seconds (three 2-second waits) for the Basecamp connector to connect. A connector that connects before its tools can be called gets three more short looks. If Basecamp still can't be read, the sync refreshes GitHub anyway, but it is **partial**: it is not counted as a sync, `work/sync.log` says `partial`, and the linked todos are not fetched. So `work status` turns `STALE` while Basecamp stays unread.

## Sync without an open session

The pane checks only while a Claude Code session has it loaded. To keep `work/` current overnight or while you work elsewhere, schedule a headless check from the project folder:

```bash
claude -p "/work check" --no-session-persistence --permission-prompts none >> tmp/work-schedule.log 2>&1
```

A check syncs only when something changed (with `auto_sync` on), and it logs a line to `work/check.log` like a check in a session does. `/work sync` in its place forces a full sync every time. `--no-session-persistence` keeps the runs out of `/resume`, and `--permission-prompts none` means nothing waits for an answer. Only one sync runs at a time: the scheduler starts a new run while an old one is going only on cron, and `work/.lock` stops a second sync there. A scheduler starts jobs with a short `PATH`, so give it the folders that hold `claude`, `node` and `gh` (`which claude node gh`). Run the command by hand once first: it should print one `tracking …` line. Not yet measured: whether each headless run uses model tokens. `--output-format json` on that first run shows its cost.

Use your interval in minutes (`sync_minutes`, 5 here) and your project path in place of `~/Projects/simpleapps-work`.

**macOS (launchd).** Save as `~/Library/LaunchAgents/local.work-check.plist`, with your home folder for `YOU`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.work-check</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string><string>-c</string>
    <string>claude -p "/work check" --no-session-persistence --permission-prompts none &gt;&gt; tmp/work-schedule.log 2&gt;&amp;1</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/YOU/Projects/simpleapps-work</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/Users/YOU/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartInterval</key><integer>300</integer>
</dict>
</plist>
```

Start it with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.work-check.plist`, and stop it with `launchctl bootout gui/$(id -u)/local.work-check`. A run missed while the Mac sleeps runs once on wake.

**Linux (cron).** `crontab -e`, then:

```
*/5 * * * * cd ~/Projects/simpleapps-work && PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin claude -p "/work check" --no-session-persistence --permission-prompts none >> tmp/work-schedule.log 2>&1
```

**Linux (systemd).** `~/.config/systemd/user/work-check.service`:

```ini
[Service]
Type=oneshot
WorkingDirectory=%h/Projects/simpleapps-work
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/bin/sh -c 'claude -p "/work check" --no-session-persistence --permission-prompts none >> tmp/work-schedule.log 2>&1'
```

and `~/.config/systemd/user/work-check.timer`:

```ini
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

Start it with `systemctl --user enable --now work-check.timer`, and stop it with `systemctl --user disable --now work-check.timer`.

**Windows (Task Scheduler).**

```
schtasks /Create /SC MINUTE /MO 5 /TN work-check /TR "cmd /c cd /d %USERPROFILE%\Projects\simpleapps-work && claude -p \"/work check\" --no-session-persistence --permission-prompts none >> tmp\work-schedule.log 2>&1"
```

Stop it with `schtasks /Delete /TN work-check /F`.

**Check it works.** `tail work/check.log` shows a line for each run: `/work check` waits for the session's opening check and for any sync it started, then uses that reading, so a run doesn't exit mid-sync and writes one line. It writes a second line only when the connector was still connecting at the opening check. `work status` should not say `STALE`. A run that fails (signed out of Basecamp, `gh` signed out) is logged `failed`. If none succeeds for 3 intervals, `work status` says `STALE`. `claude -p` skips the folder trust prompt, so schedule it only in your own project folder.

## Scripts

The same scripts run from a shell, from the project folder (`work/` there is the default `--root`):

```bash
node <plugin folder>/scripts/work.ts status
```

Commands: `refresh`, `status`, `log-check` (the pane's), `brief <hub>`, `validate`, `link`, `sync-gh [hub]`, `follow [--depth N]`, `import-bc <file.json>...`, `chart [all]`, `summary`. See the [Work-Pane](https://github.com/simpleapps-com/augur-plugins/wiki/Work-Pane) wiki page.

## Privacy

The pane reads your Basecamp todos through the SimpleApps Basecamp connector and your GitHub issues through `gh`, and writes them to your project's `work/` and `tmp/` folders on your computer. It sends nothing anywhere else. When you click an id in List, it opens that item's `https://` page with your system's own opener (`open` on macOS, `xdg-open` on Linux, `explorer` on Windows); it opens nothing else.

## Develop

From the root of this repo:

```bash
claude --plugin-dir plugins/simpleapps-work-pane   # reloads on save; generates API types (gitignored)
claude plugin validate --strict plugins/simpleapps-work-pane
claude plugin test plugins/simpleapps-work-pane
pnpm quality && pnpm proofs                        # the scripts' tests (tests/work-pane/) and their proofs
```

Every decision the pane and the scripts make about a value is a proved rule: `scripts/pane-rules.ts` (model `models/WorkPane.dfy`) and `scripts/work-rules.ts` (model `models/WorkData.dfy`). The rest only reads, calls and writes. See the [Proofs](https://github.com/simpleapps-com/augur-plugins/wiki/Proofs) and [Mods](https://github.com/simpleapps-com/augur-plugins/wiki/Mods) wiki pages.
