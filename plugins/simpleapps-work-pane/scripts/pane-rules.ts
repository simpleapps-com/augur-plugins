//@ backend dafny

/* The Work pane's decisions, each a small pure function proved with LemmaScript → Dafny
   (`pnpm proofs`; model: models/WorkPane.dfy; link: models/links/work-pane-rules.dfy).
   hooks/register.tsx reads, calls and draws, and asks these what each value means. This file is
   self-contained: an installed plugin has only its own folder. */

/** The colour of an issue or todo count. */
export type Colour = "red" | "green" | "plain";

/** Red over 10 open; green at none for a complete count; otherwise, and when unknown, plain. */
export function countColour(known: boolean, open: number, complete: boolean): Colour {
  //@ verify
  if (!known) return "plain";
  if (open > 10) return "red";
  if (open === 0 && complete) return "green";
  return "plain";
}

/** A partial count (the tool stopped at its page cap) is shown with a "+". */
export function countMark(complete: boolean): string {
  //@ verify
  //@ ensures \result === (complete ? "" : "+")
  return complete ? "" : "+";
}

/** An open Basecamp todo assigned to the person. */
export function isTrackedTodo(
  isOpen: boolean,
  isBasecamp: boolean,
  isTodo: boolean,
  mine: boolean,
): boolean {
  //@ verify
  //@ ensures \result <==> (isOpen && isBasecamp && isTodo && mine)
  return isOpen && isBasecamp && isTodo && mine;
}

/** An open GitHub issue (not a PR) in a watched repo. */
export function isTrackedIssue(
  isOpen: boolean,
  isGithub: boolean,
  isIssue: boolean,
  watched: boolean,
): boolean {
  //@ verify
  //@ ensures \result <==> (isOpen && isGithub && isIssue && watched)
  return isOpen && isGithub && isIssue && watched;
}

/** Every code unit of `s` from `i` on is a digit 0-9. */
function idDigitsFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i >= 0
  //@ decreases s.length - i
  //@ ensures \result <==> forall(k: nat, (i <= k && k < s.length) ==> (s.charCodeAt(k) >= 48 && s.charCodeAt(k) <= 57))
  return (
    i >= s.length || (s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57 && idDigitsFrom(s, i + 1))
  );
}

/** `id` is `prefix` (`gh-<repo>-`, lowercased) followed by one or more digits. */
export function isIssueIdOf(id: string, prefix: string): boolean {
  //@ verify
  return (
    id.length > prefix.length &&
    id.slice(0, prefix.length) === prefix &&
    idDigitsFrom(id.slice(prefix.length, id.length), 0)
  );
}

/** `repo` has a "/" at `i` or later. */
function slashFrom(repo: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i >= 0
  //@ decreases repo.length - i
  //@ ensures \result <==> exists(k: nat, i <= k && k < repo.length && repo.charCodeAt(k) === 47)
  return i < repo.length && (repo.charCodeAt(i) === 47 || slashFrom(repo, i + 1));
}

/** A watched repo named with its owner (`org/repo`); a bare name is in the person's org. */
export function hasOwner(repo: string): boolean {
  //@ verify
  return slashFrom(repo, 0);
}

/** A Basecamp project id a site brief covers. */
export function isProjectId(id: number): boolean {
  //@ verify
  //@ ensures \result <==> id > 0
  return id > 0;
}

/** A todo on the list is fetched when work/ lacks it or has another `updated_at` time. */
export function isEdited(
  localKnown: boolean,
  localMs: number,
  remoteKnown: boolean,
  remoteMs: number,
): boolean {
  //@ verify
  //@ ensures \result <==> (!localKnown || !remoteKnown || localMs !== remoteMs)
  return !localKnown || !remoteKnown || localMs !== remoteMs;
}

/** A todo work/ has that left the list is fetched: the person's, or on a Sync any linked one. */
export function hasLeft(
  onList: boolean,
  hasProject: boolean,
  linked: boolean,
  mine: boolean,
): boolean {
  //@ verify
  //@ ensures \result <==> (!onList && hasProject && (linked || mine))
  return !onList && hasProject && (linked || mine);
}

/** 7 days, in milliseconds: how long a linked todo seen completed is skipped. */
export const CLOSED_TTL_MS = 604800000;

/** Seen closed within the 7 days: still skipped, still remembered. */
export function isRecentlyClosed(now: number, closedAt: number): boolean {
  //@ verify
  //@ ensures \result <==> now - closedAt < 604800000
  return now - closedAt < 604800000;
}

/** A linked todo is skipped when it was seen closed within the 7 days. */
export function skipsClosed(known: boolean, now: number, closedAt: number): boolean {
  //@ verify
  return known && isRecentlyClosed(now, closedAt);
}

/** A timer tick checks when nobody checked within `minutes`, less 5 seconds of slack. */
export function isDue(
  hasChecked: boolean,
  lastChecked: number,
  now: number,
  minutes: number,
): boolean {
  //@ verify
  //@ ensures \result <==> (!hasChecked || now - lastChecked >= minutes * 60 * 1000 - 5000)
  return !hasChecked || now - lastChecked >= minutes * 60 * 1000 - 5000;
}

/** Retry a check soon while the connector is still connecting, at most 8 times in a row. */
export function shouldRetry(notLoaded: boolean, retries: number): boolean {
  //@ verify
  //@ ensures \result <==> (notLoaded && retries < 8)
  return notLoaded && retries < 8;
}

/** The retry count after a check: reset when it reached the connector, else one more up to 8. */
export function nextRetries(notLoaded: boolean, retries: number): number {
  //@ verify
  if (!notLoaded) return 0;
  if (retries < 8) return retries + 1;
  return retries;
}

/** What the pane says about changes waiting for a Sync. */
export type Pending = "not-checked" | "never-synced" | "up-to-date" | "changed";

export function pendingOf(
  checked: boolean,
  neverSynced: boolean,
  basecamp: number,
  github: number,
): Pending {
  //@ verify
  if (!checked) return "not-checked";
  if (neverSynced) return "never-synced";
  if (basecamp > 0 || github > 0) return "changed";
  return "up-to-date";
}

/** There is something to sync (and auto_sync starts one). */
export function hasChanges(
  checked: boolean,
  neverSynced: boolean,
  basecamp: number,
  github: number,
): boolean {
  //@ verify
  //@ ensures \result <==> (checked && (neverSynced || basecamp > 0 || github > 0))
  return checked && (neverSynced || basecamp > 0 || github > 0);
}

/** What a `work refresh` report means. */
export type Outcome = "did-not-run" | "locked" | "failed" | "synced";

export function outcomeOf(ran: boolean, locked: boolean, failed: boolean): Outcome {
  //@ verify
  if (!ran) return "did-not-run";
  if (locked) return "locked";
  if (failed) return "failed";
  return "synced";
}

/** A sync that synced but could not read the briefs' Basecamp todos says so. */
export function notesBriefProblem(synced: boolean, hasProblem: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (synced && hasProblem)
  return synced && hasProblem;
}
