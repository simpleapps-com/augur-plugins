# Create or refresh a WIP

For `/wip` with a reference, `/wip` alone, and `/wip` with other text.

## Steps

1. **Resolve** the argument (grammar in `SKILL.md`) to a source item and, if one exists, its WIP.
   - **A reference:** the source item. Its WIP is the one whose `issue` URL is this item (same owner, repo and number for GitHub; same URL for Basecamp), or whose Source cross-references point at it. A `GH<N>-*.md` file name counts only for issue N of `<R>`.
   - **`/wip` alone:** the WIP for the current work. With `branch` = `git -C <repo> branch --show-current`: first a WIP whose frontmatter `branch` equals it; else, if the branch carries a number (`fix/42-...`), the WIP whose issue is #42 of `<R>`; else the only `open` or `in-progress` WIP. Neither, or several: list them and ask. A freeform WIP has nothing to fetch: bump `last_reviewed`, report its status and unticked criteria, stop.
   - **Other text:** propose the title and file name ([schema.md](schema.md)), and wait for the user's yes before writing.
2. **Fetch** the whole source item.
   - GitHub: `gh issue view <N> --repo <owner>/<repo> --json title,body,comments,labels,assignees,state`.
   - Basecamp: the connector's tool for the item's type, with every comment, the assignee and every attachment the connector can return. If it has no tool for the item's type or for attachments, record each attachment's name and link and say it could not be read.
   - Note links to the other system in the body and comments (a GitHub issue in a Basecamp todo, or the reverse) as cross-references.
3. **No WIP yet: create.** Write `<wip-dir>/<name>.md` per [schema.md](schema.md): frontmatter (`status: open`, today's dates), Source, Problem, the explicit Acceptance criteria from the source, every attachment summarised, the comments. Write the explicit criteria before reading any code, so the code cannot shape them.
   - **With `only`**, or in chat: stop after step 5 and report. In chat nothing is written: show the WIP text and the file name to save it as.
   - **Otherwise**, after step 5, carry straight on into [investigate.md](investigate.md) for this WIP.
4. **A WIP exists: refresh.** Compare the fetched item with the file:
   - frontmatter: a closed issue whose WIP is still `open` or `in-progress` is left for `process` to mark; report it;
   - Problem: update it when the source body changed;
   - Acceptance criteria: append a `- [ ]` for each explicit ask in a new comment or edited body not already covered; MUST NOT change existing ones;
   - Attachments: download and summarise each one whose id is new;
   - Comments: append new ones (by author and date); never duplicate or remove;
   - cross-references: add new ones;
   - MUST NOT touch Research, Analysis, Implementation, Files to modify, or anything else the user edited.

   Bump `last_reviewed`, and say whether the change warrants `/wip investigate` again: a new requirement, a changed scope, or new evidence such as a screenshot of a bug.
5. **Record the branch.** When the current branch is not `<default>` and belongs to this WIP (it equals the frontmatter `branch`, or carries the number of the WIP's issue), write `branch` if empty, and `pr` from `gh pr list --repo <R> --head <branch> --json url` if empty.

## Report

New: the file, title, number of criteria, attachments (and any that could not be read), cross-references, and whether investigation followed. Refresh: what changed (new comments, criteria, attachments), what was preserved, and whether to re-investigate.
