# Writing the model

How to organise a model and write lemmas that are worth having, for any prover.

## Contents

- [Layers: one definition per fact](#layers-one-definition-per-fact)
- [Lemmas worth having](#lemmas-worth-having)
- [Bugs as lemmas](#bugs-as-lemmas)
- [Constants and external facts](#constants-and-external-facts)
- [Keeping it small](#keeping-it-small)
- [Concurrency](#concurrency)
- [Large state](#large-state)
- [Review](#review)

## Layers: one definition per fact

- **Each fact is defined once, at the lowest layer it belongs to.** A typical order: foundation (option and result types), utilities (characters, strings, lists, dates), platform (facts every part of the system shares), each area, and a system file for properties that span areas.
- **An area reuses a lower fact or proves its own definition equal to it; it never restates it.** Two definitions of one fact drift.
- **A file includes only the lowest layer it needs,** and a fact that rarely changes gets its own file. One edit to a widely included file re-verifies everything that includes it.
- **One option type for the whole model,** with one conversion per link from the code's generated type to it.
- **Model names must not clash** with the names the code's translation generates.

## Lemmas worth having

- **Range over any state.** A lemma proved for a one-record store, or a single example, says nothing about the next state; quantify over all of them.
- **State what follows, not what is written.** A lemma that restates a function's body adds nothing; prove a consequence a reader could not see at a glance.
- **Prove both directions.** A flag meaning "may be incomplete" needs two lemmas: complete whenever the data fits, and unflagged only with room to spare.
- **Check completeness against an oracle.** Where an exhaustive or reference implementation exists (a sort, a parser), compare against it: a true spec can still miss a property, such as stability.
- **Pin a property contract to one result.** When a function is specified by properties rather than an equation, add a uniqueness lemma so the properties imply the exact value.

## Bugs as lemmas

- **Write the bug as a named lemma the old design fails**, beside the lemma the fix holds. The model then records why the change was needed, and the red step is real.
- **Keep a refuted design in the model** when it was tempting (floating-point money, a check made after a wait instead of before): the lemma that refutes it stops it coming back.

## Constants and external facts

- **Make a constant a proved function** in the code (a timeout, a default, a limit), so the link checks the number. A constant copied into the model by hand drifts.
- **Model stored values from the code that writes them** (the setter or data object), not from the last conversion seen on the way in.
- **Model a third party's behaviour from its source or documentation, each fact beside its quote,** and check it live where you can: one assertion per fact, in an end-to-end facts file. Re-check on every upgrade of that dependency.

## Keeping it small

- **Delete model parts with no code behind them.** An unused model costs verification time and misleads.
- **Restate a definition when one of its inputs is implied by another.** Fewer moving parts, shorter proofs.
- **When a proof needs heavy invariants or helper lemmas, the function is usually too big.** Split the code and the model together, and let the tests protect the split.

## Concurrency

Proved functions are pure, so a race lives in the shell around them, in what runs between a read and a write. Model it as steps: a read-then-write is two steps wherever another writer can act between them, and a bounded search over interleavings finds the failing order. The method is the same whether or not the code can be proved: [no-prover.md](no-prover.md#translating-code-into-steps).

## Large state

- **Make each step opaque, with frame postconditions** saying what it leaves unchanged, and reveal only the bodies a lemma needs. Transparent steps over a state of twenty or so fields make lemmas time out.
- **Name each fact a step needs before the step uses it,** and split cases explicitly. A small head lemma shortens a long chain.

## Review

- **Someone other than the author reads every lemma's claim** against the code: does it hold for every state, does it assume an order the code does not keep (a clock read after a wait, not before), is any stated claim wider than a lemma proves?
- **A finding the model makes is checked against real data and intent** before it is acted on: code can allow what never happens, or what the business does on purpose.
- **Record what the model leaves open**: what is proved, what a wrong implementation could still get past, and what is trusted.
