// The model of the Work pane (plugins/simpleapps-work-pane): every decision the pane makes about
// a value, written before the code (wiki Proofs). `plugins/simpleapps-work-pane/scripts/
// pane-rules.ts` is proved with LemmaScript and linked to it in `models/links/work-pane-rules.dfy`.
//
// The pane's shell (hooks/register.tsx) only reads, calls and draws: it parses JSON, runs `gh`
// and the work scripts, calls the Basecamp connector, and asks these rules what each value means.
// Each rule keeps the behaviour of the pane it replaces (GH #14), so `work/` keeps working as it
// does today.

module WorkPane {

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
}
