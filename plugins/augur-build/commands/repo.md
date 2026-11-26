---
name: repo
description: Ships a project's code through git and GitHub. Shows repo status, brings the current branch up to date with its remote, commits, submits a pull request, cleans up branches, publishes a release, deploys to staging, and files an issue when asked, on this repo or upstream on another. One skill with eight subcommands (`/repo status`, `sync`, `commit`, `submit`, `cleanup`, `publish`, `deploy`, `issue`); settings on the project's wiki Deployment page choose how each behaves, within fixed safeguards. Use when the user asks to commit, push, submit, open or merge a PR, release, publish, deploy, clean up branches, check the repo's status, sync or pull the branch from its remote, or file an issue, here or on another repo.
argument-hint: "[status | sync | commit | submit | cleanup | publish | deploy | issue | help] [...]"
---

Use the `repo` skill and run its `$ARGUMENTS` subcommand. With no argument, list the subcommands and ask which to run.
