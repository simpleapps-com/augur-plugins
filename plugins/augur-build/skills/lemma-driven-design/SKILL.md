---
name: lemma-driven-design
description: A coding design pattern like test-driven design, with machine-checked proofs. Model first, the property stated as a lemma; the proof fails against the old code (red); the least code that meets the model; the proof passes (green); then tests pin it and a deliberate break shows each check can fail. Also models code no prover can read, to understand it and find defects. Use when writing, fixing, importing or reviewing code that is proved or modelled, or when the user mentions lemma-driven design, model first, formal proofs, formal models, specs, lemmas, a prover, or a proof that fails or times out.
license: MIT
---

# Lemma-driven design

Test-driven design writes an example first and lets it drive the code. Lemma-driven design writes the **model** first: a precise statement of how the system must behave, with each property that matters stated as a lemma. A machine-checked proof then shows the code is equal to the model for every input, and tests show the running code does what the proof says.

Each check covers the other's blind spot:

- **The proof checks the tests.** Tests cover only the examples someone thought of; the proof covers every input, and the case it fails on becomes the next test.
- **The tests check the proof.** A proof shows only that the code meets its spec; a test you trust exposes a wrong spec, and shows the translation the prover read matches what actually runs.

Key words MUST, SHOULD, MAY per RFC 2119.

## The pieces

| Piece | What it is |
|-------|------------|
| **Model** | Hand-written: what each rule means, and lemmas for the properties that matter. Written before the code; nothing is generated from it |
| **Proved code** | The shipped code itself, each decision a small pure function with its spec (`requires`, `ensures`) beside it |
| **Link** | One lemma per proved function, proving its real body equal to the model, not merely consistent with its spec |
| **Tests** | Pin each rule to the runtime against an oracle (the regex or built-in it replaced), at 100% coverage |

How to organise and write the model (layers, one definition per fact, bugs as lemmas, complete specs): [references/writing-the-model.md](references/writing-the-model.md).

The `code` skill's `/code model` applies this to a piece of work: it writes the model and lemmas from a WIP, issue, spec or the session, maps each acceptance criterion to a lemma, and checks the model verifies, before any code.

## The loop: new work and fixes

The model MUST change before any code. A plan whose first step writes code is wrong: fix the plan first.

1. **Model.** Change the model so it states the intended behaviour, and add the property as a lemma. It MUST be the property the change is about: a lemma already true of the old code cannot go red, so it proves nothing about the change. Name the bug itself as a lemma the old design fails.
2. **Red.** Verify the link against the current code. It MUST fail. If it passes, the model change did not take: fix the model, not the code.
3. **Code.** Write the least code that meets the model, with its spec.
4. **Green.** The proof of the code and the link both pass.
5. **Tests.** One test per clause of the new rule, against an oracle; coverage stays at 100%.
6. **Break it.** Break the code on purpose (flip a comparison, return a constant, drop a case) and watch the proof or the tests fail, then restore it. A check never seen to fail proves nothing.

Where no link can reach the code (UI lifecycle, timing), model the old design and the new one as values, prove the old one fails the property and the new one holds it, and let the tests tie the code to the model.

## The loop: existing code

For code that exists but is not yet proved, or code imported from elsewhere:

1. Model what the code does, read from the code itself (every writer, caller and filter), not from its docs. Where the code disagrees with a recorded decision, report it as a finding; MUST NOT model it away.
2. Link each proved function to the model.
3. State the area's properties as lemmas.

For an import, the model is written and verified first and lands as its own commit; the code, links and tests follow in the same change.

## Rules

- **Prove by default.** The only reason to leave a function unproved is that the tool cannot translate it (async, exceptions, regex, parsing, clocks, classes, UI markup). Then pull its decisions out into proved functions. "Too simple" or "not load-bearing" are not reasons.
- **Thin shells.** Every decision, including every refusal, lives in a small pure function that returns a result instead of throwing. I/O and parsing stay in thin unproved wrappers that only call the rules and act on the answer. A render function holds no decision: it draws what a proved rule returns.
- **Ask whether the data can reach it.** Before handling an edge case, check whether a lemma, the code that writes the data, or the data itself rules it out. If it can't happen, report that and build nothing; a fallback that contradicts a stated fact is a defect.
- **Every decision changes a test result.** A branch no test can tell apart from its removal is redundant, usually a guard only the prover needed: restructure it (one proved accessor), never call it untestable.
- **Complete, not just true.** A spec can hold and still miss the point ("sorted, same items" misses stability). Prove both directions of a flag, and test against an exhaustive oracle where one exists.
- **No escapes.** Hand-written proof MUST NOT assume what it should prove: no `assume`, axioms, or switched-off verification.
- **Never weaken a spec to get green.** When a proof fails, decide which is wrong. A trusted test that breaks the spec means the spec is wrong; a spec every test meets means the code is wrong on some input, which becomes the next test; an input no caller passes means a tighter precondition; a timeout or a missing invariant means the proof needs work, never the spec.
- **Prove what runs.** The proof is about the shipped code, never a copy of it. Where the prover's idea of a type differs from the runtime's (unbounded integers for floats, recursion with no stack limit), keep proved code to what both agree on, and write long walks as loops.
- **Real dependencies in tests.** A hand-made mock of a library or service can hide its real errors; use its real error types, or run it in memory.
- **Facts about the data become types.** A stated fact ("an id is at least 1") is a type made where the value enters, and proved functions still restate it as a precondition.
- **General before specific.** When two proofs share a shape, prove it once over a parameter (a test, a type, a bound) and have each case use it; specific values are proved to satisfy the general rule. One general proof is less to maintain, verifies faster, and makes the next case free. See `references/writing-the-model.md` "General before specific".
- **Pin the tools, and budget the time.** Pin the prover and its solver: a solver upgrade alone can make proofs time out. A full proof run SHOULD finish in minutes; one much slower than its last run is a defect.
- **Say what a proof says, no more.** A function is proved only for its clauses. Record what is left unproved.

## With a person

- **The person owns the model, its lemmas, the specs and the tests.** The agent drafts them from the stated behaviour; the person reads them before code is written. They are the short review surface.
- **The agent owns the code** and runs the whole loop.
- **The agent MUST NOT change a model, spec or test to get to green.** When it thinks one is wrong, it says which and why, and stops for a decision.
- **The agent reports each red**, not only the final green: the failing link, the failing test, what the break-it step caught.
- **Someone else reviews what each lemma claims**: whether it holds for every state or only a small one, and whether any stated claim is wider than a lemma proves.

## When the language has no prover

The model still pays: built from the code, it explains the logic, finds defects, and tests a change before it is made. No link can check the code, so other checks keep the model honest: a coverage map from every code path to a model step, concrete witness runs for each defect, a bounded search for failing interleavings, and every finding checked against real data and intent before it is ranked. Read [references/no-prover.md](references/no-prover.md) before modelling such code.

## Tooling

The pattern needs a prover that reads the language the code ships in. For TypeScript and JavaScript:

- New repo, or first proof: read [references/getting-started.md](references/getting-started.md): setup, the annotation grammar, what the translator generates, and a worked example from red to green.
- Then, before writing or proving code: [references/lemmascript-and-dafny.md](references/lemmascript-and-dafny.md): files, commands, proof patterns, checks and translation gaps.

Running a prover needs a terminal. Without one, use this pattern to plan, write and review models, specs and code, and say that the proof has not been run.

## Before submitting

1. The proofs pass (the repo's proof command), and its proof coverage check where it has one.
2. Quality passes, tests at 100%.
3. The break-it step was done for every new or changed proof.
4. Comments that name a modelled rule or list still match it: nothing checks them.

<!-- shared:help -->
## Help

`help` as the argument (`/<skill> help`), or a request such as "how do I use this skill?", explains how the skill is used and changes nothing. The answer comes from this file: what the skill does; each subcommand with one line and an example call, and what a bare call does (a skill with no subcommands gives three example requests instead); the settings and their defaults; and what works on each surface. `help` is reserved: it is never read as another argument (a title, a file, a target). To answer it, MUST NOT run a command, call any tool except to read this skill's own files, or write anything.
<!-- /shared:help -->
