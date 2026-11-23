# Triage

Where the repo's work stands: open PRs, issues with and without a WIP, blocked and unlabelled issues, and every WIP. It prints the result and stores nothing. It covers one repo; a person's Basecamp todos across projects are the Work pane's job.

## Steps

Each command separate:

1. `gh pr list --repo <R> --state open --json number,title,body,headRefName --limit 100`
2. `gh issue list --repo <R> --state open --json number,title,labels,body --limit 100`
3. `ls <wip-dir>`, then Read each WIP's frontmatter, title, Source cross-references and the first line of Problem.
4. **Link them.**
   - A PR links an issue when its title, body or branch names it (`#42`, `fixes #42`, `closes #42`, `resolves #42`, `fix/42-...`).
   - An issue has a WIP when a WIP's `issue` URL is that issue of `<R>`, or its cross-references point at it (a `BC` WIP tracking that issue). A `GH<N>-*.md` file name counts only for issue N of `<R>`.
5. **Labels:** `gh label list --repo <R>`, so a suggestion for an unlabelled issue uses a label the repo has.
   - An issue is blocked when it has a `blocked` label or "Blocked by" in its body; note the upstream reference.

## Report

```
### Open PRs
| PR | Title | Linked issues |

### Open issues without a WIP
| Issue | Title | Labels | PR |

### Blocked issues
| Issue | Title | Blocked by |

### Unlabelled issues
| Issue | Title | Suggested label |      suggested only; MUST NOT apply

### WIPs
| File | Status | Issue | PR | Summary |     in-progress, open, shipped, abandoned; then by name

Summary: X PRs, Y issues without a WIP, Z unlabelled, B blocked, W WIPs
```

Sections with nothing in them are left out. This skill never applies a label: it shows the `gh issue edit <N> --repo <R> --add-label <label>` command for the user to run.
