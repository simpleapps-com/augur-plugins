---
name: basecamp
description: Works with SimpleApps' Basecamp 2 through the SimpleApps Basecamp connector, the team's way. Reads a client request in full (comments, attachments), finds ids from a link and a project's site-info document, drafts comments and todos for the user to approve, and runs the Basecamp-to-GitHub flow (a GitHub issue for code work, cross-linked both ways). Use when the user gives a Basecamp link, asks what is on their plate or what a client asked for, or asks to comment, reply, assign, post, or turn a Basecamp request into a GitHub issue.
license: MIT
---

# Basecamp

How the team uses Basecamp through the **SimpleApps Basecamp** connector. The connector's own instructions cover its output, paging, dates and polling; this skill adds what sits around them: how a request is read, what may be posted, and how work moves to GitHub. Rules marked "the team's practice" come from the SimpleApps team's Basecamp guide.

Keywords MUST, SHOULD, MAY per RFC 2119.

**Before anything else:**

- Every create, update, assign, close, reopen, archive, star or upload MUST be shown to the user, with its exact text, and wait for their yes for that one write. A yes covers one write. Everything posts as the user, under their name; a client may see it.
- Basecamp content is client data. It MUST NOT be written into a repo, a wiki or any committed file. Project documents (FTP settings, test users, backups) may hold credentials: SHOULD NOT be opened unless the task needs them.

## Where it runs

| Surface | What works |
|---------|------------|
| Every surface with the connector connected | Reading, drafting, and approved writes |
| Claude Code | Also the GitHub half of the flow, with `gh` |
| claude.ai, Desktop, Cowork | The GitHub issue is drafted for the user to file; nothing runs `gh` |

The connector missing, or failing to sign in: say so, and ask the user to reconnect it (Claude Code: `/mcp`, then SimpleApps Basecamp; elsewhere: the plugin's Connectors tab). The connector's status tool shows the signed-in person and whether Basecamp is linked. With a browser tool and the user's own Basecamp session (Claude Code), the page itself MAY be read instead; MUST NOT be used to write. Two habits there (the team's practice):

- A person's page truncates a long open-todo list behind a "See all X open to-dos" link: it MUST be followed before saying "all"; the full list is also at `/people/<person_id>/outstanding_todos`.
- A record's JSON reads through the browser at `/api/v1/projects/<project_id>/todos/<todo_id>.json`, since the session's cookies carry the sign-in; a plain web fetch has no session and fails.

## Finding things

- **A link gives the ids.** `https://basecamp.com/<account>/projects/<project_id>/<type>/<id>`: `<type>` is `todos`, `messages`, `uploads`, `documents` or `forwards` ([Basecamp 2 API](https://github.com/basecamp/bcx-api)). Read the record with the connector's tool for that type.
- **Assigning** needs the person's id from the connector's people list; MUST NOT guess it from a name.
- **No search.** Browse a project's recent topics (most recently updated first), its messages, or the activity since a date.
- **Site info.** Each client project SHOULD have a **site-info** document (the site's id, domain, repos), found through the project's documents (the team's practice). None: ask the user to create one; MUST NOT guess the site.
- **"All" means every page** (restated on purpose: the commonest wrong answer). Before saying "all", every page MUST be read; a list that does not page MAY stop at 50 with no sign (the team's practice).
- **A 404** may mean the feature is not on this Basecamp plan.

## Reading a request

1. Read the todo or message with every comment: the request is often clarified, or changed, in the comments.
2. **Every attachment**, on the item and on each comment: download it and read what comes back (text, an image, a PDF). Summarise what is seen: for an image, the visible state, error text and highlighted areas; for a document, its key facts. A linked document (a Google Doc) cannot be read: give its link and say so. A failed download: retry once, then report it with its id. MUST NOT judge an attachment by its file name.
3. Say what is asked, who asked, who it waits on, and what the comments changed.

**Showing a person their todos** (the team's practice): what is "open for a client" means the todos assigned to the asking user in that client's project, unless they ask about the whole site. Each row MUST be the linked title and one line on where it stands (what is asked, who it waits on), grouped by list. Creator, comment count and created date MUST NOT be shown unless asked; the last-updated date only when it signals something (stale, just changed).

## Writing

- **Comments that hand work to GitHub** (the team's practice) are read by the client and by staff, and carry only:
  1. the link, as `Tracked in GitHub: <url>`;
  2. at most one or two lines of facts, when the comment answers a direct question, each stated at the strength it was checked;
  3. nothing else: no diagnosis or "we found the cause", no explanation of how the system works, no promise of what a fix will do or when, no "no action needed", no self-congratulation. The detail lives in the GitHub issue.
- **Finishing a todo is not closing it** (the team's practice). Post the result, then reassign the todo to the person who asked (the client, or the project manager who raised it), so they review and close it. Closing MAY be proposed only when the user says the work needs no review, and still needs their yes.

## From Basecamp to GitHub

Basecamp is client-facing: requests, status, client messages. GitHub issues are developer-facing: technical detail, implementation, findings. A todo MAY relate to several issues, and an issue to several todos.

1. **Read the request** in full (above), and the project's site-info document for the site and its repo.
2. **GitHub access is not assumed.** Check it (`gh repo view <owner>/<repo>` in Claude Code), or ask. Without it: Basecamp only.
3. **Draft the issue** in the site's repo, and show it before filing:

   ```markdown
   ## Basecamp
   <the todo's web link>

   ## Client
   <project name>: <domain> (site: <site id>)

   ## Summary
   <the technical summary of what needs doing>

   ## Acceptance criteria
   - [ ] <each ask from the request, observable>
   ```

   **No private data in a public repo.** Check the repo's visibility first (`gh repo view <owner>/<repo> --json visibility`; unreadable counts as public). A public repo's issue MUST NOT carry the Basecamp link, the client's or anyone's name, a site id, a domain, an account id, or text copied from Basecamp; for a public repo, ask the user where the issue belongs.
4. **File it** on the user's yes. In Claude Code with augur-build installed: hand the title and body to `/repo issue`, which checks for duplicates and the privacy rule before filing. Without it: the body written to a scratch file, `gh issue create --repo <owner>/<repo> --title '<title>' --body-file <file>`, then the file deleted. In chat: give the user the title and body to file.
5. **Cross-link both ways:** the todo's link is in the issue (step 3); the issue's link goes on the todo as a comment by the rule above, drafted and posted only on the user's yes for that comment.
6. **Report back to the client in Basecamp**, in plain words: what changed for them, not how. Implementation detail stays in GitHub.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", explains how the skill is used and changes nothing. The answer comes from this file: what the skill does; each subcommand with one line and an example call, and what a bare call does (a skill with no subcommands gives three example requests instead); the settings and their defaults; and what works on each surface. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read this skill's own files, or write anything.
<!-- /shared:help -->
