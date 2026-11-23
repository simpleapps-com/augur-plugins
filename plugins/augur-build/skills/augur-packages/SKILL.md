---
name: augur-packages
description: Guides work on Augur ecommerce sites and apps built with the shared `@simpleapps-com/augur-*` npm packages (augur-core, augur-utils, augur-hooks, augur-server, augur-web, augur-mobile, augur-tailwind, augur-config). Checks the installed packages' docs before custom code is written in such a project, says what stays site-specific, reports outdated packages with augur-doctor, and audits a site for custom code a package already replaces (`/augur-packages audit`). Use in a project that depends on `@simpleapps-com/augur-*` packages, when adding a hook, utility, UI component, cache, auth or price formatting there, when updating its augur packages or running augur-doctor, or when asked to audit a site against the augur packages.
license: MIT
---

# Augur packages

Augur ecommerce sites and apps share code through npm packages published under `@simpleapps-com`. Custom site code is a liability: someone has to understand, test and update it. A package export is maintained once for every site. So in a project that depends on these packages, before writing a hook, utility, component, cache, auth flow or formatter, check whether a package already does it.

Key words MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Surface | What happens |
|---------|--------------|
| Claude Code | Reads the installed packages' docs and the site's code; runs the audit and augur-doctor |
| Cowork | The same, where the site's files are available (unverified) |
| Chat | Reviews pasted code against the guidance below and names the package that likely covers it, saying that the installed docs were not read |

## The installed docs are the truth

This skill points the way; it is not the API reference. Packages gain exports and new packages appear, so the installed docs win whenever they disagree with this page.

1. **List the packages:** `ls <site>/node_modules/@simpleapps-com/`. `<site>` is the folder with the site's `package.json`: the repo root, or the site's package in a pnpm workspace. There may be packages not named here.
2. **Read each package's `llms.txt`:** the platform's package list and the package's exports in brief.
3. **Read its `README.md`**, then the `EXPORTS.md` it names ("every export"), for a relevant export's API and examples, including any note on what site code it replaces. The full guide is at `https://augur.build/docs/packages`.
4. MUST NOT read `dist/`, `.d.ts` or compiled JavaScript to discover capabilities: they are build output, and incomplete.

| Package | Covers |
|---------|--------|
| `augur-core` | The foundation: proxy infrastructure, cache keys, method classification, shared types |
| `augur-utils` | Shared types, cache configuration, utility functions |
| `augur-hooks` | React Query hooks and Zustand stores, for web and React Native |
| `augur-server` | Server-side utilities: Redis caching, SDK helpers, auth |
| `augur-web` | React UI components (Radix and Tailwind) |
| `augur-mobile` | React Native and Expo adapters: offline sync, biometrics, push |
| `augur-tailwind` | The Tailwind v4 theme, with HSL variables |
| `augur-config` | Tooling presets (ESLint and others), and `augur-doctor` |

## Before writing custom code

1. Search every installed package's `llms.txt`, `README.md` and `EXPORTS.md` for the function, hook or concept.
2. **An export exists:** use it. If it does not behave as documented, report a bug on the package; MUST NOT reimplement it in the site.
3. **None exists, and other sites would need it:** suggest it as a package addition (what it does, which sites benefit, why it belongs in a package). The packages' source repo is the `repository` in the package's `package.json`; it may be private. Someone with access files the request there through `/repo issue`, with the user's yes. Anyone else sends it to SimpleApps, the packages' publisher.
4. **Before reporting a package gap:** search every package's docs for it first. Found means the gap is the site's adoption, not the package.

## What stays in the site

These MUST NOT be replaced by package code:

- Server actions (`"use server"`): the site's business logic
- Layout components (header, footer, menus): the brand
- Domain components (product item, cart table, category card), which compose the package's UI primitives
- Auth callbacks, injected into the package's auth factory
- Cart mutation callbacks, which call the site's server actions
- CSS variable overrides: brand colours, fonts, radius
- `next.config`: image domains, redirects, security headers
- Site integrations: analytics, maps, reCAPTCHA

## Platform standards

- Icons: `react-icons/lu`
- Tailwind v4, CSS-first (no `tailwind.config.*` file)
- Validation: Valibot (not Zod or Yup)
- Auth: NextAuth 5 through the package's auth factory
- To model a change on an existing site, ask the user which site to use as the reference

## Keeping the packages current

Each package releases on its own CalVer version (`YYYY.M.seq`); nothing requires them to share one. `augur-doctor` (in `augur-config`) checks each against its own latest release, and the platform standards above.

1. **Check:** `pnpm --dir <site> exec augur-doctor .`, or the site's `augur-doctor` script. Report what it flags.
2. **Update only when the user asks**, or says yes to the report. MUST NOT update packages as a side effect of other work: it rewrites `package.json` and the lockfile.
3. **Update** the flagged packages to their latest with `--latest` (a plain `update` stays inside the manifest's range, and a CalVer year change counts as a major): `pnpm --dir <site> update --latest @simpleapps-com/<package> ...`. In a pnpm workspace, for the site's package: `pnpm --dir <repo> --filter <site-name> update --latest @simpleapps-com/<package> ...`, then `pnpm --dir <repo> install` at the root so the root lockfile matches (CI installs with `--frozen-lockfile`).
4. **Then** run `augur-doctor` again and the project's checks (`/code quality check`), and say that `package.json` and the lockfile changed, to be committed together.

## Subcommand

| Subcommand | Does | Steps |
|------------|------|-------|
| `audit` | Finds custom site code that an installed package already replaces; a report, changes nothing | [references/audit.md](references/audit.md) |

After the audit, report and stop: MUST NOT change code or file issues unless the user asks.
