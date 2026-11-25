---
name: augur-packages
description: Guides work on Augur ecommerce sites and apps built with the shared `@simpleapps-com/augur-*` npm packages (augur-core, augur-utils, augur-hooks, augur-server, augur-web, augur-mobile, augur-tailwind, augur-config). Checks the installed packages' docs before custom code is written in such a project, says what stays site-specific, reports outdated packages with augur-doctor, and audits a site for custom code a package already replaces (`/augur-packages audit`). Use in a project that depends on `@simpleapps-com/augur-*` packages, when adding a hook, utility, UI component, cache, auth or price formatting there, when updating its augur packages or running augur-doctor, or when asked to audit a site against the augur packages.
argument-hint: "[audit | help]"
---

Use the `augur-packages` skill and run its `$ARGUMENTS` subcommand. With no argument, list the subcommands and ask which to run.
