# Getting started with LemmaScript and Dafny

From an empty TypeScript repo to a first proved rule, with every file shown. The examples verify as written (LemmaScript 0.6, Dafny 4.11). Read this first; [lemmascript-and-dafny.md](lemmascript-and-dafny.md) has the patterns and gaps for after.

## Contents

- [1. Set up](#1-set-up)
- [2. The annotations](#2-the-annotations)
- [3. What lsc generates](#3-what-lsc-generates)
- [4. A first rule, red to green](#4-a-first-rule-red-to-green)
- [5. A loop](#5-a-loop)
- [6. Running one file, and reading errors](#6-running-one-file-and-reading-errors)
- [7. Tests](#7-tests)
- [8. Make it always apply](#8-make-it-always-apply)
- [9. What TypeScript translates](#9-what-typescript-translates)
- [10. Lists of records](#10-lists-of-records)
- [11. A loop with several variables](#11-a-loop-with-several-variables)

## 1. Set up

1. Install the tools: `pnpm add -D lemmascript` (pin the exact version in `package.json`), and Dafny (`brew install dafny`). Record the Dafny and Z3 versions in the repo (for example `.dafny-version`, `.z3-version`) and keep them pinned.
2. `lemmascript.json` at the repo root:

   ```json
   {
     "string-semantics": "javascript-utf16",
     "dafny-library": "local"
   }
   ```

3. `LemmaScript-files.txt` at the repo root: each proved `.ts`, one per line, relative to the root (`src/percent.ts`).
4. Folders: `models/` for the model, `models/links/` for the links.
5. Scripts in `package.json`:

   ```json
   "proofs": "lsc check --backend=dafny && dafny verify --unicode-char:false --allow-deprecation models/*.dfy models/links/*.dfy",
   "test": "node --test --experimental-test-coverage --test-coverage-lines=100 --test-coverage-branches=100 --test-coverage-functions=100 --test-coverage-exclude='**/*.test.ts' 'src/**/*.test.ts'"
   ```

   `--allow-deprecation` is needed: Dafny warns that `--unicode-char` is deprecated, and a warning fails the run. Any test runner works; the coverage MUST be 100% lines, branches and functions.
6. Commit the `.dfy.gen` and `.dfy` files with the `.ts`. A `.dfy` is never shipped in a package.
7. Keep a findings log (for example `models/PROCESS.md`): every lesson, translation surprise and finding, as it happens. It becomes the repo's own guide.

## 2. The annotations

Every `//@` line is a comment, so the code runs unchanged.

| Annotation | Where | Means |
|------------|-------|-------|
| `//@ backend dafny` | First line of the file | This file is translated to Dafny |
| `//@ verify` | First line **inside** the function body | Translate and prove this function. Unmarked functions in the file are ignored |
| `//@ pure` | After `//@ verify` | Emit a loop as a Dafny function (function-by-method), so specs and links can call it |
| `//@ type i nat` | After `//@ verify` | Parameter `i` is a natural number. A `number` is otherwise an unbounded integer (`int`); there is no separate integer annotation |
| `//@ requires <expr>` | After `//@ verify` | Precondition, in TypeScript syntax (`i <= s.length`) |
| `//@ ensures <expr>` | After `//@ verify` | Postcondition. `\result` is the return value. `<==>` and `==>` are iff and implies; `forall(k: nat, <expr>)` and `exists(k: nat, <expr>)` quantify |
| `//@ decreases <expr>` | After `//@ verify` on a recursive function, or first lines **inside** a loop body | The measure that goes down each call or turn |
| `//@ invariant <expr>` | First lines **inside** the loop body | Holds at the top of every turn |

## 3. What lsc generates

`lsc gen --backend=dafny src/percent.ts` writes `src/percent.dfy.gen`, and creates `src/percent.dfy` (a copy) if there is none. Names are unchanged; there is no module.

| TypeScript | Dafny |
|------------|-------|
| `number` | `int` (a `nat` with `//@ type`) |
| `string`, `s.length`, `s.charCodeAt(i)`, `s.slice(a, b)` | `string`, `\|s\|`, `(s[i] as int)`, `s[a..b]` |
| `T[]`, `xs.push(x)` | `seq<T>`, `xs := xs + [x]` |
| `type Colour = "red" \| "plain"` | `datatype Colour = red \| plain`, values `Colour.red` |
| `interface Parts { ok: boolean; end: number }` | `datatype Parts = Parts(ok: bool, end: int)`, built positionally `Parts(true, 3)` |
| A function | A Dafny `function` of the same name |
| Its `//@ ensures` | A separate `lemma <name>_ensures` (callers do not see it; see the patterns file) |
| A `//@ pure` function with a loop | `function <name>_fun_spec` (a bodyless stub for you to fill) and `function <name> ... by method { <the loop> }` |
| A module `const` | A Dafny `const` of the same name |

## 4. A first rule, red to green

The rule: a percentage shown in a two-digit badge is never below 0 or above 99. The old code capped at 100, which overflowed the badge.

**Model**, `models/Percent.dfy`, changed first, with the bug named:

```dafny
module Percent {
  // A percentage shown in a two-digit badge: never below 0 or above 99; in range, unchanged.
  function Clamp(n: int): int
  {
    if n < 0 then 0 else if n > 99 then 99 else n
  }

  predicate FitsBadge(shown: int) { 0 <= shown <= 99 }

  lemma ClampFitsBadge(n: int)
    ensures FitsBadge(Clamp(n))
  {
  }

  lemma ClampKeepsInRange(n: int)
    requires 0 <= n <= 99
    ensures Clamp(n) == n
  {
  }

  // The old design, kept so the bug stays named: capping at 100 overflows the badge.
  function OldClamp(n: int): int
  {
    if n < 0 then 0 else if n > 100 then 100 else n
  }

  lemma OldClampOverflowsBadge()
    ensures !FitsBadge(OldClamp(100))
  {
  }
}
```

**Link**, `models/links/percent.dfy` (paths relative to the link file):

```dafny
include "../../src/percent.dfy"
include "../Percent.dfy"

lemma ClampPercentMatchesModel(n: int)
  ensures clampPercent(n) == Percent.Clamp(n)
{
}
```

**Red.** The code still caps at 100. `dafny verify --unicode-char:false --allow-deprecation models/links/percent.dfy`:

```
percent.dfy(6,0): Error: a postcondition could not be proved on this return path
percent.dfy(5,26): Related location: this is the postcondition that could not be proved
Dafny program verifier finished with 0 verified, 1 error
```

For a brand-new function the link is red too: it fails to resolve (`unresolved identifier: clampPercent`) until the code exists.

**Code**, `src/percent.ts`:

```ts
//@ backend dafny

/** A percentage shown in a two-digit badge: 0 below 0, 99 above 99, else itself. */
export function clampPercent(n: number): number {
  //@ verify
  //@ ensures \result === (n < 0 ? 0 : n > 99 ? 99 : n)
  if (n < 0) return 0;
  if (n > 99) return 99;
  return n;
}
```

`lsc gen --backend=dafny src/percent.ts` writes:

```dafny
function clampPercent(n: int): int
{
  if (n < 0) then
    0
  else
    if (n > 99) then
      99
    else
      n
}

lemma clampPercent_ensures(n: int)
  ensures (clampPercent(n) == (if (n < 0) then 0 else (if (n > 99) then 99 else n)))
{
}
```

**Green.** The link again: `Dafny program verifier finished with 1 verified, 0 errors`. Then `pnpm proofs`, the tests, and the break-it step (change `99` to `100` in the code and watch the link go red).

How the link reaches both sides: it `include`s the code's `.dfy` (top-level names, no module, so `clampPercent`) and the model file (everything inside `module Percent`, so `Percent.Clamp`). A qualified name needs no `import`. When the code and the model each have a datatype for the same thing, the link writes a small converter from one to the other (section 10).

A link verifies only itself: the files it includes are trusted, so the code's own proof stays in `lsc check` and the model's lemmas in a run over `models/*.dfy`.

## 5. A loop

A run of repo-name characters from `i`, over text of any length. **Code**:

```ts
function repoRunEnd(s: string, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures i <= \result && \result <= s.length
  let j = i;
  while (j < s.length && isRepoUnit(s.charCodeAt(j))) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    j = j + 1;
  }
  return j;
}
```

The `let` is reassigned inside a `//@ pure` loop, which is fine: the loop becomes the `by method` body.

lsc generates `repoRunEnd` as `function repoRunEnd(s, i) { repoRunEnd_fun_spec(s, i) } by method { <the loop> }`, with `repoRunEnd_fun_spec` a stub, and drops the `ensures`. **Additions in the `.dfy`**: the spec's `decreases`, `ensures` and recursive body (what a recursive `repoRunEnd` would be), and one loop invariant tying the loop to it. The TypeScript cannot name `_fun_spec`, so these live only in the `.dfy`:

```dafny
function repoRunEnd_fun_spec(s: string, i: nat): int
  requires (i <= |s|)
  decreases (|s| - i)
  ensures (i <= repoRunEnd_fun_spec(s, i))
  ensures (repoRunEnd_fun_spec(s, i) <= |s|)
{
  if ((i >= |s|) || !(isRepoUnit((s[i] as int)))) then
    i
  else
    repoRunEnd_fun_spec(s, (i + 1))
}
```

and, in the generated loop header, after the generated invariants:

```dafny
    invariant repoRunEnd_fun_spec(s, j) == repoRunEnd_fun_spec(s, i)
```

A loop that builds a result uses `acc + f_fun_spec(s, j) == f_fun_spec(s, i)`; one that counts down adds `invariant 0 <= j`; one whose `i` may start past the end (no `requires`) adds `invariant j <= |s| || j == i`.

## 6. Running one file, and reading errors

| To check | Run |
|----------|-----|
| One code file's proof | `pnpm exec lsc check --backend=dafny src/percent.ts` |
| One link | `dafny verify --unicode-char:false --allow-deprecation models/links/percent.dfy` |
| The model alone | `dafny verify --unicode-char:false --allow-deprecation models/Percent.dfy` |
| Everything | `pnpm proofs` |

| Message | Means |
|---------|-------|
| `a postcondition could not be proved on this return path` | The code (or a spec body) does not meet the `ensures` it names: red. Decide which is wrong (the skill's rules) |
| `this loop invariant could not be proved on entry` (or `maintained by the loop`) | The invariant is wrong, or too weak to carry itself round the loop: fix it, or add the bound it needs (`0 <= j`, the spec equation) |
| `value does not satisfy the subset constraints of 'nat'` | An `int` used where a `nat` is needed: add a bound (`invariant 0 <= j`) or a `requires` |
| `unresolved identifier` | A name the link uses does not exist: the function is not written yet (red), or the include path is wrong |
| `timed out` | The proof needs work, not the spec: split cases, name the steps ([lemmascript-and-dafny.md](lemmascript-and-dafny.md#when-a-proof-is-slow-or-fails)) |
| lsc `WARNING: <file>.dfy has modifications to generated lines` | The `.dfy` still holds the old generated code after a `.ts` change: copy the new `.dfy.gen` to `.dfy` and re-add the hand additions |

Dafny names the clause and the return path, not an input. To find the input:

1. Read the failing clause against the return path it names, and work out by hand which input reaches that path and breaks it.
2. Ask Dafny: `--extract-counterexample` prints values for the first failing assertion. It is experimental: a hint to check, not a receipt.
3. Narrow it: `--filter-symbol=ClampPercentMatchesModel` verifies one lemma; an `assert` of each step you expect, placed before the failing line, shows where your reasoning and the prover's part.
4. Make the input a test, watch it fail, then fix the code or the spec.

**A link that stays green after a model change** (the red step did not go red):

- Check the link names the model function you changed, and includes the model file you edited (not an older copy).
- Check the lemma is not vacuous: `--analyze-proofs` warns when a proof holds only because its assumptions contradict each other, and when a `requires` was not needed.
- Break the model on purpose (return a constant); if the link still passes, it does not reach that function.

## 7. Tests

Next to each proved file, `src/percent.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { clampPercent } from "./percent.ts";

test("clampPercent is Math.min(99, Math.max(0, n)) for integers", () => {
  for (let n = -200; n <= 200; n++) assert.equal(clampPercent(n), Math.min(99, Math.max(0, n)));
});
```

One test per clause of the rule, each against an oracle (here `Math.min`/`Math.max`), and a fixed example for every branch.

## 8. Make it always apply

A skill loads only when the task matches its description, so add one line to the repo's `CLAUDE.md` (or an always-loaded rule) so every session follows the pattern:

```markdown
- Code MUST follow lemma-driven design (skill `lemma-driven-design`): the model and its lemma before any code; `pnpm proofs` MUST pass before submitting.
```

## 9. What TypeScript translates

Checked against lsc 0.6: each "translates" row verifies as written.

| Construct | Result |
|-----------|--------|
| `number`, `boolean`, `string`, `T[]`, `Set<T>`, `Map<K, V>` | `int`, `bool`, `string`, `seq<T>`, `set<T>`, `map<K, V>` |
| A named `interface` or string-union `type` | A `datatype` (positional constructor, fields by name) |
| An object literal return, `\result.field` in an `ensures`, `xs.includes(x)` in a spec | Translate: `\result.ok === !codes.includes(code)` proves as written |
| `if`/`else`, `?:`, `&&`, `\|\|`, `!`, `===`, `!==`, `<`, `+`, `-`, `*` | The same operators |
| A `while` loop | A method, or with `//@ pure` a function-by-method |
| `s.length`, `s.charCodeAt(i)`, `s.slice(a, b)`, `s.startsWith(p)`, `s.includes(p)`, `s.trim()` (JavaScript's whitespace), `String.fromCharCode(c)` (needs `0 <= c < 65536` proved at the call) | Translates, with a real definition |
| `xs.length`, `xs[k]!`, `xs.slice(a, b)`, `[...xs, x]`, `xs.push(x)`, `xs.includes(x)`, `xs.indexOf(x)`, `xs.join(sep)`, `xs.filter`, `xs.map`, `xs.every`, `xs.some`, `set.has(x)` | Translates, with a real definition |
| `s.toLowerCase()`, `s.toUpperCase()`, `s.split(d)` | An `{:axiom}`: an escape in generated code. Write a proved function instead (ASCII lowering, a scanner) |
| `for (const x of xs)` | A method, whatever the annotations: write a `while` loop with `//@ pure` |
| An inline object type (`{ a: number }`) as a parameter or return type | Dafny that does not parse: name it with an `interface` |
| Regex, `JSON`, `await`, try/catch, classes, `Date`, JSX | Not translated: keep them in the unproved shell and pull the decisions out |

Anything not in this table: try it in a scratch file with `lsc gen` and read the `.dfy.gen` before relying on it.

## 10. Lists of records

The code adds a reference to a list: a new id goes last; a known id keeps its place, `closes` wins over a mention, and a project once known stays.

**Code** (three proved functions; `refIndex` is a `//@ pure` loop as in section 5):

```ts
export interface Ref {
  id: string;
  closes: boolean;
  project: string;
}

function refIndex(refs: Ref[], id: string, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ ensures \result === -1 || (i <= \result && \result < refs.length)
  let j = i;
  while (j < refs.length && refs[j]!.id !== id) {
    //@ invariant i <= j
    //@ decreases refs.length - j
    j = j + 1;
  }
  return j < refs.length ? j : -1;
}

function mergeAt(refs: Ref[], k: number, closes: boolean, project: string): Ref[] {
  //@ verify
  //@ type k nat
  //@ requires k < refs.length
  const merged: Ref = {
    id: refs[k]!.id,
    closes: refs[k]!.closes || closes,
    project: project !== "" ? project : refs[k]!.project,
  };
  return [...refs.slice(0, k), merged, ...refs.slice(k + 1)];
}

function addRef(refs: Ref[], id: string, closes: boolean, project: string): Ref[] {
  //@ verify
  const k = refIndex(refs, id, 0);
  if (k < 0) return [...refs, { id, closes, project }];
  return mergeAt(refs, k, closes, project);
}
```

**Generated** (the interface becomes a datatype; arrays become sequences):

```dafny
datatype Ref = Ref(id: string, closes: bool, project: string)

function mergeAt(refs: seq<Ref>, k: nat, closes: bool, project: string): seq<Ref>
  requires (k < |refs|)
{
  var merged := Ref(refs[k].id, (refs[k].closes || closes), (if (project != "") then project else refs[k].project));
  ((refs[0..k] + [merged]) + refs[(k + 1)..])
}

function addRef(refs: seq<Ref>, id: string, closes: bool, project: string): seq<Ref>
{
  var k := refIndex(refs, id, 0);
  if (k < 0) then
    (refs + [Ref(id, closes, project)])
  else
    mergeAt(refs, k, closes, project)
}
```

**Model** (inside its module; its own `Ref`, and the properties a caller relies on):

```dafny
datatype Ref = Ref(id: string, closes: bool, project: string)

function RefIndex(refs: seq<Ref>, id: string, i: nat): int
  ensures RefIndex(refs, id, i) == -1 || i <= RefIndex(refs, id, i) < |refs|
  ensures RefIndex(refs, id, i) >= 0 ==> refs[RefIndex(refs, id, i)].id == id
  ensures RefIndex(refs, id, i) == -1 ==> forall k :: i <= k < |refs| ==> refs[k].id != id
  decreases |refs| - i
{
  if i >= |refs| then -1 else if refs[i].id == id then i else RefIndex(refs, id, i + 1)
}

// A new target goes last; a known one keeps its place, `closes` wins, a project once known stays.
function AddRef(refs: seq<Ref>, id: string, closes: bool, project: string): seq<Ref>
{
  var k := RefIndex(refs, id, 0);
  if k < 0 then refs + [Ref(id, closes, project)]
  else
    refs[..k] + [Ref(refs[k].id, refs[k].closes || closes, if project != "" then project else refs[k].project)] + refs[k + 1..]
}

// A closing reference stays closing: a later mention never downgrades it.
lemma AddRefKeepsCloses(refs: seq<Ref>, id: string, closes: bool, project: string, k: nat)
  requires k < |refs| && refs[k].closes
  ensures var out := AddRef(refs, id, closes, project); exists j :: 0 <= j < |out| && out[j].id == refs[k].id && out[j].closes
{
  var out := AddRef(refs, id, closes, project);
  assert out[k].id == refs[k].id && out[k].closes;
}
```

**Link** (the code's `Ref` and the model's are different types, so the link converts; the two small lemmas tell Dafny how the conversion passes through `+` and a splice):

```dafny
function AsRef(r: Ref): WorkData.Ref { WorkData.Ref(r.id, r.closes, r.project) }

function AsRefs(rs: seq<Ref>): seq<WorkData.Ref>
{
  seq(|rs|, k requires 0 <= k < |rs| => AsRef(rs[k]))
}

lemma AsRefsAppend(rs: seq<Ref>, r: Ref)
  ensures AsRefs(rs + [r]) == AsRefs(rs) + [AsRef(r)]
{
}

lemma AsRefsSplice(rs: seq<Ref>, k: nat, r: Ref)
  requires k < |rs|
  ensures AsRefs(rs[..k] + [r] + rs[k + 1..]) == AsRefs(rs)[..k] + [AsRef(r)] + AsRefs(rs)[k + 1..]
{
}

lemma RefIndexMatchesModel(refs: seq<Ref>, id: string, i: nat)
  ensures refIndex(refs, id, i) == WorkData.RefIndex(AsRefs(refs), id, i)
  decreases |refs| - i
{
  if i < |refs| { RefIndexMatchesModel(refs, id, i + 1); }
}

lemma AddRefMatchesModel(refs: seq<Ref>, id: string, closes: bool, project: string)
  ensures AsRefs(addRef(refs, id, closes, project)) == WorkData.AddRef(AsRefs(refs), id, closes, project)
{
  RefIndexMatchesModel(refs, id, 0);
  var k := refIndex(refs, id, 0);
  if k < 0 { AsRefsAppend(refs, Ref(id, closes, project)); }
  else {
    var merged := Ref(refs[k].id, refs[k].closes || closes, if project != "" then project else refs[k].project);
    AsRefsSplice(refs, k, merged);
  }
}
```

The pattern: a recursive function's link is proved by induction (it calls itself on the next index); a function built from others calls their links first, then one conversion lemma per shape (append, splice).

**Membership and no duplicates.** A coupon code applies once per order: a second apply is refused and the list is unchanged. Verified as written.

`models/Coupon.dfy`:

```dafny
module Coupon {
  datatype Applied = Applied(ok: bool, codes: seq<string>)

  function Apply(codes: seq<string>, c: string): Applied
  {
    if c in codes then Applied(false, codes) else Applied(true, codes + [c])
  }

  predicate NoDups(cs: seq<string>) { forall i, j :: 0 <= i < j < |cs| ==> cs[i] != cs[j] }

  lemma ApplyKeepsNoDups(cs: seq<string>, c: string)
    requires NoDups(cs)
    ensures NoDups(Apply(cs, c).codes)
  {
  }

  lemma ApplyTwiceRefused(cs: seq<string>, c: string)
    ensures !Apply(Apply(cs, c).codes, c).ok
  {
  }

  // The old design, kept so the bug stays named.
  function OldApply(cs: seq<string>, c: string): seq<string> { cs + [c] }

  lemma OldApplyAllowsDuplicate()
    ensures !NoDups(OldApply(OldApply([], "A"), "A"))
  {
    // Name the duplicate pair: the prover does not search for a witness on its own.
    var twice := OldApply(OldApply([], "A"), "A");
    assert twice[0] == twice[1];
  }
}
```

`src/coupon.ts`:

```ts
//@ backend dafny

export interface ApplyResult {
  ok: boolean;
  codes: string[];
}

export function applyCoupon(codes: string[], code: string): ApplyResult {
  //@ verify
  //@ ensures \result.ok === !codes.includes(code)
  if (codes.includes(code)) return { ok: false, codes };
  return { ok: true, codes: [...codes, code] };
}
```

`models/links/coupon.dfy` (the result datatypes have the same fields, so the link compares them field by field and needs no converter):

```dafny
include "../../src/coupon.dfy"
include "../Coupon.dfy"

lemma ApplyCouponMatchesModel(codes: seq<string>, code: string)
  ensures applyCoupon(codes, code).ok == Coupon.Apply(codes, code).ok
  ensures applyCoupon(codes, code).codes == Coupon.Apply(codes, code).codes
{
}
```

**Proving something false needs a witness.** A lemma that a `forall` fails (or that an `exists` holds) proves only when the body names the case: assert the two equal elements, the input that breaks it. Without the `assert`, `OldApplyAllowsDuplicate` fails with "a postcondition could not be proved".

**Keep model and code files apart.** `models/Coupon.dfy` and `src/coupon.dfy` are fine; in one folder, on a case-insensitive file system (macOS, Windows), `Coupon.dfy` and lsc's `coupon.dfy` are the same file, and one overwrites the other.

## 11. A loop with several variables

A slug: lowercase letters and digits kept, each run of anything else one hyphen, none at either end. The loop carries the result so far (`acc`) and two flags (`kept`: a character was kept; `pending`: a gap waits for the next kept character).

**Code**:

```ts
function slugFrom(s: string, i: number, started: boolean, gap: boolean): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let kept = started;
  let pending = gap;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j
    //@ decreases s.length - j
    const c = s.charCodeAt(j);
    if ((c >= 97 && c <= 122) || isDigitUnit(c)) {
      acc = acc + (pending ? "-" : "") + s.slice(j, j + 1);
      kept = true;
      pending = false;
    } else {
      pending = kept;
    }
    j = j + 1;
  }
  return acc;
}
```

**Spec** (the recursion takes the flags as parameters, exactly as the loop's variables change):

```dafny
function slugFrom_fun_spec(s: string, i: nat, started: bool, gap: bool): string
  decreases (|s| - i)
{
  if (i >= |s|) then
    ""
  else
    var c := (s[i] as int);
    var keep := (((c >= 97) && (c <= 122)) || isDigitUnit(c));
    if !(keep) then
      slugFrom_fun_spec(s, (i + 1), started, started)
    else
      (((if gap then "-" else "") + s[i..(i + 1)]) + slugFrom_fun_spec(s, (i + 1), true, false))
}
```

**Invariants** added to the loop: the rest, from the loop's current position and flags, finishes what the whole would be from the start; and `i` may start past the end:

```dafny
    invariant j <= |s| || j == i
    invariant acc + slugFrom_fun_spec(s, j, kept, pending) == slugFrom_fun_spec(s, i, started, gap)
```

The rule for any number of variables: every variable the loop changes becomes a parameter of the spec (or, for the built result, the `acc +` in front), and the invariant states that the spec at the loop's current values, after what is built, equals the spec at the starting values.
