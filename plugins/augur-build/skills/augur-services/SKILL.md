---
name: augur-services
description: Finds how to call an Augur service from code, from the public API docs that augur-api.info leads to, never from a guess. Walks the service directory and each service's llms.txt, searches its endpoints.jsonl for the route and its params, then opens openapi.json for that one operation's schemas, and writes the call with the `@simpleapps-com/augur-api` SDK. `/augur-services find <what>` reports the service, route, params, schemas and SDK call, and changes nothing. Use when writing, reviewing or debugging code that calls the Augur API or its SDK, when asked which service or endpoint does something, what an endpoint's params or response are, or how to start a new system on the Augur services. Not for reading or changing a site's live data: that is the augur-api plugin.
license: MIT
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/openapi-op.ts *)
---

# Augur services

The Augur services are REST microservices, one per domain (items, pricing, orders, customers and the rest). Their public docs are generated from the code, so they are the truth: MUST NOT guess a service, a path, a param or a field, and MUST NOT write a call from memory or from this page. Look it up each time; the docs win over anything here.

Key words MUST, SHOULD, MAY per RFC 2119.

## Where it runs

| Surface | What happens |
|---------|--------------|
| Claude Code | Downloads each file to the project's `tmp/`, searches it there, and pulls one operation out of `openapi.json` with the script below |
| Cowork | The same where it can fetch and save files (unverified) |
| Chat | Reads `llms.txt` and `endpoints.jsonl` with web fetch where the surface has it. `openapi.json` is often too large to fetch whole: give the route and params from `endpoints.jsonl`, and ask for the operation's part of the spec to be pasted when its schemas are needed. Without web fetch, ask for the files' text to be pasted. Say which facts were not read from the docs |

## The path: llms.txt, then endpoints.jsonl, then openapi.json

[augur-api.info](https://augur-api.info) is the hub ([its llms.txt](https://augur-api.info/llms.txt), [FAQ](https://augur-api.info/faq.md)). Every service answers at `https://{service}.augur-api.com`.

1. **Which service.** Read the [service directory](https://items.augur-api.com/llms.txt). It names every service; each service's own `llms.txt` describes it and lists the others. Pick the service by what it covers, not by its name alone.
2. **Which route: `endpoints.jsonl`.** One JSON object per line, one line per endpoint, covering every route the service exposes ([FAQ](https://augur-api.info/faq.md)):
   - `method`, `path` (with `{param}` templates), `pathParams`, `queryParams`, `headerParams`;
   - each param's `name`, `type` and `required`, and where they apply `multipleOf` (1 means a whole number), `maxLength`, `format` and `pattern` (the regex a path value must match);
   - `"x-read-only": true` on a POST that changes nothing (a query sent as a body).

   Download it once, then search it for the noun (`inv-mast`, `price`, `customer`) and read only the lines that match. It is small: for items, measured 2026-11-26, 186 routes in about 70 KB. Its line alone is enough for a call with no body (a GET): the path, the query params and their limits.
3. **The detail: `openapi.json`.** Only for the one operation found, for its request body and response schemas. It is large (items, measured 2026-11-26: 4.3 MB) and MUST NOT be read whole. In Claude Code, download it and run:

   `node ${CLAUDE_SKILL_DIR}/scripts/openapi-op.ts <downloaded openapi.json> <METHOD> <path>`

   exactly this path, with the `path` as `endpoints.jsonl` gives it (`/inv-mast/{invMastUid}`). Read-only: it prints that operation as JSON, with the path's shared parameters and every local `$ref` resolved. Exit 1 names the nearby paths or the methods the path has; exit 2 is bad input. When it cannot run (no Node), search the file for the path and read only that part.

`/postman.json` beside them is for testing by hand.

## Making the call

- **Headers:** every request sends `Authorization: Bearer <jwt>` and `x-site-id`; `/ping` and `/health-check` need only `x-site-id` ([FAQ](https://augur-api.info/faq.md)). Credentials come from SimpleApps; MUST NOT put a token or a site's id in code, a commit or a reply.
- **Responses** are JSON in one envelope (`status`, `message`, `data`, `count`, `total`, `totalResults`, `options`, `params`); lists page with `limit` and `offset` ([FAQ](https://augur-api.info/faq.md)). Auth, caching and retries: [augur.build's API overview](https://augur.build/docs/augur-api/overview).
- **TypeScript: the SDK, not `fetch`.** [`@simpleapps-com/augur-api`](https://www.npmjs.com/package/@simpleapps-com/augur-api) has one property per service and typed methods (`api.items.invMast.list({ limit: 10 })`), checks params before sending, and maps statuses to error classes. `AugurAPI.endpoints()` lists every endpoint's id, method and path template, so the route found in `endpoints.jsonl` maps to its SDK id (`items.invMast.doc.get`), called as a typed method or with `api.call(id, ...)`. Where the package is installed, its own `README.md` in `node_modules` is the truth for the SDK; depend on it with `^` per its README.
- **In an Augur site**, the server helpers in `@simpleapps-com/augur-server` wrap the SDK: load the `augur-packages` skill before writing the call.
- **Other languages:** the PHP and other clients are listed on [augur.build's packages page](https://augur.build/docs/packages/overview); without one, build the request from `endpoints.jsonl` and `openapi.json`.

## Subcommand

| Subcommand | Does |
|------------|------|
| `find <what>` | Looks up how to do `<what>` (`find price for an item`, `find customer ship-to addresses`) through the three steps above, and reports: the service; the method and path; each param with its type, whether it is required, and its limits; the request and response schemas when the call has a body or the response matters; whether it changes data; and the SDK call. Changes nothing |

A request in plain words does the same lookup; a bare call with nothing asked asks what to look up. When two routes fit, report both and say how they differ; when none fits, say so and name the closest. Every fact in the report comes from a file read in this lookup, or is marked as not read.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
