---
paths:
  - "**/models/**"
  - "**/scripts/rules.ts"
  - "**/plugins/*/scripts/**"
  - "**/plugins/*/skills/*/scripts/**"
  - "**/LemmaScript-files.txt"
---

# Proofs

- Model first, then the proved code, then the link in `models/links/`. MUST NOT use `assume` or `{:axiom}` in hand-written Dafny.
- Every proved file MUST be listed in `LemmaScript-files.txt`.

Detail: [Proofs](../../../wiki/Proofs.md). Load Skill("lemma-driven-design") for the method.
