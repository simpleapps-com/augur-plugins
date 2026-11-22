//@ backend dafny

/* The marketplace's rules, each a small pure function proved with LemmaScript → Dafny
   (`pnpm proofs`; model: models/Marketplace.dfy; link: models/links/scripts-rules.dfy).
   `validate.ts` reads the files and calls these for every decision. */

/** A code unit 0-9. */
function isDigitCode(c: number): boolean {
  //@ verify
  //@ ensures \result <==> (c >= 48 && c <= 57)
  return c >= 48 && c <= 57;
}

/** A code unit a-z. */
function isLowerCode(c: number): boolean {
  //@ verify
  //@ ensures \result <==> (c >= 97 && c <= 122)
  return c >= 97 && c <= 122;
}

/** A code unit a-z, 0-9 or a hyphen: a skill name's or a host label's character. */
function isNameCode(c: number): boolean {
  //@ verify
  //@ ensures \result <==> ((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45)
  return isLowerCode(c) || isDigitCode(c) || c === 45;
}

/** Every code unit of `s` from `i` on is a digit. */
function digitsFrom(s: string, i: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i >= 0
  let j = i;
  while (j < s.length && isDigitCode(s.charCodeAt(j))) {
    //@ invariant i <= j
    //@ decreases s.length - j
    j = j + 1;
  }
  return j >= s.length;
}

/** Every code unit of `s` from `i` on is a name character. */
function nameCodesFrom(s: string, i: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i >= 0
  let j = i;
  while (j < s.length && isNameCode(s.charCodeAt(j))) {
    //@ invariant i <= j
    //@ decreases s.length - j
    j = j + 1;
  }
  return j >= s.length;
}

/** The year and its dot: a digit 1-9, three digits, then "." at 4. */
function yearPart(s: string): boolean {
  //@ verify
  //@ requires s.length >= 8
  const first = s.charCodeAt(0);
  return first >= 49 && first <= 57 && digitsFrom(s.slice(1, 4), 0) && s.charCodeAt(4) === 46;
}

/** The release number from `a` on: a digit 1-9, then digits to the end. */
function seqFrom(s: string, a: number): boolean {
  //@ verify
  //@ type a nat
  //@ requires a < s.length
  const first = s.charCodeAt(a);
  return first >= 49 && first <= 57 && digitsFrom(s.slice(a + 1, s.length), 0);
}

/** A one-digit month (1-9) at 5, its dot at 6, the release from 7. */
function shortMonth(s: string): boolean {
  //@ verify
  //@ requires s.length >= 8
  const m = s.charCodeAt(5);
  return s.charCodeAt(6) === 46 && m >= 49 && m <= 57 && seqFrom(s, 7);
}

/** A two-digit month (10-12) at 5-6, its dot at 7, the release from 8. */
function longMonth(s: string): boolean {
  //@ verify
  //@ requires s.length >= 8
  if (s.length < 9 || s.charCodeAt(7) !== 46 || s.charCodeAt(5) !== 49) return false;
  const m = s.charCodeAt(6);
  return m >= 48 && m <= 50 && seqFrom(s, 8);
}

/** `s` is a plugin version, `YYYY.M.seq` (model: Marketplace.IsCalVer). */
export function isCalVer(s: string): boolean {
  //@ verify
  return s.length >= 8 && yearPart(s) && (shortMonth(s) || longMonth(s));
}

/** `k` is one of the six SKILL.md frontmatter keys claude.ai accepts. */
export function isSkillKey(k: string): boolean {
  //@ verify
  //@ ensures \result <==> (k === "name" || k === "description" || k === "license" || k === "compatibility" || k === "metadata" || k === "allowed-tools")
  return (
    k === "name" ||
    k === "description" ||
    k === "license" ||
    k === "compatibility" ||
    k === "metadata" ||
    k === "allowed-tools"
  );
}

/** `n` is a skill name: 1 to 64 characters, a-z first, then a-z, 0-9 and hyphens. */
export function isSkillName(n: string): boolean {
  //@ verify
  return n.length >= 1 && n.length <= 64 && isLowerCode(n.charCodeAt(0)) && nameCodesFrom(n, 1);
}

/** `w` occurs in `s` at `i` or later. */
function occursFrom(s: string, w: string, i: number): boolean {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i >= 0
  let j = i;
  while (j + w.length <= s.length && s.slice(j, j + w.length) !== w) {
    //@ invariant i <= j
    //@ decreases s.length - j
    j = j + 1;
  }
  return j + w.length <= s.length;
}

/** `n` contains a word Anthropic reserves: "anthropic" or "claude". */
export function isReservedName(n: string): boolean {
  //@ verify
  return occursFrom(n, "anthropic", 0) || occursFrom(n, "claude", 0);
}

/** A skill description of `length` characters fits the 1,024 limit. */
export function descriptionFits(length: number): boolean {
  //@ verify
  //@ type length nat
  //@ requires length >= 0
  //@ ensures \result <==> length <= 1024
  return length <= 1024;
}

/** A SKILL.md's size against the 5K-token budget, in words: over 3,750 fails, over 3,375 warns. */
export type Budget = "fits" | "near" | "over";

export function budgetOf(words: number): Budget {
  //@ verify
  //@ type words nat
  //@ requires words >= 0
  if (words > 3750) return "over";
  if (words > 3375) return "near";
  return "fits";
}

/** Where the host label that starts at `i` ends: the first non-label code unit, or the end. */
function labelEnd(u: string, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires i <= u.length
  let j = i;
  while (j < u.length && isNameCode(u.charCodeAt(j))) {
    //@ invariant i <= j && j <= u.length
    //@ decreases u.length - j
    j = j + 1;
  }
  return j;
}

/** `u` is `https://<label>.augur-mcp.com/...` (model: Marketplace.IsConnectorUrl). */
export function isConnectorUrl(u: string): boolean {
  //@ verify
  if (u.length < 8 || u.slice(0, 8) !== "https://") return false;
  const j = labelEnd(u, 8);
  return j > 8 && j + 15 <= u.length && u.slice(j, j + 15) === ".augur-mcp.com/";
}
