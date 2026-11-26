# Conventional Commits

The message format for every commit, PR title and release commit `repo` makes. Spec: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>[(scope)][!]: <description>

[body]

[footers]
```

- **Types:** `feat` (a feature), `fix` (a bug fix), and `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `style`, `test`.
- **Scope** is optional, in parentheses: `feat(parser):`. Use the area the repo already uses in its history (`git log --oneline -20`).
- **Description:** imperative, lower case, no full stop, the subject line under 72 characters.
- **Body:** after one blank line. Why the change was made, and what a reviewer needs; not a file-by-file list.
- **Footers:** after one blank line, for an issue the user named or the branch carries: `Closes #N` when the work merged is the issue's build work, so the merge closes it; a live check the user runs later, elsewhere, does not keep it open and is named in the report instead. `Refs #N` only when the issue has build work still to do after this change. Tokens use hyphens (`Acked-by`). Add any attribution lines the host asks for.
- **Breaking change:** `!` before the colon, or a `BREAKING CHANGE: <what>` footer (upper case).

Write the message to `<scratch>/commit-msg.txt` and commit with `git -C <repo> commit -F <absolute path>`, so quoting never breaks it. Delete the file after the commit.

A PR title is the subject line of its main commit. Release commit messages: [publish.md](publish.md), step 3.
