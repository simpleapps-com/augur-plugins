# Deploy

## Does

Deploys a pushed branch to staging, by the script or workflow `repo-deploy` names. Invoking it is the approval for that one deploy.

## Reads

`repo-deploy` (required) and `repo-branch` on `Deployment.md`.

## Steps

1. **Settings.** `repo-deploy` unset: say so, and offer to draft it (below). Show the draft; on the user's approval write it to `Deployment.md`, uncommitted; then stop. MUST NOT deploy in this run. `none`: the project has no staging; say so and stop.
2. **State.** `git -C <repo> fetch origin`; `git -C <repo> status --porcelain` is empty; `git -C <repo> rev-parse HEAD` equals `git -C <repo> rev-parse origin/<branch>`. Otherwise stop: a deploy of work that is not pushed cannot be reproduced.
3. **Deploy.**
   - `script:<name>`: `pnpm --dir <repo> run <name>` (or the manifest's equivalent).
   - `workflow:<file>`: the file MUST exist in `<repo>/.github/workflows/`. `gh workflow run <file> --repo <R> --ref <branch>`; then find the run (`gh run list --repo <R> --workflow <file> --branch <branch> --limit 1 --json databaseId`) and `gh run watch <id> --repo <R> --exit-status`.
4. **Verify.** The script's exit status or the run's conclusion. A failure: stop and report.

## Writing the wiki settings

- **Workflows:** a file in `.github/workflows/` with `workflow_dispatch` and "deploy" or "staging" in its name → `workflow:<file>`.
- **Scripts:** a `deploy:staging` or `deploy` script → `script:<name>`.
- **No staging:** `none`, so the subcommand says so instead of offering a draft each time.
- **Ask:** "Is there a staging environment? What deploys to it?"

Example: `<!-- repo-deploy: workflow:deploy-staging.yml -->`

## Safeguards

Writes allowed: `pnpm --dir <repo> run <name>` for `script:<name>`; `gh workflow run <file> --repo <R> --ref <branch>` and `gh run watch <id> --repo <R> --exit-status` for `workflow:<file>`. Staging only: a production deploy belongs to `publish`.

## Report

What was deployed (branch and commit), the script or run and its result, and the run's URL.
