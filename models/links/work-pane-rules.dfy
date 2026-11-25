// Links plugins/simpleapps-work-pane/scripts/pane-rules.ts (its proved .dfy) to the model,
// models/WorkPane.dfy: every exported rule decides exactly what the model says. The code returns
// string tags where the model has datatypes, and reads code units in place where the model
// reads slices.
include "../../plugins/simpleapps-work-pane/scripts/pane-rules.dfy"
include "../WorkPane.dfy"

// ---------------------------------------------------------------- counts

lemma CountColourMatchesModel(known: bool, open: int, complete: bool)
  ensures countColour(known, open, complete) == Colour.red <==> WorkPane.CountColour(known, open, complete) == WorkPane.Red
  ensures countColour(known, open, complete) == Colour.green <==> WorkPane.CountColour(known, open, complete) == WorkPane.Green
  ensures countColour(known, open, complete) == Colour.plain <==> WorkPane.CountColour(known, open, complete) == WorkPane.Plain
{
}

lemma CountMarkMatchesModel(complete: bool)
  ensures countMark(complete) == WorkPane.CountMark(complete)
{
}

// ---------------------------------------------------------------- what is tracked

lemma IsTrackedTodoMatchesModel(isOpen: bool, isBasecamp: bool, isTodo: bool, mine: bool)
  ensures isTrackedTodo(isOpen, isBasecamp, isTodo, mine) == WorkPane.IsTrackedTodo(isOpen, isBasecamp, isTodo, mine)
{
}

lemma IsTrackedIssueMatchesModel(isOpen: bool, isGithub: bool, isIssue: bool, watched: bool)
  ensures isTrackedIssue(isOpen, isGithub, isIssue, watched) == WorkPane.IsTrackedIssue(isOpen, isGithub, isIssue, watched)
{
}

// ---------------------------------------------------------------- the three shared scans
// The only scan inductions in this file: the code's paneRunEnd, paneRunStart and paneListEnd are
// Text's ScanEnd, RunStart and ListEnd for every test. Each scan below links in a call to one of
// these and, where the code passes its own test or its own records, Text's Ext lemma.

lemma PaneRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures forall ok: int -> bool :: paneRunEnd(s, i, ok) == Text.ScanEnd(s, i, ok)
{
  forall ok: int -> bool ensures paneRunEnd(s, i, ok) == Text.ScanEnd(s, i, ok) { PaneRunEndIs(s, i, ok); }
}

lemma PaneRunEndIs(s: string, i: nat, ok: int -> bool)
  requires i <= |s|
  ensures paneRunEnd(s, i, ok) == Text.ScanEnd(s, i, ok)
  decreases |s| - i
{
  if i < |s| { PaneRunEndIs(s, i + 1, ok); }
}

lemma PaneRunStartMatchesModel(s: string, lo: nat, e: nat)
  requires lo <= e <= |s|
  ensures forall ok: int -> bool :: paneRunStart(s, lo, e, ok) == Text.RunStart(s, lo, e, ok)
  decreases e - lo
{
  if lo < e { PaneRunStartMatchesModel(s, lo, e - 1); }
}

lemma PaneListEndMatchesModel<T>(xs: seq<T>, i: nat)
  requires i <= |xs|
  ensures forall ok: T -> bool :: paneListEnd(xs, i, ok) == Text.ListEnd(xs, i, ok)
  decreases |xs| - i
{
  if i < |xs| { PaneListEndMatchesModel(xs, i + 1); }
}

lemma IsIssueIdOfMatchesModel(id: string, prefix: string)
  ensures isIssueIdOf(id, prefix) == WorkPane.IsIssueIdOf(id, prefix)
{
  if |id| > |prefix| {
    var t := id[|prefix|..];
    assert id[|prefix|..|id|] == t;
    PaneRunEndMatchesModel(t, 0);
    Text.ScanReaches(t, 0, |t|, isIdDigitUnit);
    assert idDigitsFrom(t, 0) <==> forall k :: 0 <= k < |t| ==> isIdDigitUnit(t[k] as int);
  }
}

lemma HasOwnerMatchesModel(repo: string)
  ensures hasOwner(repo) == WorkPane.HasOwner(repo)
{
  PaneRunEndMatchesModel(repo, 0);
}

// ---------------------------------------------------------------- the connector

lemma IsBasecampUrlMatchesModel(url: string)
  ensures isBasecampUrl(url) == WorkPane.IsBasecampUrl(url)
{
  assert BASECAMP_ORIGIN == WorkPane.BasecampOrigin;
}

lemma IsProjectIdMatchesModel(id: int)
  ensures isProjectId(id) == WorkPane.IsProjectId(id)
{
}

// ---------------------------------------------------------------- change detection

lemma IsEditedMatchesModel(localKnown: bool, localMs: int, remoteKnown: bool, remoteMs: int)
  ensures isEdited(localKnown, localMs, remoteKnown, remoteMs) == WorkPane.IsEdited(localKnown, localMs, remoteKnown, remoteMs)
{
}

lemma HasLeftMatchesModel(onList: bool, hasProject: bool, linked: bool, mine: bool)
  ensures hasLeft(onList, hasProject, linked, mine) == WorkPane.HasLeft(onList, hasProject, linked, mine)
{
}

// ---------------------------------------------------------------- closed linked todos

lemma IsRecentlyClosedMatchesModel(now: int, closedAt: int)
  ensures isRecentlyClosed(now, closedAt) == WorkPane.IsRecentlyClosed(now, closedAt)
{
}

lemma SkipsClosedMatchesModel(known: bool, now: int, closedAt: int)
  ensures skipsClosed(known, now, closedAt) == WorkPane.SkipsClosed(known, now, closedAt)
{
}

// ---------------------------------------------------------------- timing

lemma IsDueMatchesModel(hasChecked: bool, lastChecked: int, now: int, minutes: int)
  ensures isDue(hasChecked, lastChecked, now, minutes) == WorkPane.IsDue(hasChecked, lastChecked, now, minutes)
{
}

lemma ShouldRetryMatchesModel(notLoaded: bool, retries: int)
  ensures shouldRetry(notLoaded, retries) == WorkPane.ShouldRetry(notLoaded, retries)
{
}

lemma NextRetriesMatchesModel(notLoaded: bool, retries: int)
  ensures nextRetries(notLoaded, retries) == WorkPane.NextRetries(notLoaded, retries)
{
}

// ---------------------------------------------------------------- pending changes

lemma PendingOfMatchesModel(checked: bool, neverSynced: bool, basecamp: int, github: int)
  ensures pendingOf(checked, neverSynced, basecamp, github) == Pending.not_checked <==> WorkPane.PendingOf(checked, neverSynced, basecamp, github) == WorkPane.NotChecked
  ensures pendingOf(checked, neverSynced, basecamp, github) == Pending.never_synced <==> WorkPane.PendingOf(checked, neverSynced, basecamp, github) == WorkPane.NeverSynced
  ensures pendingOf(checked, neverSynced, basecamp, github) == Pending.up_to_date <==> WorkPane.PendingOf(checked, neverSynced, basecamp, github) == WorkPane.UpToDate
  ensures pendingOf(checked, neverSynced, basecamp, github) == Pending.changed <==> WorkPane.PendingOf(checked, neverSynced, basecamp, github) == WorkPane.Changed
{
}

lemma HasChangesMatchesModel(checked: bool, neverSynced: bool, basecamp: int, github: int)
  ensures hasChanges(checked, neverSynced, basecamp, github) == WorkPane.HasChanges(checked, neverSynced, basecamp, github)
{
}

// ---------------------------------------------------------------- sync result

lemma OutcomeOfMatchesModel(ran: bool, locked: bool, failed: bool)
  ensures outcomeOf(ran, locked, failed) == Outcome.did_not_run <==> WorkPane.OutcomeOf(ran, locked, failed) == WorkPane.DidNotRun
  ensures outcomeOf(ran, locked, failed) == Outcome.locked <==> WorkPane.OutcomeOf(ran, locked, failed) == WorkPane.Locked
  ensures outcomeOf(ran, locked, failed) == Outcome.failed <==> WorkPane.OutcomeOf(ran, locked, failed) == WorkPane.Failed
  ensures outcomeOf(ran, locked, failed) == Outcome.synced <==> WorkPane.OutcomeOf(ran, locked, failed) == WorkPane.Synced
{
}

lemma NotesBriefProblemMatchesModel(synced: bool, hasProblem: bool)
  ensures notesBriefProblem(synced, hasProblem) == WorkPane.NotesBriefProblem(synced, hasProblem)
{
}

// ---------------------------------------------------------------- where the pane runs (GH33)

lemma StartsPaneMatchesModel(isWork: bool)
  ensures startsPane(isWork) == WorkPane.StartsPane(isWork)
{
}

lemma CommandStepMatchesModel(isWork: bool, args: string)
  ensures commandStep(isWork, args) == PaneStep.idle <==> WorkPane.CommandStep(isWork, args) == WorkPane.Idle
  ensures commandStep(isWork, args) == PaneStep.sync <==> WorkPane.CommandStep(isWork, args) == WorkPane.SyncStep
  ensures commandStep(isWork, args) == PaneStep.check <==> WorkPane.CommandStep(isWork, args) == WorkPane.CheckStep
  ensures commandStep(isWork, args) == PaneStep.pane <==> WorkPane.CommandStep(isWork, args) == WorkPane.OpenPane
  ensures commandStep(isWork, args) == PaneStep.help <==> WorkPane.CommandStep(isWork, args) == WorkPane.HelpStep
{
}

// ---------------------------------------------------------------- check log and stale (GH34)

lemma StartsAutoSyncMatchesModel(autoSync: bool, hasChanges: bool, syncing: bool)
  ensures startsAutoSync(autoSync, hasChanges, syncing) == WorkPane.StartsAutoSync(autoSync, hasChanges, syncing)
{
}

lemma ShowsStaleMatchesModel(checkOk: bool, statusStale: bool)
  ensures showsStale(checkOk, statusStale) == WorkPane.ShowsStale(checkOk, statusStale)
{
}

// ---------------------------------------------------------------- headless sync (GH35)

lemma WaitsForConnectorMatchesModel(notLoaded: bool, tries: int)
  ensures waitsForConnector(notLoaded, tries) == WorkPane.WaitsForConnector(notLoaded, tries)
{
}

lemma RecordsFullSyncMatchesModel(synced: bool, basecampRead: bool)
  ensures recordsFullSync(synced, basecampRead) == WorkPane.RecordsFullSync(synced, basecampRead)
{
}

// ---------------------------------------------------------------- the check and sync cycle

lemma CheckRunsMatchesModel(isTimer: bool, due: bool)
  ensures checkRuns(isTimer, due) == WorkPane.CheckRuns(isTimer, due)
{
}

lemma SyncBeginsMatchesModel(syncing: bool)
  ensures syncBegins(syncing) == WorkPane.SyncBegins(syncing)
{
}

// ---------------------------------------------------------------- the lists the pane builds
// The code's records, as the model's; each list is linked by induction on its loop's index.

function AsItem(x: PaneItem): WorkPane.Item { WorkPane.Item(x.status, x.source, x.kind, x.mine, x.watched) }
function AsItems(s: seq<PaneItem>): seq<WorkPane.Item> { seq(|s|, k requires 0 <= k < |s| => AsItem(s[k])) }
function AsTarget(t: PaneTarget): WorkPane.Target { WorkPane.Target(t.id, t.projectId, t.projectName, t.list) }
function AsTargets(s: seq<PaneTarget>): seq<WorkPane.Target> { seq(|s|, k requires 0 <= k < |s| => AsTarget(s[k])) }
function AsRemote(t: IndexTodo): WorkPane.RemoteTodo
{
  WorkPane.RemoteTodo(t.id, t.projectId, t.projectName, t.list, t.updatedKnown, t.updatedMs)
}
function AsRemotes(s: seq<IndexTodo>): seq<WorkPane.RemoteTodo> { seq(|s|, k requires 0 <= k < |s| => AsRemote(s[k])) }
function AsLocal(l: LocalTodo): WorkPane.LocalTodo
{
  WorkPane.LocalTodo(l.num, l.updatedKnown, l.updatedMs, l.hasProject, l.projectId, l.mine)
}
function AsLocals(s: seq<LocalTodo>): seq<WorkPane.LocalTodo> { seq(|s|, k requires 0 <= k < |s| => AsLocal(s[k])) }
function AsLinked(s: seq<LinkedTodo>): seq<WorkPane.LinkedTodo>
{
  seq(|s|, k requires 0 <= k < |s| => WorkPane.LinkedTodo(s[k].num, s[k].hasProject, s[k].projectId))
}
function AsFetched(s: seq<FetchedTodo>): seq<WorkPane.FetchedTodo>
{
  seq(|s|, k requires 0 <= k < |s| => WorkPane.FetchedTodo(s[k].hasId, s[k].id, s[k].completed))
}
function AsClosedOne(c: ClosedTodo): WorkPane.ClosedTodo { WorkPane.ClosedTodo(c.id, c.at) }
function AsClosed(s: seq<ClosedTodo>): seq<WorkPane.ClosedTodo> { seq(|s|, k requires 0 <= k < |s| => AsClosedOne(s[k])) }
function AsServers(s: seq<McpServer>): seq<WorkPane.Server>
{
  seq(|s|, k requires 0 <= k < |s| => WorkPane.Server(s[k].name, s[k].hasUrl, s[k].url))
}
function AsSync(r: PaneSync): WorkPane.SyncWords { WorkPane.SyncWords(r.at, r.ok, r.detail) }

lemma AsTargetsCons(t: PaneTarget, rest: seq<PaneTarget>)
  ensures AsTargets([t] + rest) == [AsTarget(t)] + AsTargets(rest)
{
}

lemma AsRemotesSplice(s: seq<IndexTodo>, k: nat, t: IndexTodo)
  requires k < |s|
  ensures AsRemotes(s[..k] + [t] + s[k + 1..]) == AsRemotes(s)[..k] + [AsRemote(t)] + AsRemotes(s)[k + 1..]
{
}

lemma AsRemotesAppend(s: seq<IndexTodo>, t: IndexTodo)
  ensures AsRemotes(s + [t]) == AsRemotes(s) + [AsRemote(t)]
{
}

lemma AsClosedCons(c: ClosedTodo, rest: seq<ClosedTodo>)
  ensures AsClosed([c] + rest) == [AsClosedOne(c)] + AsClosed(rest)
{
}

lemma NameStartBeforeMatchesModel(repo: string, i: nat)
  requires i <= |repo|
  ensures nameStartBefore(repo, i) == WorkPane.NameStart(repo, i)
{
  PaneRunStartMatchesModel(repo, 0, i);
  Text.RunStartExt(repo, 0, i);
}

lemma RepoNameMatchesModel(repo: string)
  ensures repoName(repo) == WorkPane.RepoName(repo)
{
  NameStartBeforeMatchesModel(repo, |repo|);
}

lemma WatchedFromMatchesModel(id: string, names: seq<string>, i: nat)
  requires i <= |names|
  ensures watchedFrom(id, names, i) == WorkPane.WatchedFrom(id, names, i)
{
  PaneListEndMatchesModel(names, i);
  forall n: string { IsIssueIdOfMatchesModel(id, "gh-" + n + "-"); }
  Text.ListEndExt(names, names, i);
}

lemma InWatchedNamesMatchesModel(id: string, names: seq<string>)
  ensures inWatchedNames(id, names) == WorkPane.WatchedFrom(id, names, 0)
{
  WatchedFromMatchesModel(id, names, 0);
}

lemma TallyFromMatchesModel(items: seq<PaneItem>, i: nat)
  ensures tallyFrom(items, i).basecamp == WorkPane.TallyFrom(AsItems(items), i).basecamp
  ensures tallyFrom(items, i).github == WorkPane.TallyFrom(AsItems(items), i).github
  decreases |items| - i
{
  if i < |items| {
    var it := items[i];
    var open := it.status == "open";
    IsTrackedTodoMatchesModel(open, it.source == "basecamp", it.kind == "todo", it.mine);
    IsTrackedIssueMatchesModel(open, it.source == "github", it.kind == "issue", it.watched);
    TallyFromMatchesModel(items, i + 1);
  }
}

lemma TallyMatchesModel(items: seq<PaneItem>)
  ensures tally(items).basecamp == WorkPane.TallyFrom(AsItems(items), 0).basecamp
  ensures tally(items).github == WorkPane.TallyFrom(AsItems(items), 0).github
{
  TallyFromMatchesModel(items, 0);
}

lemma UnreadReposFromMatchesModel(repos: seq<string>, read: seq<bool>, i: nat)
  requires |repos| == |read|
  ensures unreadReposFrom(repos, read, i) == WorkPane.UnreadFrom(repos, read, i)
  decreases |repos| - i
{
  if i < |repos| { UnreadReposFromMatchesModel(repos, read, i + 1); }
}

lemma FailedPartsMatchesModel(countFailed: bool, countProblem: string, indexFailed: bool, indexProblem: string,
                              repos: seq<string>, read: seq<bool>, changesRead: bool)
  requires |repos| == |read|
  ensures failedParts(countFailed, countProblem, indexFailed, indexProblem, repos, read, changesRead)
       == WorkPane.FailedParts(countFailed, countProblem, indexFailed, indexProblem, repos, read, changesRead)
{
  UnreadReposFromMatchesModel(repos, read, 0);
}

lemma TodoAtMatchesModel(todos: seq<IndexTodo>, id: int, i: nat)
  requires i <= |todos|
  ensures todoAt(todos, id, i) == WorkPane.TodoAt(AsRemotes(todos), id, i)
{
  PaneListEndMatchesModel(todos, i);
  Text.ListEndExt(todos, AsRemotes(todos), i);
}

lemma UniqueTodosFromMatchesModel(acc: seq<IndexTodo>, todos: seq<IndexTodo>, i: nat)
  ensures AsRemotes(uniqueTodosFrom(acc, todos, i)) == WorkPane.UniqueFrom(AsRemotes(acc), AsRemotes(todos), i)
  decreases |todos| - i
{
  if i < |todos| {
    var t := todos[i];
    TodoAtMatchesModel(acc, t.id, 0);
    var k := todoAt(acc, t.id, 0);
    if k < 0 {
      AsRemotesAppend(acc, t);
      UniqueTodosFromMatchesModel(acc + [t], todos, i + 1);
    } else {
      AsRemotesSplice(acc, k, t);
      assert acc[0..k] == acc[..k];
      UniqueTodosFromMatchesModel(acc[0..k] + [t] + acc[k + 1..], todos, i + 1);
    }
  }
}

lemma UniqueTodosMatchesModel(todos: seq<IndexTodo>)
  ensures AsRemotes(uniqueTodos(todos)) == WorkPane.UniqueFrom([], AsRemotes(todos), 0)
{
  UniqueTodosFromMatchesModel([], todos, 0);
}

lemma LocalAtMatchesModel(local: seq<LocalTodo>, num: int, i: nat)
  ensures localAt(local, num, i) == WorkPane.LocalAt(AsLocals(local), num, i)
  decreases |local| - i
{
  if i < |local| { LocalAtMatchesModel(local, num, i + 1); }
}

lemma EditedFromMatchesModel(remote: seq<IndexTodo>, local: seq<LocalTodo>, i: nat)
  ensures AsTargets(editedFrom(remote, local, i)) == WorkPane.EditedFrom(AsRemotes(remote), AsLocals(local), i)
  decreases |remote| - i
{
  if i < |remote| {
    var r := remote[i];
    LocalAtMatchesModel(local, r.id, 0);
    var k := localAt(local, r.id, 0);
    var beforeKnown := k >= 0 && local[k].updatedKnown;
    var beforeMs := if k >= 0 then local[k].updatedMs else 0;
    IsEditedMatchesModel(beforeKnown, beforeMs, r.updatedKnown, r.updatedMs);
    EditedFromMatchesModel(remote, local, i + 1);
    var head := if isEdited(beforeKnown, beforeMs, r.updatedKnown, r.updatedMs) then [PaneTarget(r.id, r.projectId, r.projectName, r.list)] else [];
    assert AsTargets(head + editedFrom(remote, local, i + 1)) == AsTargets(head) + AsTargets(editedFrom(remote, local, i + 1));
  }
}

lemma RemoteHasFromMatchesModel(remote: seq<IndexTodo>, id: int, i: nat)
  requires i <= |remote|
  ensures remoteHasFrom(remote, id, i) == WorkPane.RemoteHasFrom(AsRemotes(remote), id, i)
{
  PaneListEndMatchesModel(remote, i);
  Text.ListEndExt(remote, AsRemotes(remote), i);
}

lemma LeftFromMatchesModel(local: seq<LocalTodo>, remote: seq<IndexTodo>, linked: bool, i: nat)
  ensures AsTargets(leftFrom(local, remote, linked, i)) == WorkPane.LeftFrom(AsLocals(local), AsRemotes(remote), linked, i)
  decreases |local| - i
{
  if i < |local| {
    var l := local[i];
    RemoteHasFromMatchesModel(remote, l.num, 0);
    HasLeftMatchesModel(remoteHasFrom(remote, l.num, 0), l.hasProject, linked, l.mine);
    LeftFromMatchesModel(local, remote, linked, i + 1);
    var head := if hasLeft(remoteHasFrom(remote, l.num, 0), l.hasProject, linked, l.mine) then [PaneTarget(l.num, l.projectId, "", "")] else [];
    assert AsTargets(head + leftFrom(local, remote, linked, i + 1)) == AsTargets(head) + AsTargets(leftFrom(local, remote, linked, i + 1));
  }
}

lemma TodosToFetchMatchesModel(remote: seq<IndexTodo>, local: seq<LocalTodo>, linked: bool)
  ensures AsTargets(todosToFetch(remote, local, linked)) == WorkPane.TodosToFetch(AsRemotes(remote), AsLocals(local), linked)
{
  EditedFromMatchesModel(remote, local, 0);
  LeftFromMatchesModel(local, remote, linked, 0);
  assert AsTargets(editedFrom(remote, local, 0) + leftFrom(local, remote, linked, 0))
      == AsTargets(editedFrom(remote, local, 0)) + AsTargets(leftFrom(local, remote, linked, 0));
}

lemma LinkedFromMatchesModel(found: seq<LinkedTodo>, i: nat)
  ensures AsTargets(linkedFrom(found, i)) == WorkPane.LinkedFrom(AsLinked(found), i)
  decreases |found| - i
{
  if i < |found| {
    LinkedFromMatchesModel(found, i + 1);
    var head := if found[i].hasProject then [PaneTarget(found[i].num, found[i].projectId, "", "")] else [];
    assert AsTargets(head + linkedFrom(found, i + 1)) == AsTargets(head) + AsTargets(linkedFrom(found, i + 1));
  }
}

lemma LinkedTargetsMatchesModel(found: seq<LinkedTodo>)
  ensures AsTargets(linkedTargets(found)) == WorkPane.LinkedFrom(AsLinked(found), 0)
{
  LinkedFromMatchesModel(found, 0);
}

lemma CompletedFromMatchesModel(records: seq<FetchedTodo>, i: nat)
  ensures completedFrom(records, i) == WorkPane.CompletedFrom(AsFetched(records), i)
  decreases |records| - i
{
  if i < |records| { CompletedFromMatchesModel(records, i + 1); }
}

lemma CompletedIdsMatchesModel(records: seq<FetchedTodo>)
  ensures completedIds(records) == WorkPane.CompletedFrom(AsFetched(records), 0)
{
  CompletedFromMatchesModel(records, 0);
}

lemma ClosedAtMatchesModel(closed: seq<ClosedTodo>, id: int, i: nat)
  ensures closedAt(closed, id, i) == WorkPane.ClosedAt(AsClosed(closed), id, i)
  decreases |closed| - i
{
  if i < |closed| { ClosedAtMatchesModel(closed, id, i + 1); }
}

lemma NotClosedFromMatchesModel(targets: seq<PaneTarget>, closed: seq<ClosedTodo>, now: int, i: nat)
  ensures AsTargets(notClosedFrom(targets, closed, now, i)) == WorkPane.NotClosedFrom(AsTargets(targets), AsClosed(closed), now, i)
  decreases |targets| - i
{
  if i < |targets| {
    ClosedAtMatchesModel(closed, targets[i].id, 0);
    var k := closedAt(closed, targets[i].id, 0);
    SkipsClosedMatchesModel(k >= 0, now, if k >= 0 then closed[k].at else 0);
    NotClosedFromMatchesModel(targets, closed, now, i + 1);
    var head := if !skipsClosed(k >= 0, now, if k >= 0 then closed[k].at else 0) then [targets[i]] else [];
    assert AsTargets(head + notClosedFrom(targets, closed, now, i + 1)) == AsTargets(head) + AsTargets(notClosedFrom(targets, closed, now, i + 1));
  }
}

lemma SkipClosedMatchesModel(targets: seq<PaneTarget>, closed: seq<ClosedTodo>, now: int)
  ensures AsTargets(skipClosed(targets, closed, now)) == WorkPane.NotClosedFrom(AsTargets(targets), AsClosed(closed), now, 0)
{
  NotClosedFromMatchesModel(targets, closed, now, 0);
}

lemma IdFromMatchesModel(ids: seq<int>, id: int, i: nat)
  requires i <= |ids|
  ensures idFrom(ids, id, i) == WorkPane.IdFrom(ids, id, i)
{
  PaneListEndMatchesModel(ids, i);
  Text.ListEndExt(ids, ids, i);
}

lemma KeptFromMatchesModel(closed: seq<ClosedTodo>, ids: seq<int>, now: int, i: nat)
  ensures AsClosed(keptFrom(closed, ids, now, i)) == WorkPane.KeptFrom(AsClosed(closed), ids, now, i)
  decreases |closed| - i
{
  if i < |closed| {
    IsRecentlyClosedMatchesModel(now, closed[i].at);
    IdFromMatchesModel(ids, closed[i].id, 0);
    KeptFromMatchesModel(closed, ids, now, i + 1);
    var head := if isRecentlyClosed(now, closed[i].at) && !idFrom(ids, closed[i].id, 0) then [closed[i]] else [];
    assert AsClosed(head + keptFrom(closed, ids, now, i + 1)) == AsClosed(head) + AsClosed(keptFrom(closed, ids, now, i + 1));
  }
}

lemma ClosedNowFromMatchesModel(ids: seq<int>, now: int, i: nat)
  ensures AsClosed(closedNowFrom(ids, now, i)) == WorkPane.ClosedNowFrom(ids, now, i)
  decreases |ids| - i
{
  if i < |ids| {
    IdFromMatchesModel(ids, ids[i], i + 1);
    ClosedNowFromMatchesModel(ids, now, i + 1);
    var head := if !idFrom(ids, ids[i], i + 1) then [ClosedTodo(ids[i], now)] else [];
    assert AsClosed(head + closedNowFrom(ids, now, i + 1)) == AsClosed(head) + AsClosed(closedNowFrom(ids, now, i + 1));
  }
}

lemma RememberClosedMatchesModel(closed: seq<ClosedTodo>, ids: seq<int>, now: int)
  ensures AsClosed(rememberClosed(closed, ids, now)) == WorkPane.RememberClosed(AsClosed(closed), ids, now)
{
  KeptFromMatchesModel(closed, ids, now, 0);
  ClosedNowFromMatchesModel(ids, now, 0);
  assert AsClosed(keptFrom(closed, ids, now, 0) + closedNowFrom(ids, now, 0))
      == AsClosed(keptFrom(closed, ids, now, 0)) + AsClosed(closedNowFrom(ids, now, 0));
}

lemma ProjectIdsFromMatchesModel(acc: seq<int>, ids: seq<int>, i: nat)
  ensures projectIdsFrom(acc, ids, i) == WorkPane.ProjectIdsFrom(acc, ids, i)
  decreases |ids| - i
{
  if i < |ids| {
    IsProjectIdMatchesModel(ids[i]);
    IdFromMatchesModel(acc, ids[i], 0);
    var next := if isProjectId(ids[i]) && !idFrom(acc, ids[i], 0) then acc + [ids[i]] else acc;
    ProjectIdsFromMatchesModel(next, ids, i + 1);
  }
}

lemma BriefProjectIdsMatchesModel(ids: seq<int>)
  ensures briefProjectIds(ids) == WorkPane.ProjectIdsFrom([], ids, 0)
{
  ProjectIdsFromMatchesModel([], ids, 0);
}

lemma OnConnectorUrlFromMatchesModel(servers: seq<McpServer>, i: nat)
  ensures onConnectorUrlFrom(servers, i) == WorkPane.OnConnectorUrlFrom(AsServers(servers), i)
  decreases |servers| - i
{
  if i < |servers| {
    IsBasecampUrlMatchesModel(servers[i].url);
    OnConnectorUrlFromMatchesModel(servers, i + 1);
  }
}

lemma DuplicateNamesMatchesModel(servers: seq<McpServer>)
  ensures duplicateNames(servers) == WorkPane.OnConnectorUrlFrom(AsServers(servers), 0)
{
  OnConnectorUrlFromMatchesModel(servers, 0);
}

lemma SyncResultOfMatchesModel(ran: bool, locked: bool, failed: bool, step: string, why: string, at: int)
  ensures AsSync(syncResultOf(ran, locked, failed, step, why, at)) == WorkPane.SyncResultOf(ran, locked, failed, step, why, at)
{
  OutcomeOfMatchesModel(ran, locked, failed);
}

lemma WithBasecampSkippedMatchesModel(r: PaneSync, skipped: bool, problem: string)
  ensures AsSync(withBasecampSkipped(r, skipped, problem)) == WorkPane.WithBasecampSkipped(AsSync(r), skipped, problem)
{
  RecordsFullSyncMatchesModel(r.ok, !skipped);
}

lemma WithBriefProblemMatchesModel(r: PaneSync, hasProblem: bool, problem: string)
  ensures AsSync(withBriefProblem(r, hasProblem, problem)) == WorkPane.WithBriefProblem(AsSync(r), hasProblem, problem)
{
  NotesBriefProblemMatchesModel(r.ok, hasProblem);
}

// ---------------------------------------------------------------- the cycle's step rules (review fixes)

lemma CheckSucceededMatchesModel(failedParts: int)
  ensures checkSucceeded(failedParts) == WorkPane.CheckSucceeded(failedParts)
{
}

lemma RunsLinkedPassMatchesModel(refreshOk: bool, basecampRead: bool, hasLinked: bool)
  ensures runsLinkedPass(refreshOk, basecampRead, hasLinked) == WorkPane.RunsLinkedPass(refreshOk, basecampRead, hasLinked)
{
}

lemma CommandChecksMatchesModel(openingRan: bool, openingNotLoaded: bool)
  ensures commandChecks(openingRan, openingNotLoaded) == WorkPane.CommandChecks(openingRan, openingNotLoaded)
{
}

lemma LogsCheckMatchesModel(isRetry: bool, ok: bool, retriesLeft: bool)
  ensures logsCheck(isRetry, ok, retriesLeft) == WorkPane.LogsCheck(isRetry, ok, retriesLeft)
{
}

lemma StaleShownMatchesModel(statusRead: bool, checkOk: bool, statusStale: bool, localStale: bool)
  ensures staleShown(statusRead, checkOk, statusStale, localStale) == WorkPane.StaleShown(statusRead, checkOk, statusStale, localStale)
{
  ShowsStaleMatchesModel(checkOk, statusStale);
}

lemma NextFilterMatchesModel(current: string, clicked: string)
  ensures nextFilter(current, clicked) == WorkPane.NextFilter(current, clicked)
{
}

lemma KeyFromMatchesModel(keys: seq<string>, key: string, i: nat)
  requires i <= |keys|
  ensures keyFrom(keys, key, i) == WorkPane.KeyFrom(keys, key, i)
{
  PaneListEndMatchesModel(keys, i);
  Text.ListEndExt(keys, keys, i);
}

lemma ShowsGroupMatchesModel(filter: string, key: string, keys: seq<string>)
  ensures showsGroup(filter, key, keys) == WorkPane.ShowsGroup(filter, key, keys)
{
  KeyFromMatchesModel(keys, filter, 0);
}

lemma FilterKeysMatchesModel(hasBasecamp: bool, basecampKey: string, repos: seq<string>)
  ensures filterKeys(hasBasecamp, basecampKey, repos) == WorkPane.FilterKeys(hasBasecamp, basecampKey, repos)
{
}

lemma IsWebUrlMatchesModel(url: string)
  ensures isWebUrl(url) == WorkPane.IsWebUrl(url)
{
  assert WEB_SCHEME == WorkPane.WebScheme;
}

lemma OpenerOfMatchesModel(sysname: string)
  ensures openerOf(sysname) == WorkPane.OpenerOf(sysname)
{
}

lemma IsStripedMatchesModel(index: nat)
  ensures isStriped(index) == WorkPane.IsStriped(index)
{
}
