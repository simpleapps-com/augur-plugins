# Verify

## Does

Walks the wiki's `Testing.md` checklist in a real browser and checks each item.

- **`/code verify`**: also fixes what fails, and re-checks until it passes.
- **Any other request** ("check it in the browser"): reports only.

It needs Claude Code with a browser tool (Claude in Chrome, or the built-in browser); without one, say so and stop.

## Reads

`Testing.md` in the wiki: its checklist (`- [ ]` items, grouped by section), test data (accounts, items, URLs), and the `code-dev-script` and `code-dev-url` settings.

## Steps

1. **Checklist.** Read `Testing.md`. No page, or no checklist: say so and stop; `/wiki curate` can draft one.
2. **Environment.** `code-dev-url`, or the URL the page names. For a local server not already running: start `pnpm --dir <repo> run <code-dev-script>` in the background and wait for its "ready" line. A failed start: stop and report the error.
3. **Browser.** Connect, and open a new tab. A failed connection: retry twice, a few seconds apart, before reporting.
4. **Walk.** For each section: open the page; check it for an error overlay first (read the whole error, stack and source location before anything else); check each item; record pass or fail, and for a fail what was expected and what was seen. MUST NOT mark an item passed without checking it. Approach it as a tester who did not write the code.
5. **Fix** (`/code verify` only). Fix each failure and error overlay at its cause, then re-check the failed items until they pass. A failure that is not the code's (the environment, test data, a third-party service): report it, do not work around it.

## Writing the wiki settings

`Testing.md` holds the checklist. Items MUST be concrete and checkable ("the cart total shows $9.26", not "cart works"), with the test data they need. Set `<!-- code-dev-script: dev -->` and `<!-- code-dev-url: http://localhost:3000 -->` when the defaults do not fit. Detect from the manifest's `dev` script, the framework's default port, and `.env.example`.

## Safeguards

- The browser acts only on the checklist's steps, on the environment it names.
- On a site that is not local (staging, production): MUST NOT submit forms, place orders, send messages, or change data, unless the checklist item says to and the environment is a test one. Never enter real credentials or payment details; use the test data on the page.
- Fixes edit code only. No git writes.

## Report

```
Verify: Testing.md on http://localhost:3000
- Home: 3/3
- Cart: 4/5. Fail: stock shows "Out of stock" for an in-stock item
Error overlays: none
Fixed: src/stock.ts (status mapping); re-checked, now 5/5
```
