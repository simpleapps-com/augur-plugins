# Workflow

The lifecycle, each step feeding the next: `/wip <issue>` (fetches the issue and investigates) → `/strategize discuss` or `/strategize research` (when the approach is unclear) → `/code model` (when the work has decisions to prove) → `/wip implement` → `/code quality` → `/code sanity-check` → `/repo submit`.

- Most daily work ends at `/repo submit`. `/repo publish` releases plugins, less often. There is no staging deploy.
- `/wip triage` shows what is open; `/wip process` marks shipped WIPs and retires old ones.
- Tracked work lives in `wip/`, one file per piece of work, linked to its GitHub issue where there is one.
- `/repo submit` and `/repo publish` are shipping commands (`git-safety.md`).
