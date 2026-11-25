---
name: repo
description: Ships a project's code through git and GitHub. Shows repo status, commits, submits a pull request, cleans up branches, publishes a release, deploys to staging, and files an issue when asked. One skill with seven subcommands (`/repo status`, `commit`, `submit`, `cleanup`, `publish`, `deploy`, `issue`); settings on the project's wiki Deployment page choose how each behaves, within fixed safeguards. Use when the user asks to commit, push, submit, open or merge a PR, release, publish, deploy, clean up branches, check the repo's status, or file an issue.
argument-hint: "[status | commit | submit | cleanup | publish | deploy | issue | help] [...]"
---

Use the `repo` skill and run its `$ARGUMENTS` subcommand. With no argument, list the subcommands and ask which to run.
