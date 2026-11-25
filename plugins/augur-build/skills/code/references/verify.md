# Verify

## Does

Walks the wiki's `Testing.md` checklist in a real browser and checks each item, then measures Core Web Vitals and the Lighthouse performance score on the pages the project names, so a slow page fails before it ships.

- **`/code verify`**: also fixes what fails, and re-checks until it passes.
- **Any other request** ("check it in the browser"): reports only.

It needs Claude Code with a browser tool (Claude in Chrome, or the built-in browser); without one, say so and stop.

## Reads

`Testing.md` in the wiki: its checklist (`- [ ]` items, grouped by section), test data (accounts, items, URLs), and the `code-dev-script`, `code-dev-url` and `code-vitals-*` settings.

## Steps

1. **Checklist.** Read `Testing.md`. No page, or no checklist: say so and stop; `/wiki curate` can draft one.
2. **Environment.** `code-dev-url`, or the URL the page names. For a local server not already running: start `pnpm --dir <repo> run <code-dev-script>` in the background and wait for its "ready" line. A failed start: stop and report the error.
3. **Browser.** Connect, and open a new tab. A failed connection: retry twice, a few seconds apart, before reporting.
4. **Walk.** For each section: open the page; check it for an error overlay first (read the whole error, stack and source location before anything else); check each item; record pass or fail, and for a fail what was expected and what was seen. MUST NOT mark an item passed without checking it. Approach it as a tester who did not write the code.
5. **Fix** (`/code verify` only). Fix each failure and error overlay at its cause, then re-check the failed items until they pass. A failure that is not the code's (the environment, test data, a third-party service): report it, do not work around it.
6. **Web vitals.** Read by "Reading Core Web Vitals" below. No `code-vitals-pages`: report "Web vitals: not set up" and stop here. Check each value against the format in `SKILL.md` Settings before using it; a value that fails is reported and skipped, never quoted or escaped into shape. For each page, mobile:
   - **A path on the dev URL:** run `pnpm --dir <repo> run <code-vitals-script> -- <url>`. No such script in the manifest: say so, suggest one that runs [Lighthouse](https://github.com/GoogleChrome/lighthouse) on the URL with a JSON report, and MUST NOT add it without the user's yes. A local run is lab data only, and SHOULD be a production build rather than a dev server (the team's practice: a dev server's numbers are not what users get).
   - **An `https://` URL:** a PageSpeed Insights request with `strategy=mobile` (the fields are below). The URL goes to Google, and PSI reaches only public pages: a staging site behind a login or a private network cannot be measured this way; say so and use the local route. PSI cannot reach a local server.
   - **Pass:** a lab score at or above `code-vitals-score`; LCP good (Lighthouse marks ≤ 2.5 s green on mobile: [Chrome: Lighthouse LCP](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-largest-contentful-paint)); CLS ≤ 0.1 and TBT good for mobile (the team's practice: the field CLS threshold and Lighthouse's TBT band applied to one lab run); and, where PSI has field data, the page passing Core Web Vitals. Anything else fails, named by metric with the top Lighthouse audits behind it.
   - **Fix** (`/code verify` only): fix the cause the audits name (the LCP image, a render-blocking script, a layout shift), then measure again. A borderline score is measured three times and the median used. MUST NOT lower `code-vitals-score` or drop a page to make it pass.

<!-- shared:web-vitals -->
## Reading Core Web Vitals

Google's "good" thresholds, at the 75th percentile of page loads ([web.dev: Web Vitals](https://web.dev/articles/vitals); [PageSpeed Insights: About](https://developers.google.com/speed/docs/insights/v5/about)):

| Metric | Good | Poor |
|--------|------|------|
| LCP (Largest Contentful Paint) | ≤ 2,500 ms | > 4,000 ms |
| INP (Interaction to Next Paint) | ≤ 200 ms | > 500 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | > 0.25 |

A page passes Core Web Vitals when all three are good ([web.dev: Web Vitals](https://web.dev/articles/vitals)). The Lighthouse performance score (0 to 100) is good from 90, needs improvement from 50 to 89, and is poor below 50 ([Chrome: Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)). Google Search says good Core Web Vitals align with what its core ranking systems reward ([Google Search Central: Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)).

- **Field data is what users get; lab data is one test run** ([web.dev: lab and field data](https://web.dev/articles/lab-and-field-data-differences)). Field data comes from real Chrome users over the previous 28 days ([PageSpeed Insights: About](https://developers.google.com/speed/docs/insights/v5/about)) and decides whether a page passes. Lab data (Lighthouse) shows why, and is the only data for a page without traffic or not yet live. A report MUST say which each number is, and MUST NOT present a lab number as what users experience.
- **A Lighthouse page-load run reports no INP.** INP needs real interactions, and some lab tools do not report it ([web.dev: INP](https://web.dev/articles/inp)); Lighthouse's performance score uses Total Blocking Time instead ([Chrome: Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)). TBT is a reasonable stand-in, not a substitute ([web.dev: INP](https://web.dev/articles/inp)); it is good at 0 to 200 ms on mobile, 0 to 150 ms on desktop ([Chrome: Total Blocking Time](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time)). A report MUST name TBT as the stand-in.
- **In a PageSpeed Insights response** ([API reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)): `lighthouseResult.categories.performance.score` is the lab score, 0 to 1 in Google's sample response ([Get started](https://developers.google.com/speed/docs/insights/v5/get-started)), so × 100 for the score. Field data is under `loadingExperience.metrics` (the page) and `originLoadingExperience.metrics` (the whole site), each metric with a `percentile` and a `category` (`FAST`, `AVERAGE`, `SLOW`, or `NONE`). Google's sample code reads `INTERACTION_TO_NEXT_PAINT` ([Get started](https://developers.google.com/speed/docs/insights/v5/get-started)); no Google page found names the LCP and CLS keys or their units: read the keys present, and check each value's scale against the thresholds before judging it. With too little traffic for the page, PSI falls back to the site's data ([About](https://developers.google.com/speed/docs/insights/v5/about)); say so. With none for the site either, report lab data only.
- **Mobile first.** Google indexes and ranks the mobile version of a page ([Google Search Central: mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)), and PSI defaults to desktop ([API reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)). Measure `strategy=mobile` unless asked for desktop, and name the strategy in the report.
- **One run is noisy.** Lab scores move between runs ([Chrome: why your score fluctuates](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)). A borderline result SHOULD be run three times and reported as the median (the team's practice).
- **The cause, not just the score.** Lighthouse's audits (`lighthouseResult.audits`) name what to fix on the page, for example the LCP element, render-blocking resources or unused JavaScript; read the audits the response holds ([API reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)). A report SHOULD give the top few for each failing metric.
<!-- /shared:web-vitals -->

## Writing the wiki settings

`Testing.md` holds the checklist. Items MUST be concrete and checkable ("the cart total shows $9.26", not "cart works"), with the test data they need. Set `<!-- code-dev-script: dev -->` and `<!-- code-dev-url: http://localhost:3000 -->` when the defaults do not fit. Detect from the manifest's `dev` script, the framework's default port, and `.env.example`.

For web vitals, name the pages that matter most, for example `<!-- code-vitals-pages: /, /category/widgets, /product/123 -->`, and set `<!-- code-vitals-score: 90 -->` only to raise the bar.

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
Web vitals (mobile, lab): / 94 pass; /product/123 82 fail: LCP 3.1 s (hero image not preloaded), TBT 180 ms (stand-in for INP)
```
