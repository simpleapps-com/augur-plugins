# Code Contracts

- When editing or auditing load-bearing code (here: the validator's rules, the bundled skill scripts' decision rules, anything that decides a release, a delete or a permission), SHOULD add formal contracts (`@requires`, `@ensures`, `@invariant`, `@trusted`, `@time`, `@space`) in TypeScript comments.
- MUST NOT add them by default to glue code, getters and setters, UI, plumbing, test bodies or one-off scripts: annotations cost context on every read.
- Each clause has two surfaces on one line: the formal one (∀, ∈, ≥, ℕ, Θ) and a gloss that names its assumptions. Prefer `Θ(...)` over `O(...)` when the bound is tight.
- Drift between a contract and the code is a defect: decide which is wrong and fix it; MUST NOT rewrite the contract to match wrong code.
- This repo proves code: where a decision can be proved (a model, proved TypeScript and a link; wiki Proofs), the proof beats a contract.

Load Skill("code") and run `/code contracts` for the audit; Load Skill("lemma-driven-design") for proofs.
