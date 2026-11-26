# Browser habits (Claude Code with a browser tool)

These apply only where a browser tool is connected (in Claude Code, Claude in Chrome or another). In chat, ask the user what the page shows instead.

## Read the error overlay first

When debugging in the browser, MUST check for a development error overlay (in many frameworks, a red error badge or pill at the bottom of the page) before guessing at the problem. Open it and read the full error, the stack trace and the source location. The answer is usually there.

## Be persistent

MUST NOT give up after the first failure. Pages are dynamic: an element may not be visible yet, a selector may need adjusting, or the page may still be loading.

**Prefer accessible selectors.** The semantic HTML, ARIA labels, landmark roles and alt text that serve screen-reader users also make a page easy to find one's way around in automation. SHOULD find elements by ARIA role and label before brittle CSS selectors. Strong accessibility in frontend code being reviewed or written also makes the site easier to automate and verify.

Before giving up on a browser task, SHOULD try, in order:

1. ARIA labels, roles and semantic elements: the most reliable selectors.
2. A different selector or approach: text search, a CSS selector, coordinates.
3. Scrolling, to reveal an element off-screen.
4. Waiting for the page to finish loading, then retrying.
5. Reading the page's text or structure, to see its current state before the next try.
6. Navigating to the page again, if it seems stuck.

Two failed attempts with the *same* approach mean change the approach, not stop. A connection that drops mid-task: retry and recover per the project's `chrome-resilience` rule, where it has one (written by the `rules` skill).
