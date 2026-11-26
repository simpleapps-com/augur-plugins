# Discuss

## Does

Builds a shared understanding of the work through conversation: alignment comes from discussion, not a formal plan. Use it in place of Claude Code's plan mode. It changes nothing.

## Reads

The WIP if one exists, the session so far, every wiki page, and the code the work touches.

## What each surface can do

- **Chat:** works from what the user pastes and says; says that the wiki and code were not read unless they were pasted.
- **Claude Code:** reads `wip/`, the wiki and the code; MAY send a search to a subagent (Explore) to check an assumption against the code.
- **Cowork:** as Claude Code where the project's files are available (unverified); otherwise as chat.

## Steps

1. **Orient.** List `wip/` (with the `wip` skill installed) and read the WIP for this work, else the most recently changed one; review the session: what has been discussed, changed or learned. A WIP is the starting point. Nothing to start from: ask the user what they are working on or thinking about.
2. **Load the wiki.** With the `wiki` skill installed, `/wiki load`; else list `<wiki>` and read every `*.md` page. The wiki MUST be in context before the first question to the user: it may already document a solution, pattern or convention that answers the problem. MUST NOT ask the user what the wiki already answers.
3. **Discuss.** A conversation, not a checklist. The goal is to understand:
   - **What** the user wants to accomplish.
   - **What already exists:** wiki patterns, code or conventions that apply.
   - **What is in scope**, and what is not.
   - **Where** it fits: how it relates to the existing code, patterns and wiki conventions.
   - **Why** it matters: the motivation behind the request.

## How to discuss

- SHOULD ask one or two focused questions at a time, never a wall of them.
- SHOULD build on each answer, and summarise the understanding back so the user can correct it.
- MUST check the wiki and the code before asking: never ask what can be looked up. Verify an assumption against the code (a search, a read, a subagent) rather than asking the user to confirm it.
- When the wiki already covers the topic, say so, and ask whether the user wants to extend or change the existing approach.

## What not to do

- MUST NOT dump a long list of questions; keep it conversational.
- MUST NOT enter plan mode (Claude Code).
- MUST NOT produce a file, plan or artifact unless the user asks.
- MUST NOT rush to a solution: understand first.

## Outcomes

A discussion MAY end in any of these; each one that creates something MUST wait for the user's yes:

- A new GitHub issue (the `repo` skill's `issue`).
- A new WIP (the `wip` skill, when installed).
- Deciding not to build something.
- Discovering the wiki already has the answer.
- Reframing the original problem.
- Splitting one problem into several issues.

The user leads on when to formalise: they say when to create an issue, update a WIP, run `/strategize research`, or move to `/code model` or `/wip implement`.

## Safeguards

Changes nothing: no file edits, no git writes, no issues or WIPs without the user's yes.

## Report

What was agreed (the what, why and scope), what is still open, and any outcome the user approved.
