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

lemma IsIssueIdOfMatchesModel(id: string, prefix: string)
  ensures isIssueIdOf(id, prefix) == WorkPane.IsIssueIdOf(id, prefix)
{
}

lemma HasOwnerMatchesModel(repo: string)
  ensures hasOwner(repo) == WorkPane.HasOwner(repo)
{
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
