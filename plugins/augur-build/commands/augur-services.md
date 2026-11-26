---
name: augur-services
description: Finds how to call an Augur service from code, from the public API docs that augur-api.info leads to, never from a guess. Walks the service directory and each service's llms.txt, searches its endpoints.jsonl for the route and its params, then opens openapi.json for that one operation's schemas, and writes the call with the `@simpleapps-com/augur-api` SDK. `/augur-services find <what>` reports the service, route, params, schemas and SDK call, and changes nothing. Use when writing, reviewing or debugging code that calls the Augur API or its SDK, when asked which service or endpoint does something, what an endpoint's params or response are, or how to start a new system on the Augur services. Not for reading or changing a site's live data: that is the augur-api plugin.
argument-hint: "[find <what> | help]"
---

Use the `augur-services` skill and run its `$ARGUMENTS` subcommand. With no argument, ask what to look up.
