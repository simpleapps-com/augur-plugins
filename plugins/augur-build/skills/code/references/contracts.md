# Contracts

## Contents

- [Does](#does)
- [Reads](#reads)
- [What a contract is, and where it belongs](#what-a-contract-is-and-where-it-belongs)
- [Steps: the audit](#steps-the-audit)
- [Writing the wiki settings](#writing-the-wiki-settings)
- [Safeguards](#safeguards)
- [Report](#report)

## Does

Audits load-bearing code for missing, weak or drifted formal contracts (`@requires`, `@ensures`, `@invariant`, `@trusted`, `@time`, `@space`), and reports the bugs and test gaps that writing them exposes. The audit is a report: it changes no code. Adding contracts is a separate, approved step: [contracts-apply.md](contracts-apply.md).

- `/code contracts` with no argument: the session-aware audit, ranking files read or written this session.
- `/code contracts <path>`: the per-file audit of that file.

## Reads

Any contract conventions the project's wiki keeps (on `Development.md`, or a language conventions page), as guidance.

## What a contract is, and where it belongs

Contracts in the host language's comment syntax pay off three ways: they push the next reader (agent or human) into careful, spec-first reasoning; each clause is an oracle for tests the suite does not have yet; and agents report them as useful context on complex code. The first is a bet; the other two are seen in practice.

**Only load-bearing code**, the 5-10% where a subtle bug compounds: money math, auth and permissions, concurrency and ordering, state machines, trust boundaries (input validation, SQL, HTML, shell sinks), algorithms with non-trivial invariants. MUST NOT annotate getters and setters, glue and plumbing, UI components, one-off scripts, test bodies or generated code: every annotation costs context on every read.

**Order of preference.** Use the first that expresses the property:

1. **The type system.** A branded type, a narrow union, `readonly`, an enum, `Literal` or `NewType` makes the bad state unrepresentable. A type the compiler enforces beats a comment it ignores.
2. **A checker-enforced annotation.** Psalm or PHPStan (`@psalm-assert`, `@phpstan-pure`), mypy or pyright (`TypeGuard`, `assert_never`), ESLint rules for purity. Drift becomes a tool error.
3. **A formal contract** for what no checker can say: algebraic laws, protocol invariants, invariants over external state.

**Two surfaces per clause, on one line.** A Unicode formal surface (`∀`, `∈`, `≥`, `ℕ`, `Θ`) and a prose gloss that **names the assumptions**, not one that translates the symbols:

```ts
@requires q ≥ 0        // q is non-negative; assumes the caller validated input, no NaN check here
@ensures  result ∈ ℕ    // a natural number; overflow is the caller's responsibility
@time     Θ(n)          // linear in n = items.length
```

`@ensures result >= 0` alone, or `// always positive`, does neither job. Prefer `Θ` to `O` when the bound is tight. Palette, patterns and per-language examples: [contracts-vocabulary.md](contracts-vocabulary.md).

**Sentinel pass.** After range and type clauses, ask whether any value carries two meanings: `price ?? 0` where `0` also means "call for price", `-1` for "not found", `""` versus missing. Range clauses cannot see this. Lift the states into the type (`{ kind: 'priced'; amount } | { kind: 'call-for-price' }`).

**Drift is a defect.** When code contradicts its contract, decide which is wrong from the callers and tests, and fix that one. MUST NOT rewrite the contract to match wrong code; if it cannot be told which is intended, ask. A postcondition that restates the constructor (`@ensures result.kind === 'loaded'` on a function returning `{ kind: 'loaded', item }`) adds nothing: drop it.

## Steps: the audit

**Per-file** (`/code contracts <path>`): walk four questions in order.

1. **Where do types not capture a runtime constraint?** Strings reaching SQL, HTML or shell sinks with trust invisible; coupled optional fields; load-bearing non-null assertions; sentinels; numbers that should be ℕ or a range; loops over inputs of unknown size with no stated cost. For each: the clause, and the type-level fix that would make it unnecessary. Flag an improvable complexity class (a nested loop where a keyed lookup would do).
2. **Do the name and docstring match the behaviour?** Plural names returning one, `getX` that mutates, docstrings the body does not enforce, a function doing several things. Decide: rename, or fix the body.
3. **Which values does the file emit that others consume on an unwritten contract?** The highest-value finding. For each return value, export, or write to shared state: who consumes it, what do they assume (shape, format, sanitisation, origin), and is it written anywhere? Propose `@trusted` or `@ensures` on the producer, or hardening at the consumer.
4. **What tests do these clauses demand that the suite lacks?** `@requires` → boundary inputs (negative, NaN, empty, max). `@ensures` → output assertions. `@invariant` → multi-step sequences. `@trusted` → fuzz cases. `@time` and `@space` → scaling checks at n = 10, 100, 1000.

**Session-aware** (`/code contracts`): take the source files read or written this session (not tests, config or generated files; skip files under about 50 lines unless security-critical). Score each: is it load-bearing, does it carry contracts already, would adding them surface a bug or a test gap? Use what the session already knows about each file. Rank them; the user picks one for the per-file audit.

## Writing the wiki settings

None. Prose on `Development.md` can record a project's own rules: the docblock format per language, paths that are always load-bearing (`src/billing/`), or paths never to annotate. Detect from existing contracts in the code (`grep -rn "@requires" <repo>`) and match their style.

## Safeguards

Report only: MUST NOT change code, contracts or tests. The report MUST include "When not to annotate" before the findings, so the audit does not produce comment bloat. No git writes.

## Report

Per-file:

```
# Contract audit: <file>
## Scope            the file, and whether it is load-bearing
## When not to annotate   what in this file falls in the skip list
## Findings
### 1. Types that do not capture runtime constraints   clause + type-level fix
### 2. Name and docstring drift                         rename or body fix
### 3. Cross-file trust boundaries                      producer/consumer pairs
### 4. Test gaps                                        the tests each clause demands
## Next steps       bugs first, then drift, boundaries, tests
```

Session-aware: "Recommended" (ranked, one line each: why load-bearing, the gap, the suggested action), "Already covered" (with any drift seen), and "Skip" (not load-bearing, with the reason).
