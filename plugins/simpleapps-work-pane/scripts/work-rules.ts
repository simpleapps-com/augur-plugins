//@ backend dafny

/* The work scripts' decisions, each a small pure function proved with LemmaScript → Dafny
   (`pnpm proofs`; model: models/WorkData.dfy; link: models/links/work-data-rules.dfy).
   The work scripts read files, call `gh`, and write work/; every decision about a value is one of
   these. Text is UTF-16 code units, as in JavaScript. Each scanner here replaces a regex of the
   scripts it ports (GH #14) and keeps its behaviour; work-rules.test.ts pins it to that regex.
   Self-contained: an installed plugin has only its own folder, and every proved file is verified
   as one Dafny program, so no top-level name here repeats one in pane-rules.ts or rules.ts. */

// ---------------------------------------------------------------- characters

/** `\w`: A-Z, a-z, 0-9, _. */
export function isWordUnit(c: number): boolean {
  //@ verify
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95;
}

/** `[\w.-]`: a repo, owner or GitHub login character. */
function isRepoUnit(c: number): boolean {
  //@ verify
  return isWordUnit(c) || c === 46 || c === 45;
}

/** `[A-Za-z]`. */
function isAlphaUnit(c: number): boolean {
  //@ verify
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

/** `\d`: 0-9. */
function isDigitUnit(c: number): boolean {
  //@ verify
  return c >= 48 && c <= 57;
}

/** `\s`, and what `String.prototype.trim` removes: JavaScript's whitespace and line ends. */
export function isSpaceUnit(c: number): boolean {
  //@ verify
  return (c >= 9 && c <= 13) || c === 32 || c === 160 || isWideSpaceUnit(c);
}

/** The whitespace above U+00FF that `\s` matches. */
function isWideSpaceUnit(c: number): boolean {
  //@ verify
  return (
    c === 5760 ||
    (c >= 8192 && c <= 8202) ||
    c === 8232 ||
    c === 8233 ||
    c === 8239 ||
    c === 8287 ||
    c === 12288 ||
    c === 65279
  );
}

/** A line end, which `.` does not match and multiline `^` follows. */
export function isLineEndUnit(c: number): boolean {
  //@ verify
  return c === 10 || c === 13 || c === 8232 || c === 8233;
}

/** What may come before a reference: `[\s([]`. */
function isLeadUnit(c: number): boolean {
  //@ verify
  return isSpaceUnit(c) || c === 40 || c === 91;
}

/** `s` has `w` at `i`. */
export function hasAt(s: string, i: number, w: string): boolean {
  //@ verify
  //@ type i nat
  return i + w.length <= s.length && s.slice(i, i + w.length) === w;
}

/** `\S`: not whitespace. */
function isSolidUnit(c: number): boolean {
  //@ verify
  return !isSpaceUnit(c);
}

/** Not a line end: what `.` matches. */
function isInLineUnit(c: number): boolean {
  //@ verify
  return !isLineEndUnit(c);
}

// ---------------------------------------------------------------- scans
// Every scan here is one of these three, each proved once for any test (model: Text.ListEnd,
// Text.ScanEnd, Text.RunStart). A named scan below is one call with its own test. Named apart
// from rules.ts' scanEnd and pane-rules.ts' pane scans: every proved file is one Dafny program.

/** Where the run of code units passing `ok` that starts at `i` ends: the first index from `i`
    whose code unit fails `ok`, or the end. */
function runEnd(s: string, i: number, ok: (c: number) => boolean): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures i <= \result && \result <= s.length
  let j = i;
  while (j < s.length && ok(s.charCodeAt(j))) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    j = j + 1;
  }
  return j;
}

/** Where the run of code units passing `ok` that ends at `e` starts, no lower than `lo`. */
function runStart(s: string, lo: number, e: number, ok: (c: number) => boolean): number {
  //@ verify
  //@ pure
  //@ type lo nat
  //@ type e nat
  //@ requires lo <= e && e <= s.length
  //@ ensures lo <= \result && \result <= e
  let j = e;
  while (j > lo && ok(s.charCodeAt(j - 1))) {
    //@ invariant lo <= j && j <= e
    //@ decreases j - lo
    j = j - 1;
  }
  return j;
}

/** Where the run of elements passing `ok` that starts at `i` ends; a search for x is the run of
    elements that are not x. */
function listEnd<T>(xs: T[], i: number, ok: (x: T) => boolean): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= xs.length
  //@ ensures i <= \result && \result <= xs.length
  let j = i;
  while (j < xs.length && ok(xs[j]!)) {
    //@ invariant i <= j && j <= xs.length
    //@ decreases xs.length - j
    j = j + 1;
  }
  return j;
}

/** Where the run of repo characters that starts at `i` ends. */
function repoRunEnd(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isRepoUnit);
}

/** Where the run of digits that starts at `i` ends. */
function digitRunEnd(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isDigitUnit);
}

/** Where the run of whitespace that starts at `i` ends; also where `trim` starts. */
function spaceRunEnd(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isSpaceUnit);
}

/** Where the run of non-whitespace (`\S`) that starts at `i` ends. */
function solidRunEnd(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isSolidUnit);
}

/** Every code unit of `s` from `i` on is a digit. */
function allDigitsFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isDigitUnit) === s.length;
}

/** No code unit of `s` from `i` on is a line end. */
function noLineEndFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isInLineUnit) === s.length;
}

/** `s` from `i` on with A-Z lowered; nothing else changes (every input here is ASCII). */
function lowerFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j
    //@ decreases s.length - j
    const c = s.charCodeAt(j);
    acc = acc + (c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : s.slice(j, j + 1));
    j = j + 1;
  }
  return acc;
}

/** `s` with A-Z lowered. Replaces `toLowerCase`, which lsc can translate only with an axiom. */
export function lower(s: string): string {
  //@ verify
  return lowerFrom(s, 0);
}

// ---------------------------------------------------------------- item ids

/** A GitHub item's id: `gh-<repo>-<n>` in the person's org, else `gh-<owner>.<repo>-<n>`, lowered. */
export function githubId(owner: string, repo: string, num: string, org: string): string {
  //@ verify
  const name = lower(owner) === lower(org) ? repo : owner + "." + repo;
  return "gh-" + lower(name) + "-" + num;
}

/** A Basecamp item's id. */
export function basecampId(isMessage: boolean, num: string): string {
  //@ verify
  return (isMessage ? "bc-message-" : "bc-todo-") + num;
}

/** `#500000014` in an issue means a Basecamp todo: todo ids have 9+ digits, issue numbers far fewer. */
function numberedId(owner: string, repo: string, num: string, org: string): string {
  //@ verify
  return num.length >= 9 ? basecampId(false, num) : githubId(owner, repo, num, org);
}

/** The last index before `i` that holds a hyphen, or -1. */
function lastHyphenBefore(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures -1 <= \result && \result < i
  // At 0 there is nothing before: -1, the same `j - 1` a hyphen at 0 would give
  return runStart(s, 0, i, (c: number) => c !== 45) - 1;
}

/** The first index at or after `i` that holds a dot, or -1. */
function firstDotFrom(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures \result === -1 || (i <= \result && \result < s.length)
  const j = runEnd(s, i, (c: number) => c !== 46);
  return j < s.length ? j : -1;
}

/** Owner, repo and number of a GitHub item id; `ok` false when `id` is not one. */
export interface GithubParts {
  ok: boolean;
  owner: string;
  repo: string;
  digits: string;
}

/**
 * `^gh-(.+)-(\d+)$`, then the name split at its first dot into `<owner>.<repo>`; a name with no
 * dot is a repo in the person's org. An org repo whose name contains a dot reads as owner.repo.
 */
export function parseGithubId(id: string, org: string): GithubParts {
  //@ verify
  const none: GithubParts = { ok: false, owner: "", repo: "", digits: "" };
  if (!hasAt(id, 0, "gh-")) return none;
  const k = lastHyphenBefore(id, id.length);
  if (k <= 3) return none;
  const digits = id.slice(k + 1, id.length);
  const name = id.slice(3, k);
  if (digits.length === 0 || !allDigitsFrom(digits, 0) || !noLineEndFrom(name, 0)) return none;
  const dot = firstDotFrom(name, 0);
  if (dot < 0) return { ok: true, owner: org, repo: name, digits };
  return { ok: true, owner: name.slice(0, dot), repo: name.slice(dot + 1, name.length), digits };
}

/** A todo's short label: `bc-todo-<n>` reads `BC<n>`; anything else as it is. */
export function todoLabel(id: string): string {
  //@ verify
  return hasAt(id, 0, "bc-todo-") ? "BC" + id.slice(8, id.length) : id;
}

// ---------------------------------------------------------------- "closes" before a reference
// `\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*$`, ignoring case, on the 24 code units
// before the reference: a reference right after "Fixes" or "closes:" closes its target.

/** The start of the whitespace that ends at `e`, not before `lo`; also where `trim` ends. */
function spaceStartBack(s: string, lo: number, e: number): number {
  //@ verify
  //@ type lo nat
  //@ type e nat
  //@ requires lo <= e && e <= s.length
  return runStart(s, lo, e, isSpaceUnit);
}

/** The keyword `k` (lowercase) ends at `e`, ignoring case, at a word start no earlier than `lo`. */
function keywordEndsAt(s: string, lo: number, e: number, k: string): boolean {
  //@ verify
  //@ type lo nat
  //@ requires lo <= e && e <= s.length
  if (k.length > e - lo) return false;
  const b = e - k.length;
  return lower(s.slice(b, e)) === k && (b === lo || !isWordUnit(s.charCodeAt(b - 1)));
}

/** The reference that starts at `start` follows a closing keyword. */
export function closesBefore(s: string, start: number): boolean {
  //@ verify
  //@ type start nat
  //@ requires start <= s.length
  const lo = start >= 24 ? start - 24 : 0;
  const e1 = spaceStartBack(s, lo, start);
  const e = e1 > lo && s.charCodeAt(e1 - 1) === 58 ? spaceStartBack(s, lo, e1 - 1) : e1;
  return anyKeywordEndsAt(s, lo, e);
}

/** One of the nine closing keywords ends at `e`. */
function anyKeywordEndsAt(s: string, lo: number, e: number): boolean {
  //@ verify
  //@ type lo nat
  //@ requires lo <= e && e <= s.length
  return (
    keywordEndsAt(s, lo, e, "close") ||
    keywordEndsAt(s, lo, e, "closes") ||
    keywordEndsAt(s, lo, e, "closed") ||
    keywordEndsAt(s, lo, e, "fix") ||
    keywordEndsAt(s, lo, e, "fixes") ||
    keywordEndsAt(s, lo, e, "fixed") ||
    keywordEndsAt(s, lo, e, "resolve") ||
    keywordEndsAt(s, lo, e, "resolves") ||
    keywordEndsAt(s, lo, e, "resolved")
  );
}

// ---------------------------------------------------------------- the five reference forms

/** One reference form found at a position: where it ends and its parts. */
interface Hit {
  ok: boolean;
  end: number;
  owner: string;
  repo: string;
  num: string;
  project: string;
  isMessage: boolean;
}

function miss(): Hit {
  //@ verify
  return { ok: false, end: 0, owner: "", repo: "", num: "", project: "", isMessage: false };
}

/** After `https?://` at `i`, or -1. */
function afterScheme(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ ensures \result === -1 || (i < \result && \result <= s.length)
  if (!hasAt(s, i, "http")) return -1;
  const j = hasAt(s, i + 4, "s") ? i + 5 : i + 4;
  return hasAt(s, j, "://") ? j + 3 : -1;
}

/** Where `issues/` or `pull/` after `i` ends, or -1. */
function afterIssuePath(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ ensures \result === -1 || (i < \result && \result <= s.length)
  if (hasAt(s, i, "issues/")) return i + 7;
  if (hasAt(s, i, "pull/")) return i + 5;
  return -1;
}

/** `https?://github.com/<owner>/<repo>/(issues|pull)/<n>` at `i`. */
function githubUrlAt(s: string, i: number): Hit {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures \result.ok ==> (i < \result.end && \result.end <= s.length)
  const j = afterScheme(s, i);
  if (j < 0 || !hasAt(s, j, "github.com/")) return miss();
  const a = j + 11;
  const o = repoRunEnd(s, a);
  if (o === a || !hasAt(s, o, "/")) return miss();
  const r = repoRunEnd(s, o + 1);
  if (r === o + 1 || !hasAt(s, r, "/")) return miss();
  const k = afterIssuePath(s, r + 1);
  if (k < 0) return miss();
  const d = digitRunEnd(s, k);
  if (d === k) return miss();
  return {
    ok: true,
    end: d,
    owner: s.slice(a, o),
    repo: s.slice(o + 1, r),
    num: s.slice(k, d),
    project: "",
    isMessage: false,
  };
}

/** Where `todos/` or `messages/` after `i` ends, or -1. */
function afterRecordPath(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ ensures \result === -1 || (i < \result && \result <= s.length)
  if (hasAt(s, i, "todos/")) return i + 6;
  if (hasAt(s, i, "messages/")) return i + 9;
  return -1;
}

/** `https?://(3.)?basecamp.com/<account>/projects/<project>/(todos|messages)/<n>` at `i`. */
function basecampUrlAt(s: string, i: number): Hit {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures \result.ok ==> (i < \result.end && \result.end <= s.length)
  const j = afterScheme(s, i);
  if (j < 0) return miss();
  const b = hasAt(s, j, "3.") ? j + 2 : j;
  if (!hasAt(s, b, "basecamp.com/")) return miss();
  const a = b + 13;
  const d1 = digitRunEnd(s, a);
  if (d1 === a || !hasAt(s, d1, "/projects/")) return miss();
  const p = d1 + 10;
  const d2 = digitRunEnd(s, p);
  if (d2 === p || !hasAt(s, d2, "/")) return miss();
  const n = afterRecordPath(s, d2 + 1);
  if (n < 0) return miss();
  const d3 = digitRunEnd(s, n);
  if (d3 === n) return miss();
  return {
    ok: true,
    end: d3,
    owner: "",
    repo: "",
    num: s.slice(n, d3),
    project: s.slice(p, d2),
    isMessage: hasAt(s, d2 + 1, "messages/"),
  };
}

/** A reference may start at `q`: at the text's start, or after whitespace, `(` or `[`. */
function leadsAt(s: string, q: number): boolean {
  //@ verify
  //@ type q nat
  //@ requires q <= s.length
  return q === 0 || isLeadUnit(s.charCodeAt(q - 1));
}

/** The digits from `k` end at a word boundary (`\b`). */
function endsWord(s: string, d: number): boolean {
  //@ verify
  //@ type d nat
  //@ requires d <= s.length
  return d === s.length || !isWordUnit(s.charCodeAt(d));
}

/** After a repo from `rs` to `re` (two or more characters, a letter first): `#<n>` and a word boundary. Where the number ends, or -1. */
function repoNumberEnd(s: string, rs: number, re: number): number {
  //@ verify
  //@ type rs nat
  //@ requires rs <= re && re <= s.length
  //@ ensures \result === -1 || (re + 1 < \result && \result <= s.length)
  if (re - rs < 2 || !isAlphaUnit(s.charCodeAt(rs)) || !hasAt(s, re, "#")) return -1;
  const d = digitRunEnd(s, re + 1);
  return d === re + 1 || !endsWord(s, d) ? -1 : d;
}

/** `(<owner>/)?<repo>#<n>` at `q`: the repo two or more characters, a letter first. */
function issueRefAt(s: string, q: number): Hit {
  //@ verify
  //@ type q nat
  //@ requires q <= s.length
  //@ ensures \result.ok ==> (q < \result.end && \result.end <= s.length)
  if (!leadsAt(s, q)) return miss();
  const r1 = repoRunEnd(s, q);
  if (r1 === q) return miss();
  const hasOwner = hasAt(s, r1, "/");
  const rs = hasOwner ? r1 + 1 : q;
  const re = hasOwner ? repoRunEnd(s, r1 + 1) : r1;
  const d = repoNumberEnd(s, rs, re);
  if (d < 0) return miss();
  return {
    ok: true,
    end: d,
    owner: hasOwner ? s.slice(q, r1) : "",
    repo: s.slice(rs, re),
    num: s.slice(re + 1, d),
    project: "",
    isMessage: false,
  };
}

/** A bare `#<n>` at `q`. */
function bareRefAt(s: string, q: number): Hit {
  //@ verify
  //@ type q nat
  //@ requires q <= s.length
  //@ ensures \result.ok ==> (q < \result.end && \result.end <= s.length)
  if (!leadsAt(s, q) || !hasAt(s, q, "#")) return miss();
  const d = digitRunEnd(s, q + 1);
  if (d === q + 1 || !endsWord(s, d)) return miss();
  return {
    ok: true,
    end: d,
    owner: "",
    repo: "",
    num: s.slice(q + 1, d),
    project: "",
    isMessage: false,
  };
}

/** `BC<n>`, six or more digits, as a whole word, at `i`. */
function bcRefAt(s: string, i: number): Hit {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures \result.ok ==> (i < \result.end && \result.end <= s.length)
  if ((i > 0 && isWordUnit(s.charCodeAt(i - 1))) || !hasAt(s, i, "BC")) return miss();
  const d = digitRunEnd(s, i + 2);
  if (d - (i + 2) < 6 || !endsWord(s, d)) return miss();
  return {
    ok: true,
    end: d,
    owner: "",
    repo: "",
    num: s.slice(i + 2, d),
    project: "",
    isMessage: false,
  };
}

// ---------------------------------------------------------------- references in a text

/** One reference: its target's id, whether it closes it, and a Basecamp link's project ("" if none). */
export interface Ref {
  id: string;
  closes: boolean;
  project: string;
}

/** The item whose text is read: a GitHub item gives bare `#<n>` its repo. */
export interface RefContext {
  hasRepo: boolean;
  owner: string;
  repo: string;
  org: string;
}

/** The context of an item: a GitHub item's `ref` (`<owner>/<repo>#<n>`) names its repo. */
export function refContext(isGithub: boolean, ref: string, org: string): RefContext {
  //@ verify
  const none: RefContext = { hasRepo: false, owner: "", repo: "", org };
  if (!isGithub) return none;
  const o = repoRunEnd(ref, 0);
  if (o === 0 || !hasAt(ref, o, "/")) return none;
  const r = repoRunEnd(ref, o + 1);
  if (r === o + 1 || !hasAt(ref, r, "#")) return none;
  const d = digitRunEnd(ref, r + 1);
  if (d === r + 1 || d !== ref.length) return none;
  return { hasRepo: true, owner: ref.slice(0, o), repo: ref.slice(o + 1, r), org };
}

/** The index of the reference to `id` at or after `i`, or -1. */
function refIndex(refs: Ref[], id: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= refs.length
  //@ ensures \result === -1 || (i <= \result && \result < refs.length)
  const j = listEnd(refs, i, (r: Ref) => r.id !== id);
  return j < refs.length ? j : -1;
}

/** The reference at `k` seen again: `closes` wins over a mention, and a project, once known, is kept. */
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

/** Add a reference: a new target goes last; a known one keeps its place. */
function addRef(refs: Ref[], id: string, closes: boolean, project: string): Ref[] {
  //@ verify
  const k = refIndex(refs, id, 0);
  if (k < 0) return [...refs, { id, closes, project }];
  return mergeAt(refs, k, closes, project);
}

/** GitHub issue and PR links, from `i` on. */
function scanGithubUrls(s: string, i: number, ctx: RefContext, refs: Ref[]): Ref[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = refs;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const h = githubUrlAt(s, j);
    if (h.ok) {
      acc = addRef(acc, githubId(h.owner, h.repo, h.num, ctx.org), closesBefore(s, j), "");
      j = h.end;
    } else {
      j = j + 1;
    }
  }
  return acc;
}

/** The id `(<owner>/)?<repo>#<n>` names, or "": `GH#<n>` is the item's own repo, like a bare `#<n>`. */
function issueRefId(h: Hit, ctx: RefContext): string {
  //@ verify
  if (h.owner === "" && lower(h.repo) === "gh")
    return ctx.hasRepo ? numberedId(ctx.owner, ctx.repo, h.num, ctx.org) : "";
  return numberedId(h.owner === "" ? ctx.org : h.owner, h.repo, h.num, ctx.org);
}

/** `<owner>/<repo>#<n>` and `<repo>#<n>`, from `i` on. */
function scanIssueRefs(s: string, i: number, ctx: RefContext, refs: Ref[]): Ref[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = refs;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const h = issueRefAt(s, j);
    if (h.ok) {
      const id = issueRefId(h, ctx);
      if (id !== "") acc = addRef(acc, id, closesBefore(s, j), "");
      j = h.end;
    } else {
      j = j + 1;
    }
  }
  return acc;
}

/** The first GitHub reference found so far whose number is `num`, from `i` on, or "". */
function knownIssueId(refs: Ref[], num: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  const tail = "-" + num;
  let j = i;
  while (j < refs.length) {
    //@ invariant i <= j
    //@ decreases refs.length - j
    const id = refs[j]!.id;
    if (
      hasAt(id, 0, "gh-") &&
      id.length >= tail.length &&
      id.slice(id.length - tail.length, id.length) === tail
    )
      return id;
    j = j + 1;
  }
  return "";
}

/** The id a bare `#<n>` names: the issue the text already named with that number, else the item's own repo's, else "". */
function bareRefId(refs: Ref[], num: string, ctx: RefContext): string {
  //@ verify
  const known = knownIssueId(refs, num, 0);
  if (known !== "") return known;
  return ctx.hasRepo ? numberedId(ctx.owner, ctx.repo, num, ctx.org) : "";
}

/** Bare `#<n>`, from `i` on. */
function scanBareRefs(s: string, i: number, ctx: RefContext, refs: Ref[]): Ref[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = refs;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const h = bareRefAt(s, j);
    if (h.ok) {
      const id = bareRefId(acc, h.num, ctx);
      if (id !== "") acc = addRef(acc, id, closesBefore(s, j), "");
      j = h.end;
    } else {
      j = j + 1;
    }
  }
  return acc;
}

/** Basecamp todo and message links, from `i` on. */
function scanBasecampUrls(s: string, i: number, refs: Ref[]): Ref[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = refs;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const h = basecampUrlAt(s, j);
    if (h.ok) {
      acc = addRef(acc, basecampId(h.isMessage, h.num), closesBefore(s, j), h.project);
      j = h.end;
    } else {
      j = j + 1;
    }
  }
  return acc;
}

/** `BC<n>`, from `i` on. */
function scanBcRefs(s: string, i: number, refs: Ref[]): Ref[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = refs;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const h = bcRefAt(s, j);
    if (h.ok) {
      acc = addRef(acc, basecampId(false, h.num), closesBefore(s, j), "");
      j = h.end;
    } else {
      j = j + 1;
    }
  }
  return acc;
}

/** Every reference in `s`, each target once, in the order first found: links, then `repo#n`, bare `#n`, Basecamp links, `BC<n>`. */
export function extractRefs(s: string, ctx: RefContext): Ref[] {
  //@ verify
  const a = scanGithubUrls(s, 0, ctx, []);
  const b = scanIssueRefs(s, 0, ctx, a);
  const c = scanBareRefs(s, 0, ctx, b);
  const d = scanBasecampUrls(s, 0, c);
  return scanBcRefs(s, 0, d);
}

// ---------------------------------------------------------------- comment headings
// `^### (.+?) · (\S+)\s*$`, multiline: a line `### <author> · <when>` starts a comment.

/** A comment heading: where it ends, its author, and when. */
interface Head {
  ok: boolean;
  end: number;
  author: string;
  at: string;
}

function noHead(): Head {
  //@ verify
  return { ok: false, end: 0, author: "", at: "" };
}

/** The last line end in `[from, to)`, or -1. */
function lastLineEndIn(s: string, lo: number, hi: number): number {
  //@ verify
  //@ type lo nat
  //@ type hi nat
  //@ requires lo <= hi && hi <= s.length
  //@ ensures \result === -1 || (lo <= \result && \result < hi)
  const j = runStart(s, lo, hi, isInLineUnit);
  return j > lo ? j - 1 : -1;
}

/** After ` · ` at `t`: `\S+\s*$`. Where the heading ends, or -1. */
function headTailEnd(s: string, t: number): number {
  //@ verify
  //@ type t nat
  //@ requires t <= s.length
  //@ ensures \result === -1 || (t < \result && \result <= s.length)
  const e = solidRunEnd(s, t);
  if (e === t) return -1;
  const w = spaceRunEnd(s, e);
  if (w === s.length) return w;
  return lastLineEndIn(s, e, w);
}

/** The shortest author from `a` to `m` or later, with no line end, that ` · <when>` follows. */
function headFrom(s: string, a: number, m: number): Head {
  //@ verify
  //@ pure
  //@ type a nat
  //@ type m nat
  //@ requires a < m && m <= s.length
  //@ ensures \result.ok ==> (m < \result.end && \result.end <= s.length)
  let k = m;
  while (k < s.length) {
    //@ invariant m <= k && k <= s.length
    //@ decreases s.length - k
    if (hasAt(s, k, " · ")) {
      const end = headTailEnd(s, k + 3);
      if (end >= 0) {
        const tail = solidRunEnd(s, k + 3);
        return { ok: true, end, author: s.slice(a, k), at: s.slice(k + 3, tail) };
      }
    }
    if (isLineEndUnit(s.charCodeAt(k))) return noHead();
    k = k + 1;
  }
  // At the end no ` · ` fits, and the author has run out.
  return noHead();
}

/** A comment heading at line start `p`. */
function headAt(s: string, p: number): Head {
  //@ verify
  //@ type p nat
  //@ requires p <= s.length
  //@ ensures \result.ok ==> (p < \result.end && \result.end <= s.length)
  if (p > 0 && !isLineEndUnit(s.charCodeAt(p - 1))) return noHead();
  if (!hasAt(s, p, "### ")) return noHead();
  const a = p + 4;
  if (a >= s.length || isLineEndUnit(s.charCodeAt(a))) return noHead();
  return headFrom(s, a, a + 1);
}

/** A part of an item's body: its author, when, and text. */
export interface Segment {
  author: string;
  at: string;
  text: string;
}

/** The next comment heading at or after `i`, with its start, or none (`start` = the body's length). */
function nextHead(s: string, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures i <= \result && \result <= s.length
  //@ ensures \result === s.length || headAt(s, \result).ok
  let j = i;
  while (j < s.length && !headAt(s, j).ok) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    j = j + 1;
  }
  return j;
}

/** The comments from `p`, a heading's start or the end, on: each heading's author and when, and the text to the next heading. */
function commentsFrom(s: string, p: number): Segment[] {
  //@ verify
  //@ pure
  //@ type p nat
  //@ requires p <= s.length
  //@ requires p === s.length || headAt(s, p).ok
  const acc: Segment[] = [];
  let q = p;
  while (q < s.length) {
    //@ invariant p <= q && q <= s.length
    //@ invariant q === s.length || headAt(s, q).ok
    //@ decreases s.length - q
    const h = headAt(s, q);
    const n = nextHead(s, h.end);
    acc.push({ author: h.author, at: h.at, text: s.slice(h.end, n) });
    q = n;
  }
  return acc;
}

/** An item's body as its description (by `author`, at `at`) and one segment per `### author · when` comment. */
export function splitSegments(body: string, author: string, at: string): Segment[] {
  //@ verify
  const first = nextHead(body, 0);
  return [{ author, at, text: body.slice(0, first) }, ...commentsFrom(body, first)];
}

// ---------------------------------------------------------------- frontmatter
// The strict YAML subset work/ files use: `key: value`, `key: [a, b]`, and `key:` followed by
// `  - item` lines. Written by `formatScalar`/`formatList`, read back by `parseYaml`.

/** `String.prototype.trim`: the whitespace runs at each end, cut. */
export function trimText(s: string): string {
  //@ verify
  const a = spaceRunEnd(s, 0);
  return s.slice(a, spaceStartBack(s, a, s.length));
}

/** A code unit YAML would read as syntax: `: # , [ ] " '`. */
function isYamlMark(c: number): boolean {
  //@ verify
  return c === 58 || c === 35 || c === 44 || c === 91 || c === 93 || c === 34 || c === 39;
}

/** `s` from `i` on holds a YAML mark. */
function hasMarkFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, (c: number) => !isYamlMark(c)) < s.length;
}

/** `s` from `i` on holds a double quote. */
function hasDoubleQuoteFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, (c: number) => c !== 34) < s.length;
}

/** One value as written: as it is, or quoted when it is empty, holds a mark, or starts or ends with whitespace; single quotes when it holds a double quote. */
export function formatScalar(text: string): string {
  //@ verify
  const plain =
    text.length > 0 &&
    !hasMarkFrom(text, 0) &&
    !isSpaceUnit(text.charCodeAt(0)) &&
    !isSpaceUnit(text.charCodeAt(text.length - 1));
  if (plain) return text;
  return hasDoubleQuoteFrom(text, 0) ? "'" + text + "'" : '"' + text + '"';
}

/** The list items from `i` on, each formatted, joined by ", ". */
function formatItemsFrom(items: string[], i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let j = i;
  while (j < items.length) {
    //@ invariant i <= j
    //@ decreases items.length - j
    acc = acc + formatScalar(items[j]!) + (j + 1 >= items.length ? "" : ", ");
    j = j + 1;
  }
  return acc;
}

/** A list as written: `[a, b]`. Items MUST NOT contain commas. */
export function formatList(items: string[]): string {
  //@ verify
  return "[" + formatItemsFrom(items, 0) + "]";
}

/** One value as read: trimmed, and unquoted when it is `"..."` or `'...'` on one line. */
export function parseScalar(raw: string): string {
  //@ verify
  const v = trimText(raw);
  if (v.length < 2) return v;
  const q = v.charCodeAt(0);
  if ((q !== 34 && q !== 39) || v.charCodeAt(v.length - 1) !== q) return v;
  const inner = v.slice(1, v.length - 1);
  return noLineEndFrom(inner, 0) ? inner : v;
}

/** Where the comma at or after `i` is, or the end. */
function commaFrom(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, (c: number) => c !== 44);
}

/** The comma-separated parts of `s` from `i` on, each read as a value. */
function splitItemsFrom(s: string, i: number): string[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  const acc: string[] = [];
  let j = i;
  let c = commaFrom(s, j);
  while (c < s.length) {
    //@ invariant i <= j && j <= c && c <= s.length
    //@ decreases s.length - j
    acc.push(parseScalar(s.slice(j, c)));
    j = c + 1;
    c = commaFrom(s, j);
  }
  acc.push(parseScalar(s.slice(j, c)));
  return acc;
}

/** A value read: a list (`[...]`) or one scalar. */
export interface YamlValue {
  isList: boolean;
  scalar: string;
  items: string[];
}

/** The text after `key:`, read: `[a, b]` is a list, `[]` an empty one, anything else a scalar. */
export function parseValue(raw: string): YamlValue {
  //@ verify
  const v = trimText(raw);
  if (v.length < 2 || v.charCodeAt(0) !== 91 || v.charCodeAt(v.length - 1) !== 93)
    return { isList: false, scalar: parseScalar(v), items: [] };
  const inner = trimText(v.slice(1, v.length - 1));
  if (inner.length === 0) return { isList: true, scalar: "", items: [] };
  return { isList: true, scalar: "", items: splitItemsFrom(inner, 0) };
}

/** What a frontmatter line is. */
type LineKind = "blank" | "item" | "pair" | "bad";

/** One frontmatter line read: its kind, and the key and rest of a pair or the text of an item. */
export interface YamlLine {
  kind: LineKind;
  key: string;
  rest: string;
}

/** `[a-z_]`: a frontmatter key's character. */
function isKeyUnit(c: number): boolean {
  //@ verify
  return (c >= 97 && c <= 122) || c === 95;
}

/** Where the run of key characters that starts at `i` ends. */
function keyRunEnd(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isKeyUnit);
}

/** `^\s+-\s+(.+)$`: the item's text from the greedy match, or -1 when the line is not one. */
function itemStart(line: string): number {
  //@ verify
  //@ ensures \result === -1 || (0 <= \result && \result < line.length)
  const i = spaceRunEnd(line, 0);
  if (i === 0 || !hasAt(line, i, "-")) return -1;
  const j = spaceRunEnd(line, i + 1);
  if (j === i + 1) return -1;
  if (j < line.length) return noLineEndFrom(line, j) ? j : -1;
  // The item cannot be empty: the last whitespace is its text when it is not a line end
  if (j - 1 >= i + 2 && !isLineEndUnit(line.charCodeAt(j - 1))) return j - 1;
  return -1;
}

/** One line of frontmatter: `^\s*(#.*)?$` is blank, then an item, then `^([a-z_]+):(.*)$`. */
export function classifyLine(line: string): YamlLine {
  //@ verify
  const s = spaceRunEnd(line, 0);
  if (s === line.length || (hasAt(line, s, "#") && noLineEndFrom(line, s + 1)))
    return { kind: "blank", key: "", rest: "" };
  const t = itemStart(line);
  if (t >= 0) return { kind: "item", key: "", rest: line.slice(t, line.length) };
  const k = keyRunEnd(line, 0);
  if (k > 0 && hasAt(line, k, ":") && noLineEndFrom(line, k + 1))
    return { kind: "pair", key: line.slice(0, k), rest: line.slice(k + 1, line.length) };
  return { kind: "bad", key: "", rest: "" };
}

/** One key's value in the order the keys first appear. */
interface YamlEntry {
  key: string;
  value: YamlValue;
}

/** A line the reader refused: `bad` (unsupported syntax, with the line trimmed) or `duplicate` (with the key). */
interface YamlProblem {
  line: number;
  kind: string;
  text: string;
}

/** Frontmatter read: its entries and its problems. */
export interface Yaml {
  entries: YamlEntry[];
  problems: YamlProblem[];
}

/** The index of `key` at or after `i`, or -1. */
function entryIndex(entries: YamlEntry[], key: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= entries.length
  //@ ensures \result === -1 || (i <= \result && \result < entries.length)
  const j = listEnd(entries, i, (e: YamlEntry) => e.key !== key);
  return j < entries.length ? j : -1;
}

/** Set `key`: a new key goes last; a key seen before keeps its place. */
function setEntry(entries: YamlEntry[], key: string, value: YamlValue): YamlEntry[] {
  //@ verify
  const k = entryIndex(entries, key, 0);
  if (k < 0) return [...entries, { key, value }];
  return [...entries.slice(0, k), { key, value }, ...entries.slice(k + 1)];
}

/** The entries from `i` on, with `item` added to the list `listKey` (keys are unique). */
function pushItemFrom(entries: YamlEntry[], i: number, listKey: string, item: string): YamlEntry[] {
  //@ verify
  //@ pure
  //@ type i nat
  const acc: YamlEntry[] = [];
  let j = i;
  while (j < entries.length) {
    //@ invariant i <= j
    //@ decreases entries.length - j
    const e = entries[j]!;
    const head: YamlEntry =
      e.key === listKey
        ? { key: e.key, value: { isList: true, scalar: "", items: [...e.value.items, item] } }
        : e;
    acc.push(head);
    j = j + 1;
  }
  return acc;
}

/** Add an item to the list being read, `listKey`. */
function pushItem(entries: YamlEntry[], listKey: string, item: string): YamlEntry[] {
  //@ verify
  return pushItemFrom(entries, 0, listKey, item);
}

/** One pair line read into `yaml`, at line `i`. */
function readPair(yaml: Yaml, i: number, key: string, rest: string): Yaml {
  //@ verify
  const opensList = trimText(rest).length === 0;
  const value: YamlValue = opensList ? { isList: true, scalar: "", items: [] } : parseValue(rest);
  const problems =
    entryIndex(yaml.entries, key, 0) >= 0
      ? [...yaml.problems, { line: i, kind: "duplicate", text: key }]
      : yaml.problems;
  return { entries: setEntry(yaml.entries, key, value), problems };
}

/** The lines from `i` on read into `yaml`; `listKey` is the list being read ("" for none). */
function readLines(lines: string[], i: number, listKey: string, yaml: Yaml): Yaml {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = yaml;
  let current = listKey;
  let j = i;
  while (j < lines.length) {
    //@ invariant i <= j
    //@ decreases lines.length - j
    const line = classifyLine(lines[j]!);
    if (line.kind === "item" && current !== "") {
      const entries = pushItem(acc.entries, current, parseScalar(line.rest));
      acc = { entries, problems: acc.problems };
    } else if (line.kind === "pair") {
      const next = trimText(line.rest).length === 0 ? line.key : "";
      acc = readPair(acc, j, line.key, line.rest);
      current = next;
    } else if (line.kind !== "blank") {
      const bad: YamlProblem = { line: j, kind: "bad", text: trimText(lines[j]!) };
      acc = { entries: acc.entries, problems: [...acc.problems, bad] };
    }
    j = j + 1;
  }
  return acc;
}

/** Frontmatter lines (between the `---` lines) read: entries in first-seen order, and problems. */
export function parseYaml(lines: string[]): Yaml {
  //@ verify
  return readLines(lines, 0, "", { entries: [], problems: [] });
}

// ---------------------------------------------------------------- field formats

/** `[a-z0-9]`. */
function isIdStartUnit(c: number): boolean {
  //@ verify
  return (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
}

/** `[a-z0-9._-]`. */
function isIdRestUnit(c: number): boolean {
  //@ verify
  return isIdStartUnit(c) || c === 46 || c === 95 || c === 45;
}

/** `[a-z0-9._-]` from `i` on. */
function idRestFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, isIdRestUnit) === s.length;
}

/** An id: `^[a-z0-9][a-z0-9._-]*$`. */
export function isIdText(s: string): boolean {
  //@ verify
  return s.length > 0 && isIdStartUnit(s.charCodeAt(0)) && idRestFrom(s, 1);
}

/** `s` holds a non-whitespace code unit from `i` on (`\S`). */
function hasSolidFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return spaceRunEnd(s, i) < s.length;
}

/** The number of `=` in `s` from `i` on. */
function equalsFrom(s: string, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ ensures \result >= 0
  let n = 0;
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && n >= 0
    //@ decreases s.length - j
    if (s.charCodeAt(j) === 61) n = n + 1;
    j = j + 1;
  }
  return n;
}

/** The first `=` at or after `i`, or the end. */
function equalsAt(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return runEnd(s, i, (c: number) => c !== 61);
}

/** An alias: `^[^=]+=[^=]+$`, one `=` with text on both sides. */
function isAliasText(s: string): boolean {
  //@ verify
  const e = equalsAt(s, 0);
  return equalsFrom(s, 0) === 1 && e > 0 && e + 1 < s.length;
}

/** A watched repo: `^[\w.-]+(\/[\w.-]+)?$`. */
function isWatchRepoText(s: string): boolean {
  //@ verify
  const a = repoRunEnd(s, 0);
  if (a === 0) return false;
  if (a === s.length) return true;
  if (!hasAt(s, a, "/")) return false;
  const b = repoRunEnd(s, a + 1);
  return b > a + 1 && b === s.length;
}

/** A repo name: `^[\w.-]+$`. */
function isRepoText(s: string): boolean {
  //@ verify
  return s.length > 0 && repoRunEnd(s, 0) === s.length;
}

/** `^\d+$`. */
function isDigitText(s: string): boolean {
  //@ verify
  return s.length > 0 && allDigitsFrom(s, 0);
}

/** `^([1-9]|[1-5]\d|60)$`: minutes from 1 to 60. */
function isMinutesText(s: string): boolean {
  //@ verify
  if (s.length === 1) return s.charCodeAt(0) >= 49 && s.charCodeAt(0) <= 57;
  if (s.length !== 2) return false;
  const a = s.charCodeAt(0);
  const b = s.charCodeAt(1);
  return (a >= 49 && a <= 53 && isDigitUnit(b)) || (a === 54 && b === 48);
}

/** `\d{n}` at `i`. */
function digitsAt(s: string, i: number, n: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  //@ type n nat
  let k = 0;
  while (k < n && i + k < s.length && isDigitUnit(s.charCodeAt(i + k))) {
    //@ invariant 0 <= k && k <= n
    //@ decreases n - k
    k = k + 1;
  }
  return k >= n;
}

/** `\d{4}-\d{2}-\d{2}` at the start. */
function isDayPart(s: string): boolean {
  //@ verify
  return (
    digitsAt(s, 0, 4) &&
    hasAt(s, 4, "-") &&
    digitsAt(s, 5, 2) &&
    hasAt(s, 7, "-") &&
    digitsAt(s, 8, 2)
  );
}

/** After an optional `:\d{2}(\.\d+)?` at `p`. */
function afterSeconds(s: string, p: number): number {
  //@ verify
  //@ type p nat
  //@ requires p <= s.length
  //@ ensures p <= \result && \result <= s.length
  if (!hasAt(s, p, ":") || !digitsAt(s, p + 1, 2)) return p;
  const q = p + 3;
  if (!hasAt(s, q, ".")) return q;
  const d = digitRunEnd(s, q + 1);
  return d > q + 1 ? d : q;
}

/** After an optional zone `Z|[+-]\d{2}:?\d{2}` at `p`, or -1 when it starts but does not finish. */
function afterZone(s: string, p: number): number {
  //@ verify
  //@ type p nat
  //@ requires p <= s.length
  if (hasAt(s, p, "Z")) return p + 1;
  if (!hasAt(s, p, "+") && !hasAt(s, p, "-")) return p;
  if (!digitsAt(s, p + 1, 2)) return -1;
  const c = hasAt(s, p + 3, ":") ? p + 4 : p + 3;
  return digitsAt(s, c, 2) ? c + 2 : -1;
}

/** A date or time: `^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$`. */
export function isWhenText(s: string): boolean {
  //@ verify
  if (!isDayPart(s)) return false;
  if (s.length === 10) return true;
  if (!hasAt(s, 10, "T") || !digitsAt(s, 11, 2) || !hasAt(s, 13, ":") || !digitsAt(s, 14, 2))
    return false;
  return afterZone(s, afterSeconds(s, 16)) === s.length;
}

/** A brief's stamp: `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$`. */
function isStampText(s: string): boolean {
  //@ verify
  return (
    s.length === 16 &&
    isDayPart(s) &&
    hasAt(s, 10, " ") &&
    digitsAt(s, 11, 2) &&
    hasAt(s, 13, ":") &&
    digitsAt(s, 14, 2)
  );
}

/** The format a field's value must have, by its rule's name. Unknown names never match. */
export function matchesFormat(format: string, v: string): boolean {
  //@ verify
  return matchesNameFormat(format, v) || matchesValueFormat(format, v);
}

/** The formats of names: ids, text, aliases, repos. */
function matchesNameFormat(format: string, v: string): boolean {
  //@ verify
  if (format === "id") return isIdText(v);
  if (format === "text") return hasSolidFrom(v, 0);
  if (format === "alias") return isAliasText(v);
  if (format === "watch-repo") return isWatchRepoText(v);
  if (format === "repo") return isRepoText(v);
  return false;
}

/** The formats of values: digits, minutes, URLs, times. */
function matchesValueFormat(format: string, v: string): boolean {
  //@ verify
  if (format === "digits") return isDigitText(v);
  if (format === "minutes") return isMinutesText(v);
  if (format === "url") return hasAt(v, 0, "http://") || hasAt(v, 0, "https://");
  if (format === "when") return isWhenText(v);
  if (format === "stamp") return isStampText(v);
  return false;
}

/** `xs` holds `x` from `i` on. */
function holdsFrom(xs: string[], x: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= xs.length
  return listEnd(xs, i, (y: string) => y !== x) < xs.length;
}

/** `xs` holds `x`. */
export function holds(xs: string[], x: string): boolean {
  //@ verify
  return holdsFrom(xs, x, 0);
}

/** The item at `i` repeats one before it: listed twice. */
export function repeatsAt(xs: string[], i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i < xs.length
  return holds(xs.slice(0, i), xs[i]!);
}

/** What is wrong with a scalar field, first problem first: `empty` (missing, a list, or ""), `enum`, `format`, or "" when fine. */
export function scalarProblem(
  isList: boolean,
  v: string,
  hasEnum: boolean,
  allowed: string[],
  format: string,
): string {
  //@ verify
  if (isList || v.length === 0) return "empty";
  if (hasEnum && !holds(allowed, v)) return "enum";
  if (format !== "" && !matchesFormat(format, v)) return "format";
  return "";
}

/** A file's expected id: its name, or for a README.md its folder's. */
export function idFromFile(name: string, folder: string): string {
  //@ verify
  return name === "README" ? folder : name;
}

// ---------------------------------------------------------------- order

/** Code-unit order, as JavaScript's `<` and default `sort()` compare strings: -1, 0 or 1. */
export function compareText(a: string, b: string): number {
  //@ verify
  return compareFrom(a, b, 0);
}

function compareFrom(a: string, b: string, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  let j = i;
  while (j < a.length && j < b.length && a.charCodeAt(j) === b.charCodeAt(j)) {
    //@ invariant i <= j
    //@ decreases a.length - j
    j = j + 1;
  }
  if (j >= a.length) return j < b.length ? -1 : 0;
  if (j >= b.length) return 1;
  return a.charCodeAt(j) < b.charCodeAt(j) ? -1 : 1;
}

/** The later of two texts in code-unit order: what `sort().at(-1)` picks. */
export function laterText(a: string, b: string): string {
  //@ verify
  return compareText(a, b) < 0 ? b : a;
}

/** The earlier of two present texts ("" is absent). */
export function earlierPresent(a: string, b: string): string {
  //@ verify
  if (a === "") return b;
  if (b === "") return a;
  return compareText(b, a) < 0 ? b : a;
}

// ---------------------------------------------------------------- refresh

/** 15 minutes: a work/.lock older than this is from a run that died, and the next run takes it over. */
export function isLockStale(now: number, lockedAt: number): boolean {
  //@ verify
  //@ ensures \result <==> now - lockedAt >= 900000
  return now - lockedAt >= 900000;
}

/** On unless set to "false" (a missing or list value reads ""). */
export function autoSyncOf(value: string): boolean {
  //@ verify
  //@ ensures \result <==> value !== "false"
  return value !== "false";
}

/** The GitHub org work/README.md names (`org:`, "" when absent), or SimpleApps' when it names none. */
export function orgOf(value: string): string {
  //@ verify
  return value === "" ? "simpleapps-com" : value;
}

/** How often the pane checks, in minutes: the setting when set, else 5. */
export function syncMinutesOf(isSet: boolean, minutes: number): number {
  //@ verify
  return isSet ? minutes : 5;
}

/** The Basecamp project of a todo item's `ref` (`basecamp:<project>/...`), or "". */
export function projectOfRef(ref: string): string {
  //@ verify
  if (!hasAt(ref, 0, "basecamp:")) return "";
  const d = digitRunEnd(ref, 9);
  return d > 9 && hasAt(ref, d, "/") ? ref.slice(9, d) : "";
}

/** A hub `import-bc` or `follow` created, whose summary nobody has edited. */
export function isAutoHub(summary: string): boolean {
  //@ verify
  return hasAt(summary, 0, "Auto-created by work ");
}

/** A name a folder listing shows: not a dotfile. */
export function isVisibleName(name: string): boolean {
  //@ verify
  return !hasAt(name, 0, ".");
}

/** Every name from `i` on is `items`. */
function allItemsFrom(names: string[], i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= names.length
  return listEnd(names, i, (n: string) => n === "items") === names.length;
}

/** A hub holds nothing: besides README.md, at most an `items/` with nothing visible in it. */
export function isEmptyHub(others: string[], visibleItems: number): boolean {
  //@ verify
  return allItemsFrom(others, 0) && visibleItems === 0;
}

// ---------------------------------------------------------------- site briefs

/** The project in a Basecamp record's URL: the digits of the first `/projects/<n>/`, or "". */
export function projectInUrl(url: string): string {
  //@ verify
  return projectInUrlFrom(url, 0);
}

function projectInUrlFrom(url: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= url.length
  let j = i;
  while (j < url.length) {
    //@ invariant i <= j && j <= url.length
    //@ decreases url.length - j
    if (hasAt(url, j, "/projects/")) {
      const d = digitRunEnd(url, j + 10);
      if (d > j + 10 && hasAt(url, d, "/")) return url.slice(j + 10, d);
    }
    j = j + 1;
  }
  return "";
}

/** A brief's table cell: `|` escaped, each run of whitespace one space. */
export function briefCell(text: string): string {
  //@ verify
  return briefCellFrom(text, 0);
}

function briefCellFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const c = s.charCodeAt(j);
    if (isSpaceUnit(c)) {
      acc = acc + " ";
      j = spaceRunEnd(s, j);
    } else {
      acc = acc + (c === 124 ? "\\|" : s.slice(j, j + 1));
      j = j + 1;
    }
  }
  return acc;
}

/** 14 days: an open item with no activity for that long is quiet. */
export function isQuiet(hasUpdated: boolean, todayMs: number, updatedMs: number): boolean {
  //@ verify
  //@ ensures \result <==> (hasUpdated && todayMs - updatedMs >= 1209600000)
  return hasUpdated && todayMs - updatedMs >= 1209600000;
}

/** The summary between a pair of markers exists: both found, in order. */
export function markersInOrder(start: number, end: number): boolean {
  //@ verify
  //@ ensures \result <==> (start !== -1 && end >= start)
  return start !== -1 && end >= start;
}

// ---------------------------------------------------------------- the digest (README.md)

/** A bot's login: `<name>[bot]`. Bots never wait on anyone. */
export function isBotName(person: string): boolean {
  //@ verify
  return person.length >= 5 && person.slice(person.length - 5, person.length) === "[bot]";
}

/** The last index from `i` down whose flag is set, or -1. */
function lastSetBefore(flags: boolean[], i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= flags.length
  //@ ensures -1 <= \result && \result < i
  let j = i;
  while (j > 0 && !flags[j - 1]) {
    //@ invariant j <= i
    //@ decreases j
    j = j - 1;
  }
  return j - 1;
}

/** The person's last word in a thread: the last segment written by them, or -1. */
export function lastMineIndex(mine: boolean[]): number {
  //@ verify
  return lastSetBefore(mine, mine.length);
}

/** A segment after the person's last word waits on them: written by someone else, not a bot. */
export function waitsOn(hasAuthor: boolean, isMe: boolean, isBot: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (hasAuthor && !isMe && !isBot)
  return hasAuthor && !isMe && !isBot;
}

/** Another person's open item holds up on the items it references: it has owners, none of them the person. */
export function holdsUp(owners: number, anyIsMe: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (owners > 0 && !anyIsMe)
  return owners > 0 && !anyIsMe;
}

/** Past its due date. */
export function isOverdue(due: string, today: string): boolean {
  //@ verify
  return due !== "" && compareText(due, today) < 0;
}

/** Due today or within 7 days. */
export function isDueSoon(due: string, today: string, days: number): boolean {
  //@ verify
  return due !== "" && compareText(due, today) >= 0 && days <= 7;
}

/** No activity for 30 days or more. */
export function isStale(touched: string, days: number): boolean {
  //@ verify
  //@ ensures \result <==> (touched !== "" && days >= 30)
  return touched !== "" && days >= 30;
}

/** A linked Basecamp todo work/ has not fetched. */
export function isUnfetched(id: string, known: boolean): boolean {
  //@ verify
  return hasAt(id, 0, "bc-") && !known;
}

/** Rows a section leaves out past its 15. */
export function rowsLeftOut(total: number): number {
  //@ verify
  //@ ensures \result === (total > 15 ? total - 15 : 0)
  return total > 15 ? total - 15 : 0;
}

/** The bottleneck order: most people held up, then most dependent items, then the longest wait. */
export function impactOrder(
  blockedA: number,
  blockedB: number,
  dependentsA: number,
  dependentsB: number,
  sinceA: string,
  sinceB: string,
): number {
  //@ verify
  if (blockedA !== blockedB) return blockedB - blockedA;
  if (dependentsA !== dependentsB) return dependentsB - dependentsA;
  return compareText(sinceA === "" ? "9" : sinceA, sinceB === "" ? "9" : sinceB);
}

/** A number's digits as `Number` prints them: leading zeros dropped (exact below 2^53). */
export function numberText(digits: string): string {
  //@ verify
  return numberTextFrom(digits, 0);
}

function numberTextFrom(d: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= d.length
  let j = i;
  while (j + 1 < d.length && d.charCodeAt(j) === 48) {
    //@ invariant i <= j && j <= d.length
    //@ decreases d.length - j
    j = j + 1;
  }
  return d.slice(j, d.length);
}

/** An item's short label: `<repo>#<n>` for GitHub, `BC<n>` for a Basecamp todo. */
export function shortRef(id: string, org: string): string {
  //@ verify
  const gh = parseGithubId(id, org);
  return gh.ok ? gh.repo + "#" + numberText(gh.digits) : todoLabel(id);
}

/** The person's item: from a repo a hub syncs in full, or written by or assigned to them. */
export function isMine(ownedRepo: boolean, anyIsMe: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (ownedRepo || anyIsMe)
  return ownedRepo || anyIsMe;
}

// ---------------------------------------------------------------- the list (LIST.md)

/** On the list: a Basecamp todo assigned to the person, or an open issue in a watched repo. */
export function isListed(
  isBasecamp: boolean,
  isAssigned: boolean,
  isIssue: boolean,
  watched: boolean,
): boolean {
  //@ verify
  //@ ensures \result <==> (isBasecamp ? isAssigned : (isIssue && watched))
  return isBasecamp ? isAssigned : isIssue && watched;
}

/** Issues by repo, then number. */
export function issueOrder(repoA: string, repoB: string, numberA: number, numberB: number): number {
  //@ verify
  const byRepo = compareText(repoA, repoB);
  return byRepo !== 0 ? byRepo : numberA - numberB;
}

// ---------------------------------------------------------------- the chart (chart.md)

/** `[a-zA-Z0-9]`. */
function isAlnumUnit(c: number): boolean {
  //@ verify
  return isAlphaUnit(c) || isDigitUnit(c);
}

function nodeNameFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j
    //@ decreases s.length - j
    acc = acc + (isAlnumUnit(s.charCodeAt(j)) ? s.slice(j, j + 1) : "_");
    j = j + 1;
  }
  return acc;
}

/** A Mermaid node id: `n_` and the id with each code unit outside a-z, A-Z, 0-9 as `_`. */
export function nodeId(id: string): string {
  //@ verify
  return "n_" + nodeNameFrom(id, 0);
}

function labelFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j
    //@ decreases s.length - j
    const c = s.charCodeAt(j);
    acc = acc + (c === 34 ? "#quot;" : c === 60 || c === 62 ? "" : s.slice(j, j + 1));
    j = j + 1;
  }
  return acc;
}

/** Text in a Mermaid label: `"` as `#quot;`, `<` and `>` dropped. */
export function chartLabel(text: string): string {
  //@ verify
  return labelFrom(text, 0);
}

/** A title cut to 48 code units, the last an ellipsis. */
export function chartTitle(title: string): string {
  //@ verify
  return title.length > 48 ? title.slice(0, 47) + "…" : title;
}

/** A chart node's reference: `<name>#<n>` from `gh-<name>-<n>` (name whole), else the todo label. */
export function chartRef(id: string): string {
  //@ verify
  const gh = parseGithubId(id, "");
  if (!gh.ok) return todoLabel(id);
  const k = lastHyphenBefore(id, id.length);
  return id.slice(3, k) + "#" + gh.digits;
}

/** A closing reference is a thick arrow, a mention a dotted one. */
export function arrowOf(closes: boolean): string {
  //@ verify
  return closes ? "==>" : "-.->";
}

function htmlFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j
    //@ decreases s.length - j
    const c = s.charCodeAt(j);
    acc = acc + (c === 38 ? "&amp;" : c === 60 ? "&lt;" : c === 62 ? "&gt;" : s.slice(j, j + 1));
    j = j + 1;
  }
  return acc;
}

/** Text in chart.html: `&`, `<` and `>` escaped. */
export function htmlText(text: string): string {
  //@ verify
  return htmlFrom(text, 0);
}

/** A dependency between two synced items: from, to, and whether it closes. */
export interface Edge {
  from: string;
  to: string;
  closes: boolean;
}

function edgeIndex(edges: Edge[], from: string, to: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= edges.length
  //@ ensures \result === -1 || (i <= \result && \result < edges.length)
  const j = listEnd(edges, i, (e: Edge) => !(e.from === from && e.to === to));
  return j < edges.length ? j : -1;
}

/** Add an edge: one per pair, in the order first seen, `closes` winning over a mention. */
export function addEdge(edges: Edge[], from: string, to: string, closes: boolean): Edge[] {
  //@ verify
  const k = edgeIndex(edges, from, to, 0);
  if (k < 0) return [...edges, { from, to, closes }];
  return closeEdgeAt(edges, k, closes);
}

function closeEdgeAt(edges: Edge[], k: number, closes: boolean): Edge[] {
  //@ verify
  //@ type k nat
  //@ requires k < edges.length
  const edge: Edge = { from: edges[k]!.from, to: edges[k]!.to, closes: edges[k]!.closes || closes };
  return [...edges.slice(0, k), edge, ...edges.slice(k + 1)];
}

// ---------------------------------------------------------------- follow

/** Followed from: Basecamp items, and items of repos a hub syncs in full. */
export function isRootItem(isBasecamp: boolean, ownedRepo: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (isBasecamp || ownedRepo)
  return isBasecamp || ownedRepo;
}

/** What following a reference does: `basecamp` (list it to fetch), `external` (another org, or not an item), `owned` (synced in full already), or `pull`. */
export function followKind(id: string, org: string, owned: boolean): string {
  //@ verify
  if (hasAt(id, 0, "bc-")) return "basecamp";
  const gh = parseGithubId(id, org);
  if (!gh.ok || gh.owner !== org) return "external";
  return owned ? "owned" : "pull";
}

/** A linked todo's project: the link's own, else one from a link elsewhere in work/, else the item's hub's when it lists exactly one, else "". */
export function todoProject(linkProject: string, elsewhere: string, hubProjects: string[]): string {
  //@ verify
  if (linkProject !== "") return linkProject;
  if (elsewhere !== "") return elsewhere;
  return hubProjects.length === 1 ? hubProjects[0]! : "";
}

/** `w` occurs in `s` at `i` or later. */
function occursIn(s: string, w: string, i: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  let j = i;
  while (j + w.length <= s.length && s.slice(j, j + w.length) !== w) {
    //@ invariant i <= j
    //@ decreases s.length - j
    j = j + 1;
  }
  return j + w.length <= s.length;
}

/** A transferred issue still answers at its old path: its page is no longer under `/<org>/<repo>/issues/`. */
export function movedAway(htmlUrl: string, org: string, repo: string): boolean {
  //@ verify
  return !occursIn(lower(htmlUrl), lower("/" + org + "/" + repo + "/issues/"), 0);
}

/** A followed issue no longer referenced from any root is dropped. */
export function isPruned(isGithub: boolean, isRoot: boolean, visited: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (isGithub && !isRoot && !visited)
  return isGithub && !isRoot && !visited;
}

/** The hub a followed repo's issues go in: the one named after it, or that lists it as followed. */
export function isHubFor(hubId: string, followed: string[], repo: string): boolean {
  //@ verify
  return hubId === repo || holds(followed, repo);
}

// ---------------------------------------------------------------- GitHub and Basecamp items

/** An item's kind from GitHub: a PR, or an issue. */
export function issueKind(isPull: boolean): string {
  //@ verify
  return isPull ? "pull" : "issue";
}

/** An item's status: `closed` only when the source says so. */
export function statusOf(closed: boolean): string {
  //@ verify
  return closed ? "closed" : "open";
}

/** A synced repo's item file that is no longer open: its id is `<prefix><n>` and not among the open ones. */
export function isClosedItem(id: string, prefix: string, open: boolean): boolean {
  //@ verify
  return (
    hasAt(id, 0, prefix) &&
    id.length > prefix.length &&
    allDigitsFrom(id.slice(prefix.length, id.length), 0) &&
    !open
  );
}

/** A name, or "unknown" when empty. */
export function orUnknown(name: string): string {
  //@ verify
  return name === "" ? "unknown" : name;
}

/** The slug of `s` from `i` on; `started` once a character was kept, `gap` when others followed it. */
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

/** A hub id from a Basecamp project name: lowered, each run of other characters one hyphen, none at the ends. */
export function slug(name: string): string {
  //@ verify
  return slugFrom(lower(name), 0, false, false);
}

/** The hub id for a Basecamp project no hub lists: its slug, or `basecamp-<project>`. */
export function hubIdFor(projectName: string, project: string): string {
  //@ verify
  const s = slug(projectName);
  return s !== "" ? s : "basecamp-" + project;
}

/** `<br>`, `<br/>`, `<br />` at `i`, ignoring case: where it ends, or -1. */
function brEnd(s: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  //@ ensures \result === -1 || (i < \result && \result <= s.length)
  if (i + 3 > s.length || lower(s.slice(i, i + 3)) !== "<br") return -1;
  const j = spaceRunEnd(s, i + 3);
  const k = hasAt(s, j, "/") ? j + 1 : j;
  return hasAt(s, k, ">") ? k + 1 : -1;
}

function plainFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= s.length
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j && j <= s.length
    //@ decreases s.length - j
    const e = brEnd(s, j);
    if (e > 0) {
      acc = acc + "\n";
      j = e;
    } else {
      acc = acc + s.slice(j, j + 1);
      j = j + 1;
    }
  }
  return acc;
}

/** A Basecamp comment's HTML with each `<br>` as a line break. */
export function plainText(html: string): string {
  //@ verify
  return plainFrom(html, 0);
}

// ---------------------------------------------------------------- check log and staleness (GH #34)

/** A sync.log or check.log line (`<time> <trigger> ok|failed …`) records a success: its third
    word is exactly `ok`. */
export function isOkLogLine(line: string): boolean {
  //@ verify
  const a = solidRunEnd(line, 0);
  if (a >= line.length) return false;
  const b = solidRunEnd(line, a + 1);
  return hasAt(line, b, " ok") && (b + 3 === line.length || hasAt(line, b + 3, " "));
}

/** `s` from `i` on with every line end as a space. */
function oneLineFrom(s: string, i: number): string {
  //@ verify
  //@ pure
  //@ type i nat
  let acc = "";
  let j = i;
  while (j < s.length) {
    //@ invariant i <= j
    //@ decreases s.length - j
    acc = acc + (isLineEndUnit(s.charCodeAt(j)) ? " " : s.slice(j, j + 1));
    j = j + 1;
  }
  return acc;
}

/** `s` as one log line: each line end becomes a space, so error text can never split an entry
    or forge one. */
export function oneLine(s: string): string {
  //@ verify
  return oneLineFrom(s, 0);
}

/** A log over 400 lines (twice the 200 kept) is trimmed back to the last 200. Appending a line
    is atomic; only the rare trim rewrites the file. */
export function logOverflows(lines: number): boolean {
  //@ verify
  //@ ensures \result <==> lines > 400
  return lines > 400;
}

/** The later of the last ok check and the last ok sync, among those that exist. */
function latestOk(hasCheck: boolean, checkMs: number, hasSync: boolean, syncMs: number): number {
  //@ verify
  return !hasSync || (hasCheck && checkMs > syncMs) ? checkMs : syncMs;
}

/** work/ is stale: no ok check and no ok sync within 3 check intervals (no session checked, or
    every check failed). An ok check that found nothing to sync keeps it current. */
export function isWorkStale(
  hasCheck: boolean,
  checkMs: number,
  hasSync: boolean,
  syncMs: number,
  now: number,
  minutes: number,
): boolean {
  //@ verify
  if (!hasCheck && !hasSync) return true;
  return now - latestOk(hasCheck, checkMs, hasSync, syncMs) > 3 * minutes * 60000;
}
