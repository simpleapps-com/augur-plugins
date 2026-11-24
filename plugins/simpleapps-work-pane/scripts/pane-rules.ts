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

// ---------------------------------------------------------------- scans
// Every scan here is one of these three, each proved once for any test (model: Text.ScanEnd,
// Text.RunStart, Text.ListEnd). Named apart from work-rules.ts' runEnd, runStart and listEnd:
// every proved file is one Dafny program.

/** Where the run of code units passing `ok` that starts at `i` ends. */
function paneRunEnd(s: string, i: number, ok: (c: number) => boolean): number {
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
function paneRunStart(s: string, lo: number, e: number, ok: (c: number) => boolean): number {
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
function paneListEnd<T>(xs: T[], i: number, ok: (x: T) => boolean): number {
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

/** A code unit 0-9. */
function isIdDigitUnit(c: number): boolean {
  //@ verify
  return c >= 48 && c <= 57;
}

/** Every code unit of `s` from `i` on is a digit 0-9. */
function idDigitsFrom(s: string, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= s.length
  return paneRunEnd(s, i, isIdDigitUnit) === s.length;
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
  //@ requires i <= repo.length
  return paneRunEnd(repo, i, (c: number) => c !== 47) < repo.length;
}

/** A watched repo named with its owner (`org/repo`); a bare name is in the person's org. */
export function hasOwner(repo: string): boolean {
  //@ verify
  return slashFrom(repo, 0);
}

/** The plugin connector's host: a project server at this URL suppresses the connector. */
const BASECAMP_ORIGIN = "https://basecamp.augur-mcp.com";

/** `url` is on the connector's host, alone or followed by a path. */
export function isBasecampUrl(url: string): boolean {
  //@ verify
  const n = BASECAMP_ORIGIN.length;
  return (
    url.length >= n &&
    url.slice(0, n) === BASECAMP_ORIGIN &&
    (url.length === n || url.charCodeAt(n) === 47)
  );
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

/** The pane starts (opens, reads the setup, starts the timer) only in a simpleapps-work project:
    the session root holds work/README.md (GH #33). */
export function startsPane(isWork: boolean): boolean {
  //@ verify
  //@ ensures \result <==> isWork
  return isWork;
}

/** What `/work <args>` does, `args` trimmed: nothing outside a work project; else sync, check
    and answer, or open the pane and check. */
export type PaneStep = "idle" | "sync" | "check" | "pane";

export function commandStep(isWork: boolean, args: string): PaneStep {
  //@ verify
  if (!isWork) return "idle";
  if (args === "sync") return "sync";
  if (args === "check") return "check";
  return "pane";
}

/** A check starts a sync only with auto_sync, changes pending, and no sync already running. */
export function startsAutoSync(autoSync: boolean, hasChanges: boolean, syncing: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (autoSync && hasChanges && !syncing)
  return autoSync && hasChanges && !syncing;
}

/** The pane shows stale (red) after a failed check over a stale record; an ok check is itself a
    current record (GH #34). */
export function showsStale(checkOk: boolean, statusStale: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (!checkOk && statusStale)
  return !checkOk && statusStale;
}

/** Keep waiting for the connector: it is still connecting, and fewer than 3 tries (2 s apart)
    have passed. A fresh `claude -p` run starts that way (GH #35). */
export function waitsForConnector(notLoaded: boolean, tries: number): boolean {
  //@ verify
  //@ ensures \result <==> (notLoaded && tries < 3)
  return notLoaded && tries < 3;
}

/** A sync counts as full, and records a last-sync time, only when it synced and read Basecamp;
    otherwise it is partial (GH #35). */
export function recordsFullSync(synced: boolean, basecampRead: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (synced && basecampRead)
  return synced && basecampRead;
}

// ---------------------------------------------------------------- the check and sync cycle

/** A check runs (records its time, writes one log line) unless it is a timer tick that is not
    due; the due test comes before `work status`, so a failing status is not logged every tick. */
export function checkRuns(isTimer: boolean, due: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (!isTimer || due)
  return !isTimer || due;
}

/** A sync begins only when none is running in this process (work/.lock covers other processes). */
export function syncBegins(syncing: boolean): boolean {
  //@ verify
  //@ ensures \result <==> !syncing
  return !syncing;
}

/** A check succeeded: no part of it failed. */
export function checkSucceeded(failedParts: number): boolean {
  //@ verify
  //@ ensures \result <==> failedParts === 0
  return failedParts === 0;
}

/** A sync's second pass, for the linked todos `follow` found, runs only after a refresh that
    succeeded with Basecamp read: a partial sync never writes an `ok` line (GH #35). */
export function runsLinkedPass(
  refreshOk: boolean,
  basecampRead: boolean,
  hasLinked: boolean,
): boolean {
  //@ verify
  //@ ensures \result <==> (refreshOk && basecampRead && hasLinked)
  return refreshOk && basecampRead && hasLinked;
}

/** `/work` runs its own check unless the session's opening check, which it waited for, already
    gave a reading; it checks again when that one found the connector not loaded yet. */
export function commandChecks(openingRan: boolean, openingNotLoaded: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (!openingRan || openingNotLoaded)
  return !openingRan || openingNotLoaded;
}

/** A check is logged, except a retry that failed with more retries to come: a connector that
    never connects writes its failure once, not once per retry. */
export function logsCheck(isRetry: boolean, ok: boolean, retriesLeft: boolean): boolean {
  //@ verify
  //@ ensures \result <==> (!isRetry || ok || !retriesLeft)
  return !isRetry || ok || !retriesLeft;
}

/** What the pane shows as stale: with `work status` read, its flag after a failed check; with
    it unreadable, the pane's own record of the last ok check or full sync. */
export function staleShown(
  statusRead: boolean,
  checkOk: boolean,
  statusStale: boolean,
  localStale: boolean,
): boolean {
  //@ verify
  return statusRead ? showsStale(checkOk, statusStale) : localStale;
}

// ---------------------------------------------------------------- the lists the pane builds
// The hook's data helpers, as loops over records the shell has already parsed (JSON, dates and
// numbers are its boundary). Model: WorkPane "the lists the pane builds".

/** Where the name after the last "/" before `i` starts: one past that slash, or 0. */
function nameStartBefore(repo: string, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= repo.length
  return paneRunStart(repo, 0, i, (c: number) => c !== 47);
}

/** A watched repo's name: after its last "/" (`acme/tool` is `tool`), or all of it. */
export function repoName(repo: string): string {
  //@ verify
  return repo.slice(nameStartBefore(repo, repo.length), repo.length);
}

/** One of `names` from `i` on has `id` as one of its issues (`gh-<name>-<n>`). */
function watchedFrom(id: string, names: string[], i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= names.length
  return paneListEnd(names, i, (n: string) => !isIssueIdOf(id, "gh-" + n + "-")) < names.length;
}

/** `id` is an issue of a watched repo; `id` and `names` are lowered, `names` are repo names. */
export function inWatchedNames(id: string, names: string[]): boolean {
  //@ verify
  return watchedFrom(id, names, 0);
}

/** An item of work/ as the pane counts it, `watched` already decided by `inWatchedNames`. */
export interface PaneItem {
  status: string;
  source: string;
  kind: string;
  mine: boolean;
  watched: boolean;
}

/** What you track: open Basecamp todos of yours, open issues in watched repos. */
export interface Tally {
  basecamp: number;
  github: number;
}

/** The tally of `items` from `i` on. */
function tallyFrom(items: PaneItem[], i: number): Tally {
  //@ verify
  //@ pure
  //@ type i nat
  let b = 0;
  let g = 0;
  let j = i;
  while (j < items.length) {
    //@ invariant i <= j
    //@ decreases items.length - j
    const it = items[j]!;
    const open = it.status === "open";
    if (isTrackedTodo(open, it.source === "basecamp", it.kind === "todo", it.mine)) b = b + 1;
    if (isTrackedIssue(open, it.source === "github", it.kind === "issue", it.watched)) g = g + 1;
    j = j + 1;
  }
  return { basecamp: b, github: g };
}

/** What you track, as in work/LIST.md. */
export function tally(items: PaneItem[]): Tally {
  //@ verify
  return tallyFrom(items, 0);
}

/** The watched repos from `i` on whose issue count could not be read. */
function unreadReposFrom(repos: string[], read: boolean[], i: number): string[] {
  //@ verify
  //@ pure
  //@ type i nat
  //@ requires repos.length === read.length
  let acc: string[] = [];
  let j = i;
  while (j < repos.length) {
    //@ invariant i <= j
    //@ decreases repos.length - j
    if (!read[j]!) acc = [...acc, repos[j]!];
    j = j + 1;
  }
  return acc;
}

/** The parts of a check that failed, in order: the Basecamp count, the index, each unread
    repo, and the GitHub change search. Empty when all worked. */
export function failedParts(
  countFailed: boolean,
  countProblem: string,
  indexFailed: boolean,
  indexProblem: string,
  repos: string[],
  read: boolean[],
  changesRead: boolean,
): string[] {
  //@ verify
  //@ requires repos.length === read.length
  const count = countFailed ? ["Basecamp count (" + countProblem + ")"] : [];
  const index = indexFailed ? ["Basecamp index (" + indexProblem + ")"] : [];
  const changes = changesRead ? [] : ["GitHub changes"];
  return [...count, ...index, ...unreadReposFrom(repos, read, 0), ...changes];
}

/** A Basecamp todo to fetch with get_todo, with the names get_todo doesn't return. */
export interface PaneTarget {
  id: number;
  projectId: number;
  projectName: string;
  list: string;
}

/** A todo from list_my_todo_index, its update time parsed (`updatedKnown` false when it did not). */
export interface IndexTodo {
  id: number;
  projectId: number;
  projectName: string;
  list: string;
  updatedKnown: boolean;
  updatedMs: number;
}

/** Where the todo `id` is in `todos` at or after `i`, or -1. */
function todoAt(todos: IndexTodo[], id: number, i: number): number {
  //@ verify
  //@ type i nat
  //@ requires i <= todos.length
  //@ ensures \result === -1 || (i <= \result && \result < todos.length)
  const j = paneListEnd(todos, i, (t: IndexTodo) => t.id !== id);
  return j < todos.length ? j : -1;
}

/** `todos` from `i` on added to `acc`: a new id goes last, a known one is replaced in place. */
function uniqueTodosFrom(acc: IndexTodo[], todos: IndexTodo[], i: number): IndexTodo[] {
  //@ verify
  //@ pure
  //@ type i nat
  let out = acc;
  let j = i;
  while (j < todos.length) {
    //@ invariant i <= j
    //@ decreases todos.length - j
    const t = todos[j]!;
    const k = todoAt(out, t.id, 0);
    out = k < 0 ? [...out, t] : [...out.slice(0, k), t, ...out.slice(k + 1)];
    j = j + 1;
  }
  return out;
}

/** Every todo once: in the order first seen, each as last seen (as a Map does). */
export function uniqueTodos(todos: IndexTodo[]): IndexTodo[] {
  //@ verify
  return uniqueTodosFrom([], todos, 0);
}

/** A Basecamp todo already in work/: its number, update time, project and whether it is yours. */
export interface LocalTodo {
  num: number;
  updatedKnown: boolean;
  updatedMs: number;
  hasProject: boolean;
  projectId: number;
  mine: boolean;
}

/** The last local todo numbered `num` from `i` on, or -1 (a Map keeps the last of a key). */
function localAt(local: LocalTodo[], num: number, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ ensures \result === -1 || (i <= \result && \result < local.length)
  let found = -1;
  let j = i;
  while (j < local.length) {
    //@ invariant i <= j
    //@ invariant found === -1 || (i <= found && found < local.length)
    //@ decreases local.length - j
    if (local[j]!.num === num) found = j;
    j = j + 1;
  }
  return found;
}

/** The remote todos from `i` on that are new or edited since work/ last saw them. */
function editedFrom(remote: IndexTodo[], local: LocalTodo[], i: number): PaneTarget[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: PaneTarget[] = [];
  let j = i;
  while (j < remote.length) {
    //@ invariant i <= j
    //@ decreases remote.length - j
    const r = remote[j]!;
    const k = localAt(local, r.id, 0);
    const beforeKnown = k >= 0 && local[k]!.updatedKnown;
    const beforeMs = k >= 0 ? local[k]!.updatedMs : 0;
    if (isEdited(beforeKnown, beforeMs, r.updatedKnown, r.updatedMs))
      acc = [
        ...acc,
        { id: r.id, projectId: r.projectId, projectName: r.projectName, list: r.list },
      ];
    j = j + 1;
  }
  return acc;
}

/** `remote` from `i` on holds the todo `id`. */
function remoteHasFrom(remote: IndexTodo[], id: number, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= remote.length
  return paneListEnd(remote, i, (t: IndexTodo) => t.id !== id) < remote.length;
}

/** The local todos from `i` on that left your list (or, with `linked`, every other one). */
function leftFrom(
  local: LocalTodo[],
  remote: IndexTodo[],
  linked: boolean,
  i: number,
): PaneTarget[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: PaneTarget[] = [];
  let j = i;
  while (j < local.length) {
    //@ invariant i <= j
    //@ decreases local.length - j
    const l = local[j]!;
    if (hasLeft(remoteHasFrom(remote, l.num, 0), l.hasProject, linked, l.mine))
      acc = [...acc, { id: l.num, projectId: l.projectId, projectName: "", list: "" }];
    j = j + 1;
  }
  return acc;
}

/** Basecamp todos to fetch: yours that are new or edited, then local ones that left your list. */
export function todosToFetch(
  remote: IndexTodo[],
  local: LocalTodo[],
  linked: boolean,
): PaneTarget[] {
  //@ verify
  return [...editedFrom(remote, local, 0), ...leftFrom(local, remote, linked, 0)];
}

/** A linked todo `follow` found: its number and project (`hasProject` false when unknown). */
export interface LinkedTodo {
  num: number;
  hasProject: boolean;
  projectId: number;
}

/** The linked todos from `i` on with a known project, as targets. */
function linkedFrom(found: LinkedTodo[], i: number): PaneTarget[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: PaneTarget[] = [];
  let j = i;
  while (j < found.length) {
    //@ invariant i <= j
    //@ decreases found.length - j
    const f = found[j]!;
    if (f.hasProject)
      acc = [...acc, { id: f.num, projectId: f.projectId, projectName: "", list: "" }];
    j = j + 1;
  }
  return acc;
}

/** Linked todos to fetch: those whose project is known. */
export function linkedTargets(found: LinkedTodo[]): PaneTarget[] {
  //@ verify
  return linkedFrom(found, 0);
}

/** A fetched get_todo record: whether it has a numeric id, and whether it came back completed. */
export interface FetchedTodo {
  hasId: boolean;
  id: number;
  completed: boolean;
}

/** The ids from `i` on of records that came back completed. */
function completedFrom(records: FetchedTodo[], i: number): number[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: number[] = [];
  let j = i;
  while (j < records.length) {
    //@ invariant i <= j
    //@ decreases records.length - j
    const r = records[j]!;
    if (r.hasId && r.completed) acc = [...acc, r.id];
    j = j + 1;
  }
  return acc;
}

/** Ids of fetched records that came back completed. */
export function completedIds(records: FetchedTodo[]): number[] {
  //@ verify
  return completedFrom(records, 0);
}

/** A linked todo seen completed: its id and when. */
export interface ClosedTodo {
  id: number;
  at: number;
}

/** When the todo `id` was seen closed, from `i` on: the last entry for it, or -1 for none. */
function closedAt(closed: ClosedTodo[], id: number, i: number): number {
  //@ verify
  //@ pure
  //@ type i nat
  //@ ensures \result === -1 || (i <= \result && \result < closed.length)
  let found = -1;
  let j = i;
  while (j < closed.length) {
    //@ invariant i <= j
    //@ invariant found === -1 || (i <= found && found < closed.length)
    //@ decreases closed.length - j
    if (closed[j]!.id === id) found = j;
    j = j + 1;
  }
  return found;
}

/** The targets from `i` on not seen closed within 7 days. */
function notClosedFrom(
  targets: PaneTarget[],
  closed: ClosedTodo[],
  now: number,
  i: number,
): PaneTarget[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: PaneTarget[] = [];
  let j = i;
  while (j < targets.length) {
    //@ invariant i <= j
    //@ decreases targets.length - j
    const k = closedAt(closed, targets[j]!.id, 0);
    if (!skipsClosed(k >= 0, now, k >= 0 ? closed[k]!.at : 0)) acc = [...acc, targets[j]!];
    j = j + 1;
  }
  return acc;
}

/** Linked todos seen completed within 7 days are not fetched again; a reopen shows within a week. */
export function skipClosed(targets: PaneTarget[], closed: ClosedTodo[], now: number): PaneTarget[] {
  //@ verify
  return notClosedFrom(targets, closed, now, 0);
}

/** `ids` holds `id` at or after `i`. */
function idFrom(ids: number[], id: number, i: number): boolean {
  //@ verify
  //@ type i nat
  //@ requires i <= ids.length
  return paneListEnd(ids, i, (x: number) => x !== id) < ids.length;
}

/** The entries from `i` on still within 7 days and not closed again now. */
function keptFrom(closed: ClosedTodo[], ids: number[], now: number, i: number): ClosedTodo[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: ClosedTodo[] = [];
  let j = i;
  while (j < closed.length) {
    //@ invariant i <= j
    //@ decreases closed.length - j
    const c = closed[j]!;
    if (isRecentlyClosed(now, c.at) && !idFrom(ids, c.id, 0)) acc = [...acc, c];
    j = j + 1;
  }
  return acc;
}

/** `ids` from `i` on as closed now, each once. */
function closedNowFrom(ids: number[], now: number, i: number): ClosedTodo[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: ClosedTodo[] = [];
  let j = i;
  while (j < ids.length) {
    //@ invariant i <= j
    //@ decreases ids.length - j
    if (!idFrom(ids, ids[j]!, j + 1)) acc = [...acc, { id: ids[j]!, at: now }];
    j = j + 1;
  }
  return acc;
}

/** Drop entries older than 7 days and record the newly completed ids, one entry per id. */
export function rememberClosed(closed: ClosedTodo[], ids: number[], now: number): ClosedTodo[] {
  //@ verify
  return [...keptFrom(closed, ids, now, 0), ...closedNowFrom(ids, now, 0)];
}

/** `acc` with the ids from `i` on that are real project ids and not already in it, in order. */
function projectIdsFrom(acc: number[], ids: number[], i: number): number[] {
  //@ verify
  //@ pure
  //@ type i nat
  let out = acc;
  let j = i;
  while (j < ids.length) {
    //@ invariant i <= j
    //@ decreases ids.length - j
    if (isProjectId(ids[j]!) && !idFrom(out, ids[j]!, 0)) out = [...out, ids[j]!];
    j = j + 1;
  }
  return out;
}

/** Every Basecamp project a site brief covers, once each, in order. */
export function briefProjectIds(ids: number[]): number[] {
  //@ verify
  return projectIdsFrom([], ids, 0);
}

/** A server in the project's .mcp.json: its name, and its URL when it has a string one. */
export interface McpServer {
  name: string;
  hasUrl: boolean;
  url: string;
}

/** The servers from `i` on at the Basecamp connector's URL. */
function onConnectorUrlFrom(servers: McpServer[], i: number): string[] {
  //@ verify
  //@ pure
  //@ type i nat
  let acc: string[] = [];
  let j = i;
  while (j < servers.length) {
    //@ invariant i <= j
    //@ decreases servers.length - j
    const s = servers[j]!;
    if (s.hasUrl && isBasecampUrl(s.url)) acc = [...acc, s.name];
    j = j + 1;
  }
  return acc;
}

/** Names of the project's servers on the connector's URL: each hides the plugin's connector. */
export function duplicateNames(servers: McpServer[]): string[] {
  //@ verify
  return onConnectorUrlFrom(servers, 0);
}

/** The outcome of a Sync, in words for the pane. */
export interface PaneSync {
  at: number;
  ok: boolean;
  detail: string;
}

/** The pane's words for a `work refresh` report: did not run, locked, failed at a step, synced. */
export function syncResultOf(
  ran: boolean,
  locked: boolean,
  failed: boolean,
  step: string,
  why: string,
  at: number,
): PaneSync {
  //@ verify
  const outcome = outcomeOf(ran, locked, failed);
  if (outcome === "did-not-run") return { at, ok: false, detail: "work refresh did not run" };
  if (outcome === "locked") return { at, ok: false, detail: "another sync is running" };
  if (outcome === "failed") return { at, ok: false, detail: "failed at " + step + ": " + why };
  return { at, ok: true, detail: "synced" };
}

/** A sync that could not read Basecamp refreshed GitHub only: partial, not a full sync (GH #35). */
export function withBasecampSkipped(result: PaneSync, skipped: boolean, problem: string): PaneSync {
  //@ verify
  if (recordsFullSync(result.ok, !skipped) || !result.ok) return result;
  return {
    at: result.at,
    ok: false,
    detail: result.detail + ", GitHub only; Basecamp skipped (" + problem + ")",
  };
}

/** A sync that could not read the briefs' Basecamp todos still synced; it says so. */
export function withBriefProblem(result: PaneSync, hasProblem: boolean, problem: string): PaneSync {
  //@ verify
  if (!notesBriefProblem(result.ok, hasProblem)) return result;
  return {
    at: result.at,
    ok: result.ok,
    detail: result.detail + "; briefs kept their last Basecamp read (" + problem + ")",
  };
}
