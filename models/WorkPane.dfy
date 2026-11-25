// The model of the Work pane (plugins/simpleapps-work-pane): every decision the pane makes about
// a value, written before the code (wiki Proofs). `plugins/simpleapps-work-pane/scripts/
// pane-rules.ts` is proved with LemmaScript and linked to it in `models/links/work-pane-rules.dfy`.
//
// The pane's shell (hooks/register.tsx) only reads, calls and draws: it parses JSON, runs `gh`
// and the work scripts, calls the Basecamp connector, and asks these rules what each value means,
// which lists to build, and what each step of the check and sync cycle does (sections "the check
// and sync cycle" and "the lists the pane builds", which also names the trusted boundary).
// Each rule keeps the behaviour of the pane it replaces (GH #14), so `work/` keeps working as it
// does today. Every scan and search is a case of the shared ones in Text.dfy, proved once there.

include "Text.dfy"

module WorkPane {
  import opened Text

  // ---------------------------------------------------------------- counts
  // A count is unknown (its call failed), or `open` with `complete` false when the tool stopped
  // at its page cap, so `open` is only a lower bound.

  datatype Colour = Red | Green | Plain

  const Busy: int := 10

  // Red over 10 open; green at none, but only for a complete count ("0+" is not nothing);
  // otherwise, and for an unknown count, plain.
  function CountColour(known: bool, open: int, complete: bool): Colour
  {
    if !known then Plain
    else if open > Busy then Red
    else if open == 0 && complete then Green
    else Plain
  }

  // A partial count is shown with a "+": at least that many.
  function CountMark(complete: bool): string
  {
    if complete then "" else "+"
  }

  lemma ColourExamples()
    ensures CountColour(true, 0, true) == Green
    ensures CountColour(true, 0, false) == Plain
    ensures CountColour(true, 10, true) == Plain
    ensures CountColour(true, 11, false) == Red
    ensures CountColour(false, 0, true) == Plain
  {
  }

  // ---------------------------------------------------------------- what is tracked
  // What a person tracks, as in work/LIST.md: open Basecamp todos assigned to them, and open
  // issues (not PRs) in their watched repos.

  predicate IsTrackedTodo(isOpen: bool, isBasecamp: bool, isTodo: bool, mine: bool)
  {
    isOpen && isBasecamp && isTodo && mine
  }

  predicate IsTrackedIssue(isOpen: bool, isGithub: bool, isIssue: bool, watched: bool)
  {
    isOpen && isGithub && isIssue && watched
  }

  predicate DigitCode(c: int) { 48 <= c <= 57 }

  predicate DigitText(s: string)
  {
    forall k :: 0 <= k < |s| ==> DigitCode(s[k] as int)
  }

  // An item id `gh-<repo>-<n>` belongs to a watched repo when it is that repo's prefix
  // (`gh-<repo>-`, lowercased by the shell) followed by one or more digits.
  predicate IsIssueIdOf(id: string, prefix: string)
  {
    |id| > |prefix| && id[..|prefix|] == prefix && DigitText(id[|prefix|..])
  }

  lemma IssueIdExamples()
    ensures IsIssueIdOf("gh-site-12", "gh-site-")
    ensures !IsIssueIdOf("gh-site-", "gh-site-")
    ensures !IsIssueIdOf("gh-site-12a", "gh-site-")
    ensures !IsIssueIdOf("gh-sites-12", "gh-site-")
  {
    assert "gh-site-12"[..8] == "gh-site-";
    assert "gh-site-12"[8..] == "12";
    assert "gh-site-12a"[8..] == "12a" && !DigitCode("12a"[2] as int);
    assert "gh-sites-12"[..8] != "gh-site-" by { assert "gh-sites-12"[7] != "gh-site-"[7]; }
  }

  // A watched repo named with its owner (`org/repo`) is used as it is; a bare name is in the
  // person's org.
  predicate HasOwner(repo: string)
  {
    exists k :: 0 <= k < |repo| && repo[k] == '/'
  }

  // ---------------------------------------------------------------- the connector
  // Claude Code drops the plugin's Basecamp connector when another configured server has the
  // same URL. A project server is that duplicate when its URL is the connector's host, alone or
  // followed by a path. The pane names it for the person to remove; it never calls it.
  const BasecampOrigin := "https://basecamp.augur-mcp.com"

  predicate IsBasecampUrl(url: string)
  {
    |url| >= |BasecampOrigin| && url[..|BasecampOrigin|] == BasecampOrigin
      && (|url| == |BasecampOrigin| || url[|BasecampOrigin|] == '/')
  }

  lemma BasecampUrlExamples()
    ensures IsBasecampUrl("https://basecamp.augur-mcp.com/mcp")
    ensures IsBasecampUrl("https://basecamp.augur-mcp.com")
    ensures !IsBasecampUrl("https://basecamp.augur-mcp.com.evil.example/mcp")
    ensures !IsBasecampUrl("https://api.augur-mcp.com/mcp")
    ensures !IsBasecampUrl("http://basecamp.augur-mcp.com/mcp")
  {
    assert "https://basecamp.augur-mcp.com/mcp"[..30] == BasecampOrigin;
    assert "https://basecamp.augur-mcp.com.evil.example/mcp"[30] == '.';
    assert "https://api.augur-mcp.com/mcp"[8] != BasecampOrigin[8];
    assert "http://basecamp.augur-mcp.com/mcp"[4] != BasecampOrigin[4];
  }

  // A Basecamp project id a site brief covers; anything else is skipped.
  predicate IsProjectId(id: int)
  {
    id > 0
  }

  // ---------------------------------------------------------------- change detection
  // A todo on the person's list is fetched when work/ does not have it, or has a different
  // `updated_at` (compared as times; a time that does not parse never matches).

  predicate IsEdited(localKnown: bool, localMs: int, remoteKnown: bool, remoteMs: int)
  {
    !localKnown || !remoteKnown || localMs != remoteMs
  }

  // A todo work/ has that left the list (closed or reassigned) is fetched when its project is
  // known and it is the person's, or, on a Sync (`linked`), any todo `follow` pulled in.
  predicate HasLeft(onList: bool, hasProject: bool, linked: bool, mine: bool)
  {
    !onList && hasProject && (linked || mine)
  }

  // ---------------------------------------------------------------- closed linked todos
  // A linked todo seen completed is not fetched again for 7 days; a reopen shows within a week.

  const ClosedTtlMs: int := 7 * 24 * 60 * 60 * 1000

  // Still within the 7 days: skip it, and keep remembering it.
  predicate IsRecentlyClosed(now: int, closedAt: int)
  {
    now - closedAt < ClosedTtlMs
  }

  // Skipped when it was seen closed within the 7 days; never when it was not seen closed.
  predicate SkipsClosed(known: bool, now: int, closedAt: int)
  {
    known && IsRecentlyClosed(now, closedAt)
  }

  lemma ClosedExamples()
    ensures ClosedTtlMs == 604800000
    ensures SkipsClosed(true, 604799999, 0)
    ensures !SkipsClosed(true, 604800000, 0)
    ensures !SkipsClosed(false, 0, 0)
  {
  }

  // ---------------------------------------------------------------- timing
  // A timer tick checks when this session or another has not checked within the interval
  // (`sync_minutes`), less 5 seconds so a tick a little early still counts.

  const SlackMs: int := 5000

  predicate IsDue(hasChecked: bool, lastChecked: int, now: int, minutes: int)
  {
    !hasChecked || now - lastChecked >= minutes * 60 * 1000 - SlackMs
  }

  lemma DueExamples()
    ensures IsDue(false, 0, 0, 5)
    ensures IsDue(true, 0, 295000, 5)
    ensures !IsDue(true, 0, 294999, 5)
  {
  }

  // The Basecamp connector can still be connecting when the pane first checks: retry soon, at
  // most 8 times in a row; a check that reached it resets the count.
  const MaxRetries: int := 8

  predicate ShouldRetry(notLoaded: bool, retries: int)
  {
    notLoaded && retries < MaxRetries
  }

  function NextRetries(notLoaded: bool, retries: int): int
  {
    if !notLoaded then 0 else if retries < MaxRetries then retries + 1 else retries
  }

  // Retries never pass the limit, from any count at or under it.
  lemma RetriesBounded(notLoaded: bool, retries: int)
    requires 0 <= retries <= MaxRetries
    ensures 0 <= NextRetries(notLoaded, retries) <= MaxRetries
  {
  }

  // ---------------------------------------------------------------- pending changes
  // What the pane says about changes waiting for a Sync.

  datatype Pending = NotChecked | NeverSynced | UpToDate | Changed

  function PendingOf(checked: bool, neverSynced: bool, basecamp: int, github: int): Pending
  {
    if !checked then NotChecked
    else if neverSynced then NeverSynced
    else if basecamp > 0 || github > 0 then Changed
    else UpToDate
  }

  // There is something to sync (and auto_sync starts one).
  predicate HasChanges(checked: bool, neverSynced: bool, basecamp: int, github: int)
  {
    checked && (neverSynced || basecamp > 0 || github > 0)
  }

  // The label and the Sync agree: changes exactly when the pane says "never synced" or "changed".
  lemma ChangesMatchLabel(checked: bool, neverSynced: bool, basecamp: int, github: int)
    ensures HasChanges(checked, neverSynced, basecamp, github) <==>
      (PendingOf(checked, neverSynced, basecamp, github) == NeverSynced ||
       PendingOf(checked, neverSynced, basecamp, github) == Changed)
  {
  }

  // ---------------------------------------------------------------- sync result
  // What a `work refresh` report means, in order: it did not run, another sync held the lock,
  // a step failed, or it synced.

  datatype Outcome = DidNotRun | Locked | Failed | Synced

  function OutcomeOf(ran: bool, locked: bool, failed: bool): Outcome
  {
    if !ran then DidNotRun else if locked then Locked else if failed then Failed else Synced
  }

  // Only a sync that ran, held the lock and did not fail records a new last-sync time.
  lemma OnlySyncedRecords(ran: bool, locked: bool, failed: bool)
    ensures OutcomeOf(ran, locked, failed) == Synced <==> (ran && !locked && !failed)
  {
  }

  // A sync that could not read the briefs' Basecamp todos still synced; it says so. A sync that
  // failed already says why.
  predicate NotesBriefProblem(synced: bool, hasProblem: bool)
  {
    synced && hasProblem
  }

  // ---------------------------------------------------------------- where the pane runs (GH33)
  // The pane works only in a simpleapps-work project: the session root holds `work/README.md`.
  // A user-scope install loads it in every project, so elsewhere it MUST stay idle: a session
  // start registers `/work` and nothing else (no pane, no `gh`, no timer), and `/work` only says
  // where the pane runs. In a work project, `/work sync` syncs, `/work check` checks and answers,
  // and anything else opens the pane and checks, as before.

  datatype PaneStep = Idle | SyncStep | CheckStep | OpenPane

  // GH33 c-idle: a session start opens the pane, reads the setup and starts the timer only here.
  predicate StartsPane(isWork: bool)
  {
    isWork
  }

  // What `/work <args>` does, `args` trimmed.
  function CommandStep(isWork: bool, args: string): PaneStep
  {
    if !isWork then Idle
    else if args == "sync" then SyncStep
    else if args == "check" then CheckStep
    else OpenPane
  }

  // GH33 c-idle: outside a work project nothing starts, and no command does anything, whatever
  // its arguments.
  lemma IdleOutsideWork(args: string)
    ensures !StartsPane(false)
    ensures CommandStep(false, args) == Idle
  {
  }

  // GH33 c-unchanged: in a work project the pane starts, and every command does what it did
  // before GH33; only a project without work/ is idle.
  lemma WorkProjectUnchanged(args: string)
    ensures StartsPane(true)
    ensures CommandStep(true, args) != Idle
    ensures CommandStep(true, "sync") == SyncStep && CommandStep(true, "check") == CheckStep
    ensures args != "sync" && args != "check" ==> CommandStep(true, args) == OpenPane
  {
  }

  // Refuted: before GH33 the pane started in every project, so a user-scope install ran `gh`
  // and a check every interval in projects with no work/.
  predicate OldStartsPane(isWork: bool)
  {
    true
  }

  lemma OldStartsPaneRunsOutsideWork()
    ensures OldStartsPane(false) && !StartsPane(false)
  {
  }

  // ---------------------------------------------------------------- check log and stale (GH34)
  // Each check the pane runs is logged with whether it started a sync: only with auto_sync, with
  // changes pending, and no sync already running. `work status` says whether work/ was stale
  // before this check (no ok check or sync in 3 intervals, WorkData.IsWorkStale); the pane shows
  // it only after a check that failed, since an ok check is itself a current record.

  predicate StartsAutoSync(autoSync: bool, hasChanges: bool, syncing: bool)
  {
    autoSync && hasChanges && !syncing
  }

  predicate ShowsStale(checkOk: bool, statusStale: bool)
  {
    !checkOk && statusStale
  }

  // GH34 c-noflash: a pane reopened after a gap does not show stale once its check succeeds.
  lemma OkCheckIsNeverStale(statusStale: bool)
    ensures !ShowsStale(true, statusStale)
  {
  }

  // GH34 c-red: failing checks over a stale record show it.
  lemma FailedCheckShowsStaleRecord()
    ensures ShowsStale(false, true)
  {
  }

  // ---------------------------------------------------------------- headless sync (GH35)
  // A headless run (`claude -p "/work check"` on a schedule) starts with the connector still
  // connecting. A sync or check waits for it: a few tries, 2 s apart, while it is not loaded. A
  // sync that still cannot read Basecamp refreshes GitHub anyway, but is partial: it records no
  // last-sync time and its sync.log line says `partial`, not `ok`, so work/ goes stale
  // (WorkData.IsWorkStale) while Basecamp stays unread.

  const ConnectorTries: int := 3

  predicate WaitsForConnector(notLoaded: bool, tries: int)
  {
    notLoaded && tries < ConnectorTries
  }

  // The wait ends: at most ConnectorTries sleeps.
  lemma ConnectorWaitBounded(notLoaded: bool, tries: int)
    requires tries >= ConnectorTries
    ensures !WaitsForConnector(notLoaded, tries)
  {
  }

  predicate RecordsFullSync(synced: bool, basecampRead: bool)
  {
    synced && basecampRead
  }

  // GH35 c-full: a sync that skipped Basecamp is never recorded as a full sync.
  lemma SkippedBasecampIsNeverFull(synced: bool)
    ensures !RecordsFullSync(synced, false)
  {
  }

  // A full sync is one that synced and read Basecamp.
  lemma FullSyncIsSyncedAndRead()
    ensures RecordsFullSync(true, true)
    ensures !RecordsFullSync(false, true)
  {
  }

  // Refuted: before GH35 a sync whose Basecamp read failed (connector still connecting) still
  // recorded itself as synced.
  predicate OldRecordsFullSync(synced: bool, basecampRead: bool)
  {
    synced
  }

  lemma OldRecordedSkippedBasecamp()
    ensures OldRecordsFullSync(true, false) && !RecordsFullSync(true, false)
  {
  }

  // ---------------------------------------------------------------- the check and sync cycle
  // The hook's control flow as a state machine: what a check, a sync start and a sync end do to
  // the state the pane keeps (`syncing` in the process; lastCheckedAt, lastSyncAt in $.store;
  // the lines in work/check.log). hooks/register.tsx takes each of these steps through the proved
  // rules below (`checkRuns`, `syncBegins`, `recordsFullSync`, `startsAutoSync`); it cannot be
  // linked by proof (effects, async), so each lemma names the mod test that pins it
  // (plugins/simpleapps-work-pane/tests/work.test.ts).
  //
  // A timer tick checks only when due (another session may have just checked), using
  // `sync_minutes`, or 5 when `work status` failed: the due decision comes first, so a failing
  // status is logged once per interval, not once a minute in every session.

  // The step rules (pane-rules.ts).
  predicate CheckRuns(isTimer: bool, due: bool) { !isTimer || due }
  predicate SyncBegins(syncing: bool) { !syncing }
  predicate CheckSucceeded(failedParts: int) { failedParts == 0 }
  predicate RunsLinkedPass(refreshOk: bool, basecampRead: bool, hasLinked: bool) { refreshOk && basecampRead && hasLinked }
  predicate CommandChecks(openingRan: bool, openingNotLoaded: bool) { !openingRan || openingNotLoaded }
  predicate LogsCheck(isRetry: bool, ok: bool, retriesLeft: bool) { !isRetry || ok || !retriesLeft }
  predicate StaleShown(statusRead: bool, checkOk: bool, statusStale: bool, localStale: bool)
  {
    if statusRead then ShowsStale(checkOk, statusStale) else localStale
  }

  // What the pane keeps: `syncing` (the process), the last check, full sync and ok record ($.store
  // lastCheckedAt, lastSyncAt, lastOkAt), the check.log lines written, and the sync.log lines that
  // could read `ok`.
  datatype Cycle = Cycle(syncing: bool, checkedAt: int, syncedAt: int, okAt: int, logs: nat, okSyncLines: nat)

  // What happens to it: a check (a timer tick, an opening check, a retry), a sync started from
  // `/work sync` or the Sync button, and a sync's end. `refreshOk` is the last refresh's report;
  // the check a sync runs after it is a Check event of its own.
  datatype Event =
    | Check(isTimer: bool, due: bool, isRetry: bool, statusRead: bool, failedParts: nat,
            retriesLeft: bool, autoSync: bool, hasChanges: bool, now: int)
    | SyncStart
    | SyncEnd(refreshOk: bool, basecampRead: bool, hasLinked: bool, now: int)

  // A check: when it runs it records its time, and its ok time when it succeeded, writes one line
  // unless it is a failing retry with retries left, and claims the sync it starts in the same
  // step, so the line's "sync started" is true. A tick that is not due changes nothing.
  // A sync start claims `syncing` only when none runs. A sync's end clears it, records a full
  // sync, and counts the sync.log lines that can read `ok`: the first refresh's only with Basecamp
  // read (else `partial`), and the linked pass's only when that pass runs.
  function Step(c: Cycle, e: Event): Cycle
  {
    match e
    case Check(isTimer, due, isRetry, statusRead, failedParts, retriesLeft, autoSync, hasChanges, now) =>
      if !CheckRuns(isTimer, due) then c
      else
        var ok := statusRead && CheckSucceeded(failedParts);
        var starts := statusRead && StartsAutoSync(autoSync, hasChanges, c.syncing);
        c.(checkedAt := now,
           okAt := if ok then now else c.okAt,
           logs := c.logs + (if LogsCheck(isRetry, ok, retriesLeft) then 1 else 0),
           syncing := c.syncing || starts)
    case SyncStart =>
      if SyncBegins(c.syncing) then c.(syncing := true) else c
    case SyncEnd(refreshOk, basecampRead, hasLinked, now) =>
      if !c.syncing then c
      else
        var full := RecordsFullSync(refreshOk, basecampRead);
        c.(syncing := false,
           syncedAt := if full then now else c.syncedAt,
           okAt := if full then now else c.okAt,
           okSyncLines := c.okSyncLines
             + (if refreshOk && basecampRead then 1 else 0)
             + (if RunsLinkedPass(refreshOk, basecampRead, hasLinked) then 1 else 0))
  }

  function Run(c: Cycle, es: seq<Event>): Cycle
    decreases |es|
  {
    if |es| == 0 then c else Run(Step(c, es[0]), es[1..])
  }

  // The log lines a trace's checks write: those that run and are not a failing retry with more
  // to come. It depends only on the events, not the state.
  function Logged(es: seq<Event>): nat
    decreases |es|
  {
    if |es| == 0 then 0
    else
      (match es[0]
       case Check(isTimer, due, isRetry, statusRead, failedParts, retriesLeft, _, _, _) =>
         if CheckRuns(isTimer, due) && LogsCheck(isRetry, statusRead && CheckSucceeded(failedParts), retriesLeft) then 1 else 0
       case _ => 0)
      + Logged(es[1..])
  }

  // cycle-1 (tests "each check that runs is logged once, …", "a failing work status is logged
  // once per interval"): over any trace, check.log gains exactly the lines its checks write; a
  // tick that is not due, and a failing retry with retries left, write none.
  lemma LogsAreTheLoggedChecks(c: Cycle, es: seq<Event>)
    ensures Run(c, es).logs == c.logs + Logged(es)
    decreases |es|
  {
    if |es| > 0 { LogsAreTheLoggedChecks(Step(c, es[0]), es[1..]); }
  }

  predicate BasecampUnreadIn(es: seq<Event>)
  {
    forall k :: 0 <= k < |es| && es[k].SyncEnd? ==> !es[k].basecampRead
  }

  // cycle-2 (test "a sync that cannot read Basecamp …", GH #35; refutes the linked pass that
  // logged `ok`): while Basecamp stays unread, no sync in any trace adds a line that reads ok,
  // so work/ turns stale.
  lemma UnreadBasecampWritesNoOkLine(c: Cycle, es: seq<Event>)
    requires BasecampUnreadIn(es)
    ensures Run(c, es).okSyncLines == c.okSyncLines
    decreases |es|
  {
    if |es| > 0 {
      assert BasecampUnreadIn(es[1..]) by {
        forall k | 0 <= k < |es[1..]| && es[1..][k].SyncEnd? ensures !es[1..][k].basecampRead { assert es[1..][k] == es[k + 1]; }
      }
      UnreadBasecampWritesNoOkLine(Step(c, es[0]), es[1..]);
    }
  }

  // cycle-3 (tests "a sync that cannot read Basecamp …", "/work sync fetches …"): the last-sync
  // time only ever moves to the time of a full sync's end.
  lemma SyncedAtIsAFullSync(c: Cycle, es: seq<Event>)
    ensures Run(c, es).syncedAt == c.syncedAt
         || exists k :: 0 <= k < |es| && es[k].SyncEnd? && RecordsFullSync(es[k].refreshOk, es[k].basecampRead)
                        && es[k].now == Run(c, es).syncedAt
    decreases |es|
  {
    if |es| > 0 {
      SyncedAtIsAFullSync(Step(c, es[0]), es[1..]);
      var r := Run(Step(c, es[0]), es[1..]);
      if r.syncedAt != Step(c, es[0]).syncedAt {
        var k :| 0 <= k < |es[1..]| && es[1..][k].SyncEnd? && RecordsFullSync(es[1..][k].refreshOk, es[1..][k].basecampRead) && es[1..][k].now == r.syncedAt;
        assert es[k + 1] == es[1..][k];
      }
    }
  }

  // cycle-4 (tests "a check that starts a sync says so", "one sync at a time"): a check that logs
  // "sync started" really starts it (the claim is in the same step), and none starts while one runs.
  lemma SyncStartedIsTrue(c: Cycle, isTimer: bool, due: bool, isRetry: bool, failedParts: nat,
                          retriesLeft: bool, autoSync: bool, hasChanges: bool, now: int)
    requires CheckRuns(isTimer, due) && StartsAutoSync(autoSync, hasChanges, c.syncing)
    ensures !c.syncing
    ensures Step(c, Check(isTimer, due, isRetry, true, failedParts, retriesLeft, autoSync, hasChanges, now)).syncing
  {
  }

  lemma NoSecondSync(c: Cycle, e: Event)
    requires c.syncing && !e.SyncEnd?
    ensures Step(c, e).syncing
  {
  }

  // cycle-5 (test "a failed check over a stale record shows stale"; "stale clears after an ok
  // check"): an ok check records its time as the last ok record, so the pane's own staleness
  // clears; an unreadable status shows that record's staleness, so a long outage turns red.
  lemma OkCheckRecordsOk(c: Cycle, isTimer: bool, due: bool, isRetry: bool, retriesLeft: bool,
                         autoSync: bool, hasChanges: bool, now: int)
    requires CheckRuns(isTimer, due)
    ensures Step(c, Check(isTimer, due, isRetry, true, 0, retriesLeft, autoSync, hasChanges, now)).okAt == now
  {
  }

  lemma UnreadStatusShowsLocal(checkOk: bool, statusStale: bool, localStale: bool)
    ensures StaleShown(false, checkOk, statusStale, localStale) == localStale
  {
  }

  // cycle-6 (test "a headless /work check logs one line"): `/work` that waited for an opening
  // check that read the connector runs no second check.
  lemma OneCheckPerCommand()
    ensures !CommandChecks(true, false)
    ensures CommandChecks(false, false) && CommandChecks(true, true)
  {
  }

  // Refuted: before, the due test came after `work status`, so a failing status ran (and logged)
  // on every tick: a tick not due still wrote a line.
  function OldCheckStep(c: Cycle, isTimer: bool, due: bool, statusOk: bool, now: int): Cycle
  {
    if !statusOk then c.(logs := c.logs + 1)
    else if CheckRuns(isTimer, due) then c.(checkedAt := now, logs := c.logs + 1)
    else c
  }

  lemma OldLoggedTicksNotDue(c: Cycle)
    ensures OldCheckStep(c, true, false, false, 0).logs == c.logs + 1
    ensures Step(c, Check(true, false, false, false, 1, false, false, false, 0)).logs == c.logs
  {
  }

  // Refuted: before, the linked pass ran after any ok refresh, so a sync with Basecamp unread
  // could still write an `ok` line (the review's finding).
  function OldOkSyncLines(refreshOk: bool, basecampRead: bool, hasLinked: bool): nat
  {
    (if refreshOk && basecampRead then 1 else 0) + (if refreshOk && hasLinked then 1 else 0)
  }

  lemma OldLinkedPassLoggedOk()
    ensures OldOkSyncLines(true, false, true) == 1
    ensures !RunsLinkedPass(true, false, true)
  {
  }

  // ---------------------------------------------------------------- the lists the pane builds
  // The hook's data helpers (pane-rules.ts "the lists the pane builds"). The shell parses JSON,
  // dates and numbers into these records and maps a proved function over a list.
  //
  // The trusted boundary: what hooks/register.tsx still does itself, no prover reaching it, and
  // the test that pins each (plugins/simpleapps-work-pane/tests/work.test.ts unless named):
  // - `$` I/O: processes, the connector, timers, $.store, drawing: every mod test ("the pane in a
  //   session"), with the cycle above as their model.
  // - JSON parsing: mcpJson, stdoutJson, countFrom, the .mcp.json read in duplicateServers, the
  //   get_todo record shape in completedIds: "labels, colours and parsing", "duplicateServers …";
  //   work/list.json in listFrom (GH #47): "listFrom reads work/list.json …".
  // - The List view's drawing (GH #47): the repo keys mapped out of list.json for FilterKeys, and
  //   the groups kept by ShowsGroup: "List shows the list …", "a heading filters the list …".
  // - Number and date parsing: parseIssueCount (parseInt), parsedTime (Date.parse), Number() of
  //   ids and projects: "change detection …", tests/work-pane/pane-lists.test.ts.
  // - Words built from numbers: label, pendingLabel, checkSummary, trackedLabel, trackedRows,
  //   clockTime, mcpProblem, the gh argv builders: "labels …", "pending, due, results and the
  //   check line", "what is tracked, and the search arguments".
  // - Element-wise maps of proved rules (lower, repoName per watched repo; inWatchedRepo per item)
  //   and record conversions (asTarget, asPaneTarget, closedList): pane-lists.test.ts, whose
  //   oracle is the code each list replaced.
  // - Filters on parsed fields: the Basecamp-todo filter (`source`, `kind`) and the malformed-id
  //   filter (`Number.isFinite`) in todosToFetch: "change detection …".
  // - Text searches: "tool not loaded" in a failed part (notLoaded) and in lastSummary (the
  //   connector waits in `command`): "an unconnected connector …", "/work check looks again …".
  // - Caches and all-or-nothing reads: basecampPending's fingerprint cache (re-diff only on a new
  //   fingerprint), briefTodoArgs keeping the last read when any project's call fails: "/work
  //   sync fetches …", "a project server …".
  // - The order of awaits in check, sync and command, and the opening and syncDone promises: the
  //   cycle model above, with each lemma's test named there.
  // Moved into proved rules after the review: checkOk (`checkSucceeded`), the linked pass
  // (`runsLinkedPass`), one check per command (`commandChecks`), retry lines (`logsCheck`),
  // stale shown (`staleShown`), and the lastSyncAt gate (`result.ok`, from `syncResultOf` and
  // `withBasecampSkipped`).
  // In the scripts the same holds for refresh.ts' lastOkAt (Date.parse) and logWord (words):
  // tests/work-pane/work.test.ts "log-check …".

  // A watched repo is named by what follows its last "/".
  function NameStart(repo: string, i: nat): nat
    requires i <= |repo|
    ensures NameStart(repo, i) <= i
  {
    RunStart(repo, 0, i, (c: int) => c != 47)
  }

  function RepoName(repo: string): string { repo[NameStart(repo, |repo|)..] }

  lemma RepoNameHasNoSlash(repo: string, i: nat)
    requires i <= |repo|
    ensures forall k :: NameStart(repo, i) <= k < i ==> repo[k] as int != 47
  {
  }

  // Some name from i on has id as an issue: the search for one stops short of the end.
  predicate WatchedFrom(id: string, names: seq<string>, i: nat)
    requires i <= |names|
  {
    ListEnd(names, i, (n: string) => !IsIssueIdOf(id, "gh-" + n + "-")) < |names|
  }

  // An id is watched exactly when some name has it as an issue.
  lemma WatchedIsSomeName(id: string, names: seq<string>, i: nat)
    requires i <= |names|
    ensures WatchedFrom(id, names, i) <==> exists k :: i <= k < |names| && IsIssueIdOf(id, "gh-" + names[k] + "-")
  {
  }

  datatype Item = Item(status: string, source: string, kind: string, mine: bool, watched: bool)
  datatype Totals = Totals(basecamp: int, github: int)

  function TallyFrom(items: seq<Item>, i: nat): Totals
    decreases |items| - i
  {
    if i >= |items| then Totals(0, 0)
    else
      var rest := TallyFrom(items, i + 1);
      var it := items[i];
      var open := it.status == "open";
      Totals(rest.basecamp + (if IsTrackedTodo(open, it.source == "basecamp", it.kind == "todo", it.mine) then 1 else 0),
             rest.github + (if IsTrackedIssue(open, it.source == "github", it.kind == "issue", it.watched) then 1 else 0))
  }

  // Never more tracked than items.
  lemma TallyBounded(items: seq<Item>, i: nat)
    ensures 0 <= TallyFrom(items, i).basecamp <= |items| - i || i > |items|
    ensures 0 <= TallyFrom(items, i).github <= |items| - i || i > |items|
    decreases |items| - i
  {
    if i < |items| { TallyBounded(items, i + 1); }
  }

  function UnreadFrom(repos: seq<string>, read: seq<bool>, i: nat): seq<string>
    requires |repos| == |read|
    decreases |repos| - i
  {
    if i >= |repos| then [] else (if !read[i] then [repos[i]] else []) + UnreadFrom(repos, read, i + 1)
  }

  // The failed parts, in order: count, index, each unread repo, the change search.
  function FailedParts(countFailed: bool, countProblem: string, indexFailed: bool, indexProblem: string,
                       repos: seq<string>, read: seq<bool>, changesRead: bool): seq<string>
    requires |repos| == |read|
  {
    (if countFailed then ["Basecamp count (" + countProblem + ")"] else [])
    + (if indexFailed then ["Basecamp index (" + indexProblem + ")"] else [])
    + UnreadFrom(repos, read, 0)
    + (if changesRead then [] else ["GitHub changes"])
  }

  // Nothing failed: no parts.
  lemma AllReadNoParts(repos: seq<string>, read: seq<bool>, i: nat)
    requires |repos| == |read|
    requires forall k :: 0 <= k < |read| ==> read[k]
    ensures UnreadFrom(repos, read, i) == []
    decreases |repos| - i
  {
    if i < |repos| { AllReadNoParts(repos, read, i + 1); }
  }

  datatype Target = Target(id: int, projectId: int, projectName: string, list: string)
  datatype RemoteTodo = RemoteTodo(id: int, projectId: int, projectName: string, list: string, updatedKnown: bool, updatedMs: int)
  datatype LocalTodo = LocalTodo(num: int, updatedKnown: bool, updatedMs: int, hasProject: bool, projectId: int, mine: bool)

  function TodoAt(todos: seq<RemoteTodo>, id: int, i: nat): int
    requires i <= |todos|
    ensures TodoAt(todos, id, i) == -1 || (i <= TodoAt(todos, id, i) < |todos| && todos[TodoAt(todos, id, i)].id == id)
  {
    var j := ListEnd(todos, i, (t: RemoteTodo) => t.id != id);
    if j < |todos| then j else -1
  }

  // Each todo once, in first-seen order, as last seen (a Map's behaviour).
  function UniqueFrom(acc: seq<RemoteTodo>, todos: seq<RemoteTodo>, i: nat): seq<RemoteTodo>
    decreases |todos| - i
  {
    if i >= |todos| then acc
    else
      var t := todos[i];
      var k := TodoAt(acc, t.id, 0);
      UniqueFrom(if k < 0 then acc + [t] else acc[..k] + [t] + acc[k + 1..], todos, i + 1)
  }

  predicate IdsUnique(todos: seq<RemoteTodo>)
  {
    forall a, b :: 0 <= a < b < |todos| ==> todos[a].id != todos[b].id
  }

  lemma TodoAtMissing(todos: seq<RemoteTodo>, id: int, i: nat)
    requires i <= |todos|
    requires TodoAt(todos, id, i) == -1
    ensures forall k :: i <= k < |todos| ==> todos[k].id != id
  {
  }

  // No id twice in the result.
  lemma UniqueHasNoRepeats(acc: seq<RemoteTodo>, todos: seq<RemoteTodo>, i: nat)
    requires IdsUnique(acc)
    ensures IdsUnique(UniqueFrom(acc, todos, i))
    decreases |todos| - i
  {
    if i < |todos| {
      var t := todos[i];
      var k := TodoAt(acc, t.id, 0);
      if k < 0 {
        TodoAtMissing(acc, t.id, 0);
        UniqueHasNoRepeats(acc + [t], todos, i + 1);
      } else {
        var next := acc[..k] + [t] + acc[k + 1..];
        assert forall a :: 0 <= a < |next| ==> next[a].id == acc[a].id;
        UniqueHasNoRepeats(next, todos, i + 1);
      }
    }
  }

  function LocalAt(local: seq<LocalTodo>, num: int, i: nat): int
    ensures LocalAt(local, num, i) == -1 || (i <= LocalAt(local, num, i) < |local|)
    decreases |local| - i
  {
    if i >= |local| then -1
    else
      var rest := LocalAt(local, num, i + 1);
      if rest != -1 then rest else if local[i].num == num then i else -1
  }

  // New or edited since work/ last saw them.
  function EditedFrom(remote: seq<RemoteTodo>, local: seq<LocalTodo>, i: nat): seq<Target>
    decreases |remote| - i
  {
    if i >= |remote| then []
    else
      var r := remote[i];
      var k := LocalAt(local, r.id, 0);
      var beforeKnown := k >= 0 && local[k].updatedKnown;
      var beforeMs := if k >= 0 then local[k].updatedMs else 0;
      (if IsEdited(beforeKnown, beforeMs, r.updatedKnown, r.updatedMs) then [Target(r.id, r.projectId, r.projectName, r.list)] else [])
        + EditedFrom(remote, local, i + 1)
  }

  predicate RemoteHasFrom(remote: seq<RemoteTodo>, id: int, i: nat)
    requires i <= |remote|
  {
    ListEnd(remote, i, (t: RemoteTodo) => t.id != id) < |remote|
  }

  // Local todos that left your list (or, linked, every other one).
  function LeftFrom(local: seq<LocalTodo>, remote: seq<RemoteTodo>, linked: bool, i: nat): seq<Target>
    decreases |local| - i
  {
    if i >= |local| then []
    else
      var l := local[i];
      (if HasLeft(RemoteHasFrom(remote, l.num, 0), l.hasProject, linked, l.mine) then [Target(l.num, l.projectId, "", "")] else [])
        + LeftFrom(local, remote, linked, i + 1)
  }

  function TodosToFetch(remote: seq<RemoteTodo>, local: seq<LocalTodo>, linked: bool): seq<Target>
  {
    EditedFrom(remote, local, 0) + LeftFrom(local, remote, linked, 0)
  }

  // A todo still on your list is never fetched as departed.
  lemma OnListNeverLeft(local: seq<LocalTodo>, remote: seq<RemoteTodo>, linked: bool, i: nat)
    requires forall k :: 0 <= k < |local| ==> RemoteHasFrom(remote, local[k].num, 0)
    ensures LeftFrom(local, remote, linked, i) == []
    decreases |local| - i
  {
    if i < |local| { OnListNeverLeft(local, remote, linked, i + 1); }
  }

  datatype LinkedTodo = LinkedTodo(num: int, hasProject: bool, projectId: int)

  function LinkedFrom(found: seq<LinkedTodo>, i: nat): seq<Target>
    decreases |found| - i
  {
    if i >= |found| then []
    else (if found[i].hasProject then [Target(found[i].num, found[i].projectId, "", "")] else []) + LinkedFrom(found, i + 1)
  }

  datatype FetchedTodo = FetchedTodo(hasId: bool, id: int, completed: bool)

  function CompletedFrom(records: seq<FetchedTodo>, i: nat): seq<int>
    decreases |records| - i
  {
    if i >= |records| then []
    else (if records[i].hasId && records[i].completed then [records[i].id] else []) + CompletedFrom(records, i + 1)
  }

  datatype ClosedTodo = ClosedTodo(id: int, at: int)

  function ClosedAt(closed: seq<ClosedTodo>, id: int, i: nat): int
    ensures ClosedAt(closed, id, i) == -1 || (i <= ClosedAt(closed, id, i) < |closed|)
    decreases |closed| - i
  {
    if i >= |closed| then -1
    else
      var rest := ClosedAt(closed, id, i + 1);
      if rest != -1 then rest else if closed[i].id == id then i else -1
  }

  function NotClosedFrom(targets: seq<Target>, closed: seq<ClosedTodo>, now: int, i: nat): seq<Target>
    decreases |targets| - i
  {
    if i >= |targets| then []
    else
      var k := ClosedAt(closed, targets[i].id, 0);
      (if !SkipsClosed(k >= 0, now, if k >= 0 then closed[k].at else 0) then [targets[i]] else [])
        + NotClosedFrom(targets, closed, now, i + 1)
  }

  // With nothing seen closed, every target is fetched.
  lemma NothingClosedKeepsAll(targets: seq<Target>, now: int, i: nat)
    ensures NotClosedFrom(targets, [], now, i) == (if i >= |targets| then [] else targets[i..])
    decreases |targets| - i
  {
    if i < |targets| { NothingClosedKeepsAll(targets, now, i + 1); }
  }

  predicate IdFrom(ids: seq<int>, id: int, i: nat)
    requires i <= |ids|
  {
    ListEnd(ids, i, (x: int) => x != id) < |ids|
  }

  function KeptFrom(closed: seq<ClosedTodo>, ids: seq<int>, now: int, i: nat): seq<ClosedTodo>
    decreases |closed| - i
  {
    if i >= |closed| then []
    else ((if IsRecentlyClosed(now, closed[i].at) && !IdFrom(ids, closed[i].id, 0) then [closed[i]] else [])
      + KeptFrom(closed, ids, now, i + 1))
  }

  function ClosedNowFrom(ids: seq<int>, now: int, i: nat): seq<ClosedTodo>
    decreases |ids| - i
  {
    if i >= |ids| then []
    else (if !IdFrom(ids, ids[i], i + 1) then [ClosedTodo(ids[i], now)] else []) + ClosedNowFrom(ids, now, i + 1)
  }

  function RememberClosed(closed: seq<ClosedTodo>, ids: seq<int>, now: int): seq<ClosedTodo>
  {
    KeptFrom(closed, ids, now, 0) + ClosedNowFrom(ids, now, 0)
  }

  // Every entry kept is within 7 days.
  lemma KeptAreRecent(closed: seq<ClosedTodo>, ids: seq<int>, now: int, i: nat)
    ensures forall c :: c in KeptFrom(closed, ids, now, i) ==> IsRecentlyClosed(now, c.at)
    decreases |closed| - i
  {
    if i < |closed| { KeptAreRecent(closed, ids, now, i + 1); }
  }

  // Every entry closed now is stamped now.
  lemma ClosedNowIsNow(ids: seq<int>, now: int, i: nat)
    ensures forall c :: c in ClosedNowFrom(ids, now, i) ==> c.at == now
    decreases |ids| - i
  {
    if i < |ids| { ClosedNowIsNow(ids, now, i + 1); }
  }

  predicate ClosedIdsUnique(s: seq<ClosedTodo>)
  {
    forall a, b :: 0 <= a < b < |s| ==> s[a].id != s[b].id
  }

  lemma KeptFromIn(closed: seq<ClosedTodo>, ids: seq<int>, now: int, i: nat)
    ensures forall c :: c in KeptFrom(closed, ids, now, i) ==> (exists k :: i <= k < |closed| && closed[k] == c) && !IdFrom(ids, c.id, 0)
    decreases |closed| - i
  {
    if i < |closed| { KeptFromIn(closed, ids, now, i + 1); }
  }

  lemma KeptFromUnique(closed: seq<ClosedTodo>, ids: seq<int>, now: int, i: nat)
    requires ClosedIdsUnique(closed)
    ensures ClosedIdsUnique(KeptFrom(closed, ids, now, i))
    decreases |closed| - i
  {
    if i < |closed| {
      KeptFromUnique(closed, ids, now, i + 1);
      KeptFromIn(closed, ids, now, i + 1);
    }
  }

  lemma ClosedNowFromIn(ids: seq<int>, now: int, i: nat)
    ensures forall c :: c in ClosedNowFrom(ids, now, i) ==> IdFrom(ids, c.id, i)
    decreases |ids| - i
  {
    if i < |ids| { ClosedNowFromIn(ids, now, i + 1); }
  }

  lemma ClosedNowFromUnique(ids: seq<int>, now: int, i: nat)
    ensures ClosedIdsUnique(ClosedNowFrom(ids, now, i))
    decreases |ids| - i
  {
    if i < |ids| {
      ClosedNowFromUnique(ids, now, i + 1);
      ClosedNowFromIn(ids, now, i + 1);
    }
  }

  // The closed record keeps one entry per id (the code's comment promised it): kept entries are
  // unique and none is closed again now; the new ones are unique, each an id closed now.
  lemma RememberClosedOnePerId(closed: seq<ClosedTodo>, ids: seq<int>, now: int)
    requires ClosedIdsUnique(closed)
    ensures ClosedIdsUnique(RememberClosed(closed, ids, now))
  {
    KeptFromUnique(closed, ids, now, 0);
    ClosedNowFromUnique(ids, now, 0);
    KeptFromIn(closed, ids, now, 0);
    ClosedNowFromIn(ids, now, 0);
    var kept := KeptFrom(closed, ids, now, 0);
    var added := ClosedNowFrom(ids, now, 0);
    var all := kept + added;
    forall a, b | 0 <= a < b < |all| ensures all[a].id != all[b].id {
      if b >= |kept| && a < |kept| {
        assert all[a] in kept && all[b] in added;
      }
    }
  }

  // Every remote todo that is new or edited is fetched.
  lemma EditedFromComplete(remote: seq<RemoteTodo>, local: seq<LocalTodo>, i: nat, k: nat)
    requires i <= k < |remote|
    requires var r := remote[k];
             var j := LocalAt(local, r.id, 0);
             IsEdited(j >= 0 && local[j].updatedKnown, if j >= 0 then local[j].updatedMs else 0, r.updatedKnown, r.updatedMs)
    ensures Target(remote[k].id, remote[k].projectId, remote[k].projectName, remote[k].list) in EditedFrom(remote, local, i)
    decreases k - i
  {
    if i < k { EditedFromComplete(remote, local, i + 1, k); }
  }

  // Linked targets are exactly the found todos with a project; completed ids come from records
  // that completed; duplicate names are servers on the connector's URL.
  lemma LinkedFromExact(found: seq<LinkedTodo>, i: nat)
    ensures forall t :: t in LinkedFrom(found, i) <==>
      exists k :: i <= k < |found| && found[k].hasProject && t == Target(found[k].num, found[k].projectId, "", "")
    decreases |found| - i
  {
    if i < |found| { LinkedFromExact(found, i + 1); }
  }

  lemma CompletedFromAreCompleted(records: seq<FetchedTodo>, i: nat)
    ensures forall x :: x in CompletedFrom(records, i) ==>
      exists k :: i <= k < |records| && records[k].hasId && records[k].completed && records[k].id == x
    decreases |records| - i
  {
    if i < |records| { CompletedFromAreCompleted(records, i + 1); }
  }

  lemma DuplicatesAreOnUrl(servers: seq<Server>, i: nat)
    ensures forall n :: n in OnConnectorUrlFrom(servers, i) ==>
      exists k :: i <= k < |servers| && servers[k].name == n && servers[k].hasUrl && IsBasecampUrl(servers[k].url)
    decreases |servers| - i
  {
    if i < |servers| { DuplicatesAreOnUrl(servers, i + 1); }
  }

  predicate HasId(s: seq<RemoteTodo>, id: int) { exists u :: u in s && u.id == id }

  lemma SpliceKeepsIds(acc: seq<RemoteTodo>, k: nat, t: RemoteTodo, id: int)
    requires k < |acc| && acc[k].id == t.id
    ensures HasId(acc, id) ==> HasId(acc[..k] + [t] + acc[k + 1..], id)
  {
    if HasId(acc, id) {
      var u :| u in acc && u.id == id;
      var j :| 0 <= j < |acc| && acc[j] == u;
      var next := acc[..k] + [t] + acc[k + 1..];
      assert next[j].id == id;
    }
  }

  // Every todo id read from the index is in the unique list (with no repeats, above).
  lemma UniqueKeepsEveryId(acc: seq<RemoteTodo>, todos: seq<RemoteTodo>, i: nat, id: int)
    requires HasId(acc, id) || exists k :: i <= k < |todos| && todos[k].id == id
    ensures HasId(UniqueFrom(acc, todos, i), id)
    decreases |todos| - i
  {
    if i < |todos| {
      var t := todos[i];
      var k := TodoAt(acc, t.id, 0);
      var next := if k < 0 then acc + [t] else acc[..k] + [t] + acc[k + 1..];
      if k < 0 {
        assert HasId(acc, id) ==> HasId(next, id) by {
          if HasId(acc, id) { var u :| u in acc && u.id == id; assert u in next; }
        }
      } else {
        SpliceKeepsIds(acc, k, t, id);
      }
      assert t in next;
      UniqueKeepsEveryId(next, todos, i + 1, id);
    }
  }

  function ProjectIdsFrom(acc: seq<int>, ids: seq<int>, i: nat): seq<int>
    decreases |ids| - i
  {
    if i >= |ids| then acc
    else ProjectIdsFrom(if IsProjectId(ids[i]) && !IdFrom(acc, ids[i], 0) then acc + [ids[i]] else acc, ids, i + 1)
  }

  lemma IdFromMeansIn(ids: seq<int>, id: int, i: nat)
    requires i <= |ids|
    ensures IdFrom(ids, id, i) <==> exists k :: i <= k < |ids| && ids[k] == id
  {
  }

  // The brief projects are real ids, each once.
  lemma ProjectIdsPositiveAndUnique(acc: seq<int>, ids: seq<int>, i: nat)
    requires forall k :: 0 <= k < |acc| ==> IsProjectId(acc[k])
    requires forall a, b :: 0 <= a < b < |acc| ==> acc[a] != acc[b]
    ensures forall k :: 0 <= k < |ProjectIdsFrom(acc, ids, i)| ==> IsProjectId(ProjectIdsFrom(acc, ids, i)[k])
    ensures forall a, b :: 0 <= a < b < |ProjectIdsFrom(acc, ids, i)| ==> ProjectIdsFrom(acc, ids, i)[a] != ProjectIdsFrom(acc, ids, i)[b]
    decreases |ids| - i
  {
    if i < |ids| {
      IdFromMeansIn(acc, ids[i], 0);
      var next := if IsProjectId(ids[i]) && !IdFrom(acc, ids[i], 0) then acc + [ids[i]] else acc;
      ProjectIdsPositiveAndUnique(next, ids, i + 1);
    }
  }

  datatype Server = Server(name: string, hasUrl: bool, url: string)

  function OnConnectorUrlFrom(servers: seq<Server>, i: nat): seq<string>
    decreases |servers| - i
  {
    if i >= |servers| then []
    else (if servers[i].hasUrl && IsBasecampUrl(servers[i].url) then [servers[i].name] else []) + OnConnectorUrlFrom(servers, i + 1)
  }

  datatype SyncWords = SyncWords(at: int, ok: bool, detail: string)

  function SyncResultOf(ran: bool, locked: bool, failed: bool, step: string, why: string, at: int): SyncWords
  {
    match OutcomeOf(ran, locked, failed)
    case DidNotRun => SyncWords(at, false, "work refresh did not run")
    case Locked => SyncWords(at, false, "another sync is running")
    case Failed => SyncWords(at, false, "failed at " + step + ": " + why)
    case Synced => SyncWords(at, true, "synced")
  }

  // Only a sync that synced is ok.
  lemma OnlySyncedIsOk(ran: bool, locked: bool, failed: bool, step: string, why: string, at: int)
    ensures SyncResultOf(ran, locked, failed, step, why, at).ok <==> OutcomeOf(ran, locked, failed) == Synced
  {
  }

  function WithBasecampSkipped(r: SyncWords, skipped: bool, problem: string): SyncWords
  {
    if RecordsFullSync(r.ok, !skipped) || !r.ok then r
    else SyncWords(r.at, false, r.detail + ", GitHub only; Basecamp skipped (" + problem + ")")
  }

  // GH35 c-full, on the words: a skipped Basecamp is never an ok sync.
  lemma SkippedIsNeverOk(r: SyncWords, problem: string)
    ensures !WithBasecampSkipped(r, true, problem).ok
  {
  }

  function WithBriefProblem(r: SyncWords, hasProblem: bool, problem: string): SyncWords
  {
    if !NotesBriefProblem(r.ok, hasProblem) then r
    else SyncWords(r.at, r.ok, r.detail + "; briefs kept their last Basecamp read (" + problem + ")")
  }

  // A brief problem never changes whether the sync was ok.
  lemma BriefProblemKeepsOk(r: SyncWords, hasProblem: bool, problem: string)
    ensures WithBriefProblem(r, hasProblem, problem).ok == r.ok
  {
  }

  // The List view (GH #47). The filter is a group's key, or "" for All. A heading clicked while
  // it is the filter goes back to All; any other heading becomes the filter; All ("") is All.
  function NextFilter(current: string, clicked: string): string
  {
    if clicked == current then "" else clicked
  }

  lemma SecondClickShowsAll(current: string)
    ensures NextFilter(current, current) == ""
  {
  }

  lemma AllIsAll(current: string)
    ensures NextFilter(current, "") == ""
  {
  }

  // The List view's filter keys: Basecamp's, when it has todos, then each repo's, in list order.
  function FilterKeys(hasBasecamp: bool, basecampKey: string, repos: seq<string>): seq<string>
  {
    if hasBasecamp then [basecampKey] + repos else repos
  }

  predicate KeyFrom(keys: seq<string>, key: string, i: nat)
    requires i <= |keys|
  {
    ListEnd(keys, i, (x: string) => x != key) < |keys|
  }

  lemma KeyFromMeansIn(keys: seq<string>, key: string, i: nat)
    requires i <= |keys|
    ensures KeyFrom(keys, key, i) <==> exists k :: i <= k < |keys| && keys[k] == key
  {
  }

  // A group shows under All, under its own key, and under a filter no group has any more (a sync
  // emptied it): that falls back to All rather than an empty list.
  predicate ShowsGroup(filter: string, key: string, keys: seq<string>)
  {
    filter == "" || filter == key || !KeyFrom(keys, filter, 0)
  }

  lemma AllShowsEveryGroup(key: string, keys: seq<string>)
    ensures ShowsGroup("", key, keys)
  {
  }

  // A filter some group has shows that group only.
  lemma FilterShowsOnlyItsGroup(filter: string, key: string, keys: seq<string>)
    requires filter != "" && filter in keys
    ensures ShowsGroup(filter, key, keys) <==> key == filter
  {
    KeyFromMeansIn(keys, filter, 0);
  }

  // A filter no group has shows every group.
  lemma GoneFilterShowsAll(filter: string, key: string, keys: seq<string>)
    requires filter !in keys
    ensures ShowsGroup(filter, key, keys)
  {
    KeyFromMeansIn(keys, filter, 0);
  }
}
