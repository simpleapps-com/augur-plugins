# Quality

## Contents

- [Does](#does)
- [Reads](#reads)
- [Steps](#steps)
- [Suppressions](#suppressions)
- [Writing the wiki settings](#writing-the-wiki-settings)
- [Safeguards](#safeguards)
- [Report](#report)

## Does

Runs every check the project has on the whole codebase: format, lint, typecheck, tests, dead code, and the project's own gates.

- **Fix mode** (`/code quality`): fixes every failure, whoever introduced it, until all pass, and flags tooling the project lacks.
- **Check mode** (`/code quality check`, any request in other words such as "run the tests", and what `repo submit` and `repo publish` run): the same checks, fixing nothing. A failure, a suppression, or a file a check changed is reported as a failure.

You may be checking code you wrote earlier in this session: act as a reviewer who did not. A clean pass is earned, not assumed.

## Reads

`code-checks` on `Development.md`, the `## Quality` prose there as guidance, then the repo's manifest scripts (`package.json`, `composer.json`) and tool configs.

## Steps

1. **Discover.** The checks are `code-checks`, in order. Unset: the manifest's scripts. A single script that runs the lot (`quality`, `check`) is the one to run; else these, where defined:

   | Check | Scripts (check mode / fix mode) |
   |-------|-------------------------------|
   | Format | `format:check` / `format` |
   | Lint | `lint` / `lint:fix` |
   | Typecheck | `typecheck` |
   | Test | `test` |
   | Dead code | `knip` |
   | Project gates | `validate`, `proofs`, and other gates the `## Quality` prose names that are scripts |

   In check mode, use the check-only script; when only a writing one exists (`format` alone), run it and treat any changed file as a failure.
2. **Baseline.** `git -C <repo> status --porcelain`, to tell later which files a check changed.
3. **Lockfile.** In a pnpm project (`pnpm-lock.yaml` in `<repo>`), `pnpm --dir <repo> install --frozen-lockfile`. If it fails, the lockfile is out of step: in fix mode run `pnpm --dir <repo> install` and report the lockfile as changed; in check mode, report the failure.
4. **Run** each check as `pnpm --dir <repo> run <name>`, in order. Read each failure in full.
5. **Fix** (fix mode only). Fix each failure at its cause: the code, not the check. A test failing on a real bug: fix the bug. A dead-code finding is not deleted on sight, since an unused export may be public API: ask the user whether to delete it or record it as used in the tool's config, and stop there until they answer. After any change, run every check again from step 3; repeat until all pass.
6. **Suppressions.** Scan for them (below). Fix mode fixes each; check mode reports each as a failure.
7. **Changed files.** `git -C <repo> status --porcelain` again. In check mode, any file that differs from the baseline is a failure.
8. **Missing tooling.** Every project SHOULD have format, lint and tests, and SHOULD have dead-code detection, pre-commit hooks, and a runtime that is still supported (CI matrix, `engines`, `python_requires`, `composer.json` `require.php`: flag an end-of-life version). Name what is missing and suggest it as a manifest script, so it runs without a permission prompt and through review. MUST NOT add a tool or dependency without the user's yes.

## Suppressions

A suppression hides a failure from the check; it is a defect, not a finding to report as "pre-existing". A clean run has none.

| Ecosystem | Directives |
|-----------|-----------|
| JS / TS | `eslint-disable` (any form), `@ts-ignore`, `@ts-expect-error`, `prettier-ignore`, `.only`, `.skip`, `xit`, `xdescribe` |
| Python | `# noqa`, `# type: ignore`, `pytest.mark.skip` |
| PHP | `phpcs:ignore`, `@phpstan-ignore`, `markTestSkipped` |

Search the source folders the configs name (`tsconfig.json` `include`, the lint config, the package roots), one search per directive, in code files only (skip Markdown and other docs, which may name a directive without using it), skipping `node_modules/`, `vendor/`, build output and generated files. A justification comment does not make one acceptable.

| Suppressed | Fix |
|------------|-----|
| `react-hooks/exhaustive-deps` | Stabilise the dependency (`useCallback`, `useMemo`, a ref) and list the real dependencies |
| `no-explicit-any` | The real type, or `unknown` and narrowing |
| `@ts-expect-error` on an untyped import | A local `.d.ts` declaration |
| A deprecated API | Migrate to its replacement |
| `.skip` / `.only` | Make the test pass. If it is obsolete, ask the user before deleting it |

One exception: a deprecated API from a dependency with no replacement yet. With the user's yes, file an issue upstream (`/repo issue`), and leave the suppression with the issue URL on its line.

## Writing the wiki settings

Set `code-checks` on `Development.md` when the checks are more than one script, or a gate lives outside the usual names. Detect from the manifest, `lefthook.yml` or `.husky/`, and the CI workflow's steps (`.github/workflows/`). A gate that is a CLI command and not yet a script (a plugin validator, a prover) gets a manifest script first. Example:

```
<!-- code-checks: quality, proofs, plugin:validate -->
```

## Safeguards

- Fix mode edits code, tests, configs and the lockfile. It MUST NOT add a suppression, lower a threshold (coverage, a lint rule's level), or skip or delete a failing test to pass.
- Check mode changes nothing on purpose; a file a check changed is reported, not kept quiet.
- No git writes.

## Report

```
Quality: check mode (code-checks: quality, proofs, plugin:validate)
- quality: pass
- proofs: pass
- plugin:validate: FAIL (skills/x/SKILL.md: unknown frontmatter key)
Suppressions: 0
Changed files: none
Missing tooling: none
```

The results lead; discovery notes and missing tooling go last.
