# When the language has no prover

Some code cannot be proved: no tool translates its language for a prover (PHP, for one). The model still pays. Built from the code, in a prover's language such as Dafny, it explains the logic, finds defects, and tests a proposed change before it is made. What it cannot do is check the code by machine, so this file is about keeping the model honest without a link.

## Contents

- [What changes](#what-changes)
- [Building a model](#building-a-model)
- [Translating code into steps](#translating-code-into-steps)
- [Witnesses and exploration](#witnesses-and-exploration)
- [Keeping the model in step](#keeping-the-model-in-step)
- [Findings](#findings)
- [What goes wrong](#what-goes-wrong)

## What changes

- **The model is built from the code, not the code from the model.** The loop is still model first for a change: model the change, see which lemmas move, then change the code.
- **One model per workflow,** which may cross several services. Shared types sit in a common folder.
- **No link.** A coverage map, witnesses and bounded exploration take its place.

A model folder per workflow typically holds: types, steps (one per unit of work), reads (what each step reads and writes), findings (each defect as a lemma), witnesses (each defect as a concrete run), an explorer (bounded search), the coverage map, and a README stating what holds, what is recorded behaviour, what needs a crash to happen, and what is not modelled and why.

## Building a model

1. **Questions first.** Before reading any code, list what the model must answer ("can two workers process the same order?"). Each question becomes a lemma, an explorer property, or a stated gap, so a missing one shows.
2. **Inventory the code, not the docs.** Record every writer, caller, filter and lock of the data, with its file. Docs and architecture diagrams miss writers; re-read the code behind any claim that surprises you, including a subagent's.
3. **Translate** each piece of code into steps, by the rules below.
4. **State the properties** as lemmas, and add witnesses and the explorer.
5. **Review.** Someone other than the author checks the model against the code.

## Translating code into steps

Translate mechanically, so two people get the same model:

- **One step per unit of work** (one record's body in a loop, one request, one job).
- **A lookup becomes a parameter with a guard**, not a hidden read.
- **A crash becomes an outcome** (`dies`), so its effects on the state are modelled.
- **A read-then-write is split into two steps** wherever another writer can act between them.
- **Tag each step by who runs it**: a scheduled job, the environment, a command line, an API call.

For every step, walk the same edge-case checklist: empty input, a missing record, a duplicate, a concurrent writer, a crash between writes, a retry, a stale read, and a value at its limit.

## Witnesses and exploration

All of these are written in the model's own language (Dafny here), beside the model, so the verifier checks them with it; only the coverage map is a script in the repo's own language.

- **Each defect gets a witness**: a concrete run, step by step, from a valid state to the bad one, written as a lemma that executes the steps and asserts the bad state. A witness is something a person can replay against the real system.
- **Bounded exploration** searches every interleaving of steps up to a stated bound, reports the shortest failing trace, and flags states that never settle.
- **Every violation the explorer finds becomes a witness or a recorded design decision.** The README states the bounds, so nobody reads "no violation" as "none at any size".
- **Show progress on long searches,** and check the first results early: a silent run that blows up its state space looks the same as one that is working.

## Keeping the model in step

- **A coverage map stands in for the link.** A script scans the code's entry points (routes, commands, jobs) and fails when one maps to no model step and no "not modelled" reason, when a step traces to no code, or when an entry is stale.
- **Update the model in the same change as the code it cites.** A model that describes the code before a fix is worse than none.
- **Where a doc disagrees with the model, fix the doc.** The model was read from the code.

## Findings

- **Check each finding against real data and against intent before ranking it.** Code can allow what never happens (a race that has not fired in years), and can do on purpose what looks like a bug (a deliberate default, a deliberate removal). With approval, test the invariant against the data to size the finding.
- **Rank findings by their effect on people,** not by how interesting they are.
- **Keep the categories honest**: what holds, what is only recorded behaviour (true because of one function's shape), what needs a crash to happen, and what is not modelled and why.
- **A finding is closed by a fix and a model update,** not by a note.

## What goes wrong

- **Transparent steps time out** once the state grows: make steps opaque from the start, with frame postconditions, and reveal only what a lemma needs.
- **Modelling from the docs** misses writers and falsifies earlier findings: inventory the code first.
- **Stopping after scaffolding:** a model without its properties, witnesses and coverage map finds nothing.
