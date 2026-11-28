---
name: site-data
description: Read and change a site's ERP and e-commerce data through the Augur API connector (items, pricing, customers, orders, and other Augur services). Use when a site admin asks to look up, list, create, update, or delete their site's data. Requires the Augur API connector to be connected.
license: MIT
---

# Site data

The Augur API connector gives a site admin access to their site's data across the Augur services. Every call runs as the signed-in admin, on the site they signed in to. The connector's own instructions explain how to find services and endpoints and how to page through lists; follow them.

## Reading

Find what you need through the connector's discovery tool before you call anything. MUST NOT guess service names, endpoint ids, or field names, and MUST NOT invent data the connector did not return. Report results in plain business terms, not raw field names, unless the admin asks for them.

## Changing data

Creating, updating, and deleting records changes the site's live data, and the site's customers may see the change straight away. Before each create, update, or delete:

1. Say what will change: the kind of record, which record (by a name or number the admin will recognize), and the exact values before and after. For a delete, say that it removes the record.
2. Ask the admin to confirm, and wait for a clear yes.
3. Make only the change they confirmed.

One confirmation covers one change. For a batch, list every record and change first and get one yes for the whole list; if anything about the list changes, ask again. A request to "fix", "clean up", or "update" data is not a confirmation of a specific change.

After a change, read the record back and tell the admin what it now holds.

## Feedback

When the connector fails the admin, offer to send the Augur team a feedback report through `agrSite.feedback.create` (with the connector's create tool). Offer it; MUST NOT send one unasked. Each miss has a `kind`:

| The miss | `kind` |
|----------|--------|
| A field or endpoint you could not find | `schema_gap` |
| A description that misled you | `misleading_description` |
| A result that was wrong | `wrong_result` |
| A call the connector or service rejected | `call_rejected` |
| Data that should be there and is not | `missing_data` |
| A feature the admin wanted | `feature_request` |

The report's fields: `kind`, `question` (what the admin asked, in their words) and `problem` (what went wrong) are required, and the service rejects a blank one; `coordinates` (the endpoint ids and field names involved), `attempt` (the call you made: its endpoint id and params, never its results) and `suggestion` (the fix, if any) are optional (`POST /feedback` in the [agr-site spec](https://agr-site.augur-api.com/openapi.json)). MUST NOT put rows or values of the site's data in a report, nor a credential; leave record values out of `attempt`. The service sets the site, the caller and the date from the sign-in, so the report never carries them.

1. Show the admin the exact report, every field as it will be sent.
2. Send it only after their clear yes, with the same `siteId` as the call that missed. One yes covers one report, even when tools run without asking. A no, or no answer, sends nothing.
3. Tell them it was sent.

A miss in Augur Intelligence (the ERP questions connector) goes through that connector's own `feedback` tool, not this one.

## When sign-in fails

Only site admins (Super Users of the site) can sign in. If calls fail with an authentication error, ask the admin to reconnect the Augur API connector and sign in again, and to check they are using an admin account for the right site.

## When the connector is unavailable

If the connector's tools are missing, or every call fails to connect, stop calling it. Tell the admin the Augur API connector is unavailable and ask how they want to proceed. MUST NOT fill the gap with guessed or example data.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", gets a short answer that changes nothing. It MUST fit on one screen, about ten lines, with no tables: one line on what the skill does; one line per subcommand with an example call (a skill with no subcommands gives three example requests instead); what a bare call does; and one closing line naming what else can be asked about (its settings, its safeguards, what works on each surface), which is answered only when asked. MUST NOT list every setting, default, safeguard or surface unasked. The answer comes from this file. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read the files of this skill, or write anything.
<!-- /shared:help -->
