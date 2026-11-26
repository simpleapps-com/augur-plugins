---
name: web-vitals
description: Measures a live page's Core Web Vitals (LCP, INP, CLS) and Lighthouse performance score with Google's PageSpeed Insights, and reports them against Google's "good" thresholds, real-user data and lab data kept apart. Use when the user asks how fast a site or page is, for its Core Web Vitals, PageSpeed or Lighthouse score, or whether it gives a good experience; the seo-cleanup skill uses it for a slow-pages scope.
license: MIT
---

# Web vitals

Core Web Vitals and the Lighthouse performance score are the team's marker of a good site and a good experience. This skill measures them for live pages through PageSpeed Insights (PSI) and reports what is good and what is not. It needs no Semrush units.

Keywords MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Surface | What works |
|---------|------------|
| Claude Code | PSI through a web fetch or `curl`; a local Lighthouse run ([Lighthouse](https://github.com/GoogleChrome/lighthouse): Node 22 or later, and Chrome) only when the user asks |
| claude.ai, Desktop, Cowork | PSI through the surface's web fetch tool, where it returns the raw JSON (not yet verified). Without one, give the user the PageSpeed Insights page for the URL |

## Measuring

1. **The pages.** The user names them: a home page, a category page, a product page are a fair start. MUST NOT crawl a whole site; SHOULD say up front how many pages will be measured.
2. **Call PSI** for each page: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<page>&strategy=mobile&category=performance` ([Get started](https://developers.google.com/speed/docs/insights/v5/get-started); [API reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)). MUST pass `strategy=mobile`: PSI defaults to desktop (see "Mobile first" below). A desktop run is a second call, only when asked. Google's docs show an optional `key=` and state no limit for calls without one; a key is the user's own and MUST NOT be written into a file.
3. **Read it** by the block below. A failed call (an error object, a timeout, a quota message): report it as it is and stop; MUST NOT fill the gap with guessed or remembered numbers.

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

## Report

One row per page: the strategy, the performance score, and LCP, INP (or TBT, named), CLS with field or lab marked, each marked good, needs improvement or poor; then the top causes for each failing metric. Numbers that go to a client SHOULD note that field data covers the last 28 days and lab data is one test run.

## Notes

- Google plans to stop including real-user data in PSI and points to the Chrome UX Report (CrUX) API instead ([Get started](https://developers.google.com/speed/docs/insights/v5/get-started)). When PSI stops returning `loadingExperience`, report lab data and say why.
- To turn slow pages into cleanup tasks, use the `seo-cleanup` skill with a slow-pages scope.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
