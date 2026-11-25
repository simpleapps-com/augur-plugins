# Directives

Detail for the "Directives use RFC 2119 keywords" section of the `writing-style` skill. Spec: https://www.rfc-editor.org/rfc/rfc2119

## The keywords

| Keyword | Means |
|---------|-------|
| MUST, REQUIRED, SHALL | An absolute requirement, no exceptions |
| MUST NOT, SHALL NOT | An absolute prohibition |
| SHOULD, RECOMMENDED | The default; an exception needs a stated reason |
| SHOULD NOT, NOT RECOMMENDED | Discouraged; acceptable with careful reasoning |
| MAY, OPTIONAL | Truly optional: the reader's choice |

## Soft wording MUST be rewritten

| Soft phrase | Rewrite as |
|-------------|------------|
| always / never | MUST / MUST NOT |
| avoid | SHOULD NOT |
| be sure to / make sure | MUST |
| can / feel free to | MAY |
| don't / do not | MUST NOT |
| don't forget to / remember to | MUST |
| needs to / has to | MUST |
| should probably / ideally | SHOULD |
| try to / aim to | SHOULD |

## Before saving

Every sentence that tells someone what to do MUST contain MUST, MUST NOT, SHOULD, SHOULD NOT or MAY. A sentence without one MUST be rewritten with one, or reworded as description with no directive verb.

## Emphasis in agent instructions

In `CLAUDE.md`, rules and skills, SHOULD mark critical rules with "YOU MUST" or "IMPORTANT": the markers improve adherence.

## Asking for deeper reasoning

In Claude Code, `ultrathink` is the one recognised keyword: anywhere in a prompt or in a skill's content, it asks for deeper reasoning on that turn without changing the session's effort level. `think`, `think hard` and `think more` are ordinary text: they MUST NOT be written as if they control anything.

## The failure this prevents

An agent reads "tests MUST cover the edge case", finds the test tedious, and carries on as if it said "where practical". The agent has overruled the writer, who chose MUST on purpose. MUST means MUST: an agent that cannot comply stops and reports, and does not go on with a weakened version. A session example that breaks a MUST is covered in `SKILL.md` "Reading them".
