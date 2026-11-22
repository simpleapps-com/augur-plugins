// Links plugins/simpleapps-work-pane/scripts/work-rules.ts (its proved .dfy) to the model,
// models/WorkData.dfy: every exported rule decides exactly what the model says. The code's records
// are mapped to the model's (`As...`); the code reads by index where the model reads slices.
include "../../plugins/simpleapps-work-pane/scripts/work-rules.dfy"
include "../WorkData.dfy"

// ---------------------------------------------------------------- the code's records, as the model's

function AsParts(p: GithubParts): WorkData.GithubParts { WorkData.GithubParts(p.ok, p.owner, p.repo, p.digits) }

function AsHit(h: Hit): WorkData.Hit
{
  WorkData.Hit(h.ok, if h.end < 0 then 0 else h.end, h.owner, h.repo, h.num, h.project, h.isMessage)
}

function AsRef(r: Ref): WorkData.Ref { WorkData.Ref(r.id, r.closes, r.project) }

function AsRefs(rs: seq<Ref>): seq<WorkData.Ref>
{
  seq(|rs|, k requires 0 <= k < |rs| => AsRef(rs[k]))
}

function AsCtx(c: RefContext): WorkData.RefContext { WorkData.RefContext(c.hasRepo, c.owner, c.repo, c.org) }

function AsHead(h: Head): WorkData.Head
{
  WorkData.Head(h.ok, if h.end < 0 then 0 else h.end, h.author, h.at)
}

function AsSegments(ss: seq<Segment>): seq<WorkData.Segment>
{
  seq(|ss|, k requires 0 <= k < |ss| => WorkData.Segment(ss[k].author, ss[k].at, ss[k].text))
}

lemma AsRefsSplice(rs: seq<Ref>, k: nat, r: Ref)
  requires k < |rs|
  ensures AsRefs(rs[..k] + [r] + rs[k + 1..]) == AsRefs(rs)[..k] + [AsRef(r)] + AsRefs(rs)[k + 1..]
{
}

lemma AsRefsAppend(rs: seq<Ref>, r: Ref)
  ensures AsRefs(rs + [r]) == AsRefs(rs) + [AsRef(r)]
{
}

lemma AsSegmentsCons(s: Segment, ss: seq<Segment>)
  ensures AsSegments([s] + ss) == [WorkData.Segment(s.author, s.at, s.text)] + AsSegments(ss)
{
}

// ---------------------------------------------------------------- characters and runs

lemma RepoRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures repoRunEnd(s, i) == WorkData.RepoRunEnd(s, i)
  decreases |s| - i
{
  if i < |s| { RepoRunEndMatchesModel(s, i + 1); }
}

lemma DigitRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures digitRunEnd(s, i) == WorkData.DigitRunEnd(s, i)
  decreases |s| - i
{
  if i < |s| { DigitRunEndMatchesModel(s, i + 1); }
}

lemma SpaceRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures spaceRunEnd(s, i) == WorkData.SpaceRunEnd(s, i)
  decreases |s| - i
{
  if i < |s| { SpaceRunEndMatchesModel(s, i + 1); }
}

lemma SolidRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures solidRunEnd(s, i) == WorkData.SolidRunEnd(s, i)
  decreases |s| - i
{
  if i < |s| { SolidRunEndMatchesModel(s, i + 1); }
}

lemma AllDigitsFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures allDigitsFrom(s, i) == WorkData.AllDigits(s[i..])
  decreases |s| - i
{
  if i < |s| { AllDigitsFromMatchesModel(s, i + 1); assert s[i..] == [s[i]] + s[i + 1..]; }
}

lemma NoLineEndFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures noLineEndFrom(s, i) == WorkData.NoLineEnd(s[i..])
  decreases |s| - i
{
  if i < |s| { NoLineEndFromMatchesModel(s, i + 1); assert s[i..] == [s[i]] + s[i + 1..]; }
}

lemma LowerFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures lowerFrom(s, i) == WorkData.Lower(s[i..])
  decreases |s| - i
{
  if i < |s| {
    LowerFromMatchesModel(s, i + 1);
    assert s[i..][1..] == s[i + 1..];
    assert s[i..i + 1] == [s[i]];
    var c := s[i] as int;
    if 65 <= c <= 90 { assert StringFromCharCode(c + 32) == [WorkData.LowerChar(s[i])]; }
  }
}

lemma LowerMatchesModel(s: string)
  ensures lower(s) == WorkData.Lower(s)
{
  LowerFromMatchesModel(s, 0);
  assert s[0..] == s;
}

// ---------------------------------------------------------------- item ids

lemma GithubIdMatchesModel(owner: string, repo: string, num: string, org: string)
  ensures githubId(owner, repo, num, org) == WorkData.GithubId(owner, repo, num, org)
{
  LowerMatchesModel(owner);
  LowerMatchesModel(org);
  LowerMatchesModel(repo);
  LowerMatchesModel(owner + "." + repo);
}

lemma BasecampIdMatchesModel(isMessage: bool, num: string)
  ensures basecampId(isMessage, num) == WorkData.BasecampId(isMessage, num)
{
}

lemma NumberedIdMatchesModel(owner: string, repo: string, num: string, org: string)
  ensures numberedId(owner, repo, num, org) == WorkData.NumberedId(owner, repo, num, org)
{
  GithubIdMatchesModel(owner, repo, num, org);
}

lemma LastHyphenMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures lastHyphenBefore(s, i) == WorkData.LastHyphen(s, i)
  decreases i
{
  if i > 0 { LastHyphenMatchesModel(s, i - 1); }
}

lemma FirstDotMatchesModel(s: string, i: nat)
  ensures firstDotFrom(s, i) == WorkData.FirstDot(s, i)
  decreases |s| - i
{
  if i < |s| { FirstDotMatchesModel(s, i + 1); }
}

lemma ParseGithubIdMatchesModel(id: string, org: string)
  ensures AsParts(parseGithubId(id, org)) == WorkData.ParseGithubId(id, org)
{
  if !hasAt(id, 0, "gh-") { return; }
  LastHyphenMatchesModel(id, |id|);
  var k := lastHyphenBefore(id, |id|);
  if k <= 3 { return; }
  var digits := id[k + 1..|id|];
  var name := id[3..k];
  assert id[k + 1..] == digits;
  AllDigitsFromMatchesModel(digits, 0);
  assert digits[0..] == digits;
  NoLineEndFromMatchesModel(name, 0);
  assert name[0..] == name;
  FirstDotMatchesModel(name, 0);
}

lemma TodoLabelMatchesModel(id: string)
  ensures todoLabel(id) == WorkData.TodoLabel(id)
{
}

// ---------------------------------------------------------------- "closes"

lemma SpaceStartMatchesModel(s: string, lo: nat, e: nat)
  requires lo <= e <= |s|
  ensures spaceStartBack(s, lo, e) == WorkData.SpaceStart(s, lo, e)
  decreases e - lo
{
  if e > lo { SpaceStartMatchesModel(s, lo, e - 1); }
}

lemma KeywordEndsAtMatchesModel(s: string, lo: nat, e: nat, k: string)
  requires lo <= e <= |s|
  ensures keywordEndsAt(s, lo, e, k) == WorkData.KeywordEndsAt(s, lo, e, k)
{
  if |k| <= e - lo { LowerMatchesModel(s[e - |k|..e]); }
}

// The model's "some keyword ends at e" is the code's nine-way disjunction.
predicate AnyKeyword(s: string, lo: nat, e: nat)
  requires lo <= e <= |s|
{
  WorkData.KeywordEndsAt(s, lo, e, "close") || WorkData.KeywordEndsAt(s, lo, e, "closes") ||
  WorkData.KeywordEndsAt(s, lo, e, "closed") || WorkData.KeywordEndsAt(s, lo, e, "fix") ||
  WorkData.KeywordEndsAt(s, lo, e, "fixes") || WorkData.KeywordEndsAt(s, lo, e, "fixed") ||
  WorkData.KeywordEndsAt(s, lo, e, "resolve") || WorkData.KeywordEndsAt(s, lo, e, "resolves") ||
  WorkData.KeywordEndsAt(s, lo, e, "resolved")
}

lemma KeywordsUnfold(s: string, lo: nat, e: nat)
  requires lo <= e <= |s|
  ensures (exists i :: 0 <= i < |WorkData.Keywords| && WorkData.KeywordEndsAt(s, lo, e, WorkData.Keywords[i])) <==> AnyKeyword(s, lo, e)
{
  var ks := WorkData.Keywords;
  assert ks[0] == "close" && ks[1] == "closes" && ks[2] == "closed";
  assert ks[3] == "fix" && ks[4] == "fixes" && ks[5] == "fixed";
  assert ks[6] == "resolve" && ks[7] == "resolves" && ks[8] == "resolved" && |ks| == 9;
  if exists i :: 0 <= i < |ks| && WorkData.KeywordEndsAt(s, lo, e, ks[i]) {
    var i :| 0 <= i < |ks| && WorkData.KeywordEndsAt(s, lo, e, ks[i]);
    assert i == 0 || i == 1 || i == 2 || i == 3 || i == 4 || i == 5 || i == 6 || i == 7 || i == 8;
  }
  if AnyKeyword(s, lo, e) {
    if WorkData.KeywordEndsAt(s, lo, e, "close") { assert WorkData.KeywordEndsAt(s, lo, e, ks[0]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "closes") { assert WorkData.KeywordEndsAt(s, lo, e, ks[1]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "closed") { assert WorkData.KeywordEndsAt(s, lo, e, ks[2]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "fix") { assert WorkData.KeywordEndsAt(s, lo, e, ks[3]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "fixes") { assert WorkData.KeywordEndsAt(s, lo, e, ks[4]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "fixed") { assert WorkData.KeywordEndsAt(s, lo, e, ks[5]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "resolve") { assert WorkData.KeywordEndsAt(s, lo, e, ks[6]); }
    else if WorkData.KeywordEndsAt(s, lo, e, "resolves") { assert WorkData.KeywordEndsAt(s, lo, e, ks[7]); }
    else { assert WorkData.KeywordEndsAt(s, lo, e, ks[8]); }
  }
}

lemma {:vcs_split_on_every_assert} ClosesBeforeMatchesModel(s: string, start: nat)
  requires start <= |s|
  ensures closesBefore(s, start) == WorkData.ClosesBefore(s, start)
{
  var lo := if start >= 24 then start - 24 else 0;
  SpaceStartMatchesModel(s, lo, start);
  var e1 := spaceStartBack(s, lo, start);
  if e1 > lo { SpaceStartMatchesModel(s, lo, e1 - 1); }
  var e := if e1 > lo && s[e1 - 1] == ':' then spaceStartBack(s, lo, e1 - 1) else e1;
  var m1 := WorkData.SpaceStart(s, lo, start);
  var m := if m1 > lo && s[m1 - 1] == ':' then WorkData.SpaceStart(s, lo, m1 - 1) else m1;
  assert m1 == e1 && m == e;
  assert WorkData.ClosesBefore(s, start) <==>
    exists i :: 0 <= i < |WorkData.Keywords| && WorkData.KeywordEndsAt(s, lo, e, WorkData.Keywords[i]);
  KeywordEndsAtMatchesModel(s, lo, e, "close");
  KeywordEndsAtMatchesModel(s, lo, e, "closes");
  KeywordEndsAtMatchesModel(s, lo, e, "closed");
  KeywordEndsAtMatchesModel(s, lo, e, "fix");
  KeywordEndsAtMatchesModel(s, lo, e, "fixes");
  KeywordEndsAtMatchesModel(s, lo, e, "fixed");
  KeywordEndsAtMatchesModel(s, lo, e, "resolve");
  KeywordEndsAtMatchesModel(s, lo, e, "resolves");
  KeywordEndsAtMatchesModel(s, lo, e, "resolved");
  KeywordsUnfold(s, lo, e);
  var code :=
    keywordEndsAt(s, lo, e, "close") || keywordEndsAt(s, lo, e, "closes") ||
    keywordEndsAt(s, lo, e, "closed") || keywordEndsAt(s, lo, e, "fix") ||
    keywordEndsAt(s, lo, e, "fixes") || keywordEndsAt(s, lo, e, "fixed") ||
    keywordEndsAt(s, lo, e, "resolve") || keywordEndsAt(s, lo, e, "resolves") ||
    keywordEndsAt(s, lo, e, "resolved");
  assert closesBefore(s, start) == code;
  assert code == AnyKeyword(s, lo, e);
}

// ---------------------------------------------------------------- the five reference forms

lemma AfterSchemeMatchesModel(s: string, i: nat)
  ensures afterScheme(s, i) == WorkData.AfterScheme(s, i)
{
}

lemma GithubUrlAtMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures AsHit(githubUrlAt(s, i)) == WorkData.GithubUrlAt(s, i)
{
  var j := afterScheme(s, i);
  if j >= 0 && hasAt(s, j, "github.com/") {
    var a := j + 11;
    RepoRunEndMatchesModel(s, a);
    var o := repoRunEnd(s, a);
    if o != a && hasAt(s, o, "/") {
      RepoRunEndMatchesModel(s, o + 1);
      var r := repoRunEnd(s, o + 1);
      if r != o + 1 && hasAt(s, r, "/") {
        var k := afterIssuePath(s, r + 1);
        if k >= 0 { DigitRunEndMatchesModel(s, k); }
      }
    }
  }
}

lemma BasecampUrlAtMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures AsHit(basecampUrlAt(s, i)) == WorkData.BasecampUrlAt(s, i)
{
  var j := afterScheme(s, i);
  if j >= 0 {
    var b := if hasAt(s, j, "3.") then j + 2 else j;
    if hasAt(s, b, "basecamp.com/") {
      var a := b + 13;
      DigitRunEndMatchesModel(s, a);
      var d1 := digitRunEnd(s, a);
      if d1 != a && hasAt(s, d1, "/projects/") {
        var p := d1 + 10;
        DigitRunEndMatchesModel(s, p);
        var d2 := digitRunEnd(s, p);
        if d2 != p && hasAt(s, d2, "/") {
          var n := afterRecordPath(s, d2 + 1);
          if n >= 0 { DigitRunEndMatchesModel(s, n); }
        }
      }
    }
  }
}

lemma IssueRefAtMatchesModel(s: string, q: nat)
  requires q <= |s|
  ensures AsHit(issueRefAt(s, q)) == WorkData.IssueRefAt(s, q)
{
  RepoRunEndMatchesModel(s, q);
  var r1 := repoRunEnd(s, q);
  if r1 != q && hasAt(s, r1, "/") { RepoRunEndMatchesModel(s, r1 + 1); }
  var hasOwner := hasAt(s, r1, "/");
  var re := if hasOwner then repoRunEnd(s, r1 + 1) else r1;
  if re + 1 <= |s| { DigitRunEndMatchesModel(s, re + 1); }
}

lemma BareRefAtMatchesModel(s: string, q: nat)
  requires q <= |s|
  ensures AsHit(bareRefAt(s, q)) == WorkData.BareRefAt(s, q)
{
  if q + 1 <= |s| { DigitRunEndMatchesModel(s, q + 1); }
}

lemma BcRefAtMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures AsHit(bcRefAt(s, i)) == WorkData.BcRefAt(s, i)
{
  if i + 2 <= |s| { DigitRunEndMatchesModel(s, i + 2); }
}

// ---------------------------------------------------------------- references in a text

lemma RefContextMatchesModel(isGithub: bool, ref: string, org: string)
  ensures AsCtx(refContext(isGithub, ref, org)) == WorkData.ContextOf(isGithub, ref, org)
{
  RepoRunEndMatchesModel(ref, 0);
  var o := repoRunEnd(ref, 0);
  if o != 0 && hasAt(ref, o, "/") {
    RepoRunEndMatchesModel(ref, o + 1);
    var r := repoRunEnd(ref, o + 1);
    if r != o + 1 && hasAt(ref, r, "#") { DigitRunEndMatchesModel(ref, r + 1); }
  }
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

lemma ScanGithubUrlsMatchesModel(s: string, i: nat, ctx: RefContext, refs: seq<Ref>)
  requires i <= |s|
  ensures AsRefs(scanGithubUrls(s, i, ctx, refs)) == WorkData.ScanGithubUrls(s, i, AsCtx(ctx), AsRefs(refs))
  decreases |s| - i
{
  if i < |s| {
    GithubUrlAtMatchesModel(s, i);
    var h := githubUrlAt(s, i);
    if !h.ok { ScanGithubUrlsMatchesModel(s, i + 1, ctx, refs); }
    else {
      GithubIdMatchesModel(h.owner, h.repo, h.num, ctx.org);
      ClosesBeforeMatchesModel(s, i);
      var id := githubId(h.owner, h.repo, h.num, ctx.org);
      AddRefMatchesModel(refs, id, closesBefore(s, i), "");
      ScanGithubUrlsMatchesModel(s, h.end, ctx, addRef(refs, id, closesBefore(s, i), ""));
    }
  }
}

lemma IssueRefIdMatchesModel(h: Hit, ctx: RefContext)
  ensures issueRefId(h, ctx) == WorkData.IssueRefId(AsHit(h), AsCtx(ctx))
{
  LowerMatchesModel(h.repo);
  NumberedIdMatchesModel(ctx.owner, ctx.repo, h.num, ctx.org);
  NumberedIdMatchesModel(if h.owner == "" then ctx.org else h.owner, h.repo, h.num, ctx.org);
}

lemma ScanIssueRefsMatchesModel(s: string, i: nat, ctx: RefContext, refs: seq<Ref>)
  requires i <= |s|
  ensures AsRefs(scanIssueRefs(s, i, ctx, refs)) == WorkData.ScanIssueRefs(s, i, AsCtx(ctx), AsRefs(refs))
  decreases |s| - i
{
  if i < |s| {
    IssueRefAtMatchesModel(s, i);
    var h := issueRefAt(s, i);
    if !h.ok { ScanIssueRefsMatchesModel(s, i + 1, ctx, refs); }
    else {
      IssueRefIdMatchesModel(h, ctx);
      ClosesBeforeMatchesModel(s, i);
      var id := issueRefId(h, ctx);
      if id != "" { AddRefMatchesModel(refs, id, closesBefore(s, i), ""); }
      ScanIssueRefsMatchesModel(s, h.end, ctx, if id == "" then refs else addRef(refs, id, closesBefore(s, i), ""));
    }
  }
}

lemma KnownIssueIdMatchesModel(refs: seq<Ref>, num: string, i: nat)
  ensures knownIssueId(refs, num, i) == WorkData.KnownIssueId(AsRefs(refs), num, i)
  decreases |refs| - i
{
  if i < |refs| { KnownIssueIdMatchesModel(refs, num, i + 1); }
}

lemma BareRefIdMatchesModel(refs: seq<Ref>, num: string, ctx: RefContext)
  ensures bareRefId(refs, num, ctx) == WorkData.BareRefId(AsRefs(refs), num, AsCtx(ctx))
{
  KnownIssueIdMatchesModel(refs, num, 0);
  NumberedIdMatchesModel(ctx.owner, ctx.repo, num, ctx.org);
}

lemma ScanBareRefsMatchesModel(s: string, i: nat, ctx: RefContext, refs: seq<Ref>)
  requires i <= |s|
  ensures AsRefs(scanBareRefs(s, i, ctx, refs)) == WorkData.ScanBareRefs(s, i, AsCtx(ctx), AsRefs(refs))
  decreases |s| - i
{
  if i < |s| {
    BareRefAtMatchesModel(s, i);
    var h := bareRefAt(s, i);
    if !h.ok { ScanBareRefsMatchesModel(s, i + 1, ctx, refs); }
    else {
      BareRefIdMatchesModel(refs, h.num, ctx);
      ClosesBeforeMatchesModel(s, i);
      var id := bareRefId(refs, h.num, ctx);
      if id != "" { AddRefMatchesModel(refs, id, closesBefore(s, i), ""); }
      ScanBareRefsMatchesModel(s, h.end, ctx, if id == "" then refs else addRef(refs, id, closesBefore(s, i), ""));
    }
  }
}

lemma ScanBasecampUrlsMatchesModel(s: string, i: nat, refs: seq<Ref>)
  requires i <= |s|
  ensures AsRefs(scanBasecampUrls(s, i, refs)) == WorkData.ScanBasecampUrls(s, i, AsRefs(refs))
  decreases |s| - i
{
  if i < |s| {
    BasecampUrlAtMatchesModel(s, i);
    var h := basecampUrlAt(s, i);
    if !h.ok { ScanBasecampUrlsMatchesModel(s, i + 1, refs); }
    else {
      ClosesBeforeMatchesModel(s, i);
      var id := basecampId(h.isMessage, h.num);
      AddRefMatchesModel(refs, id, closesBefore(s, i), h.project);
      ScanBasecampUrlsMatchesModel(s, h.end, addRef(refs, id, closesBefore(s, i), h.project));
    }
  }
}

lemma ScanBcRefsMatchesModel(s: string, i: nat, refs: seq<Ref>)
  requires i <= |s|
  ensures AsRefs(scanBcRefs(s, i, refs)) == WorkData.ScanBcRefs(s, i, AsRefs(refs))
  decreases |s| - i
{
  if i < |s| {
    BcRefAtMatchesModel(s, i);
    var h := bcRefAt(s, i);
    if !h.ok { ScanBcRefsMatchesModel(s, i + 1, refs); }
    else {
      ClosesBeforeMatchesModel(s, i);
      var id := basecampId(false, h.num);
      AddRefMatchesModel(refs, id, closesBefore(s, i), "");
      ScanBcRefsMatchesModel(s, h.end, addRef(refs, id, closesBefore(s, i), ""));
    }
  }
}

lemma ExtractRefsMatchesModel(s: string, ctx: RefContext)
  ensures AsRefs(extractRefs(s, ctx)) == WorkData.ExtractRefs(s, AsCtx(ctx))
{
  assert AsRefs([]) == [];
  ScanGithubUrlsMatchesModel(s, 0, ctx, []);
  var a := scanGithubUrls(s, 0, ctx, []);
  ScanIssueRefsMatchesModel(s, 0, ctx, a);
  var b := scanIssueRefs(s, 0, ctx, a);
  ScanBareRefsMatchesModel(s, 0, ctx, b);
  var c := scanBareRefs(s, 0, ctx, b);
  ScanBasecampUrlsMatchesModel(s, 0, c);
  ScanBcRefsMatchesModel(s, 0, scanBasecampUrls(s, 0, c));
}

// ---------------------------------------------------------------- comment headings

lemma LastLineEndMatchesModel(s: string, lo: nat, hi: nat)
  requires lo <= hi <= |s|
  ensures lastLineEndIn(s, lo, hi) == WorkData.LastLineEnd(s, lo, hi)
  decreases hi
{
  if hi > lo { LastLineEndMatchesModel(s, lo, hi - 1); }
}

lemma HeadTailEndMatchesModel(s: string, t: nat)
  requires t <= |s|
  ensures headTailEnd(s, t) == WorkData.HeadTailEnd(s, t)
{
  SolidRunEndMatchesModel(s, t);
  var e := solidRunEnd(s, t);
  SpaceRunEndMatchesModel(s, e);
  LastLineEndMatchesModel(s, e, spaceRunEnd(s, e));
}

lemma HeadFromMatchesModel(s: string, a: nat, m: nat)
  requires a < m <= |s|
  ensures AsHead(headFrom(s, a, m)) == WorkData.HeadFrom(s, a, m)
  decreases |s| - m
{
  if m + 3 <= |s| {
    HeadTailEndMatchesModel(s, m + 3);
    SolidRunEndMatchesModel(s, m + 3);
  }
  if m < |s| { HeadFromMatchesModel(s, a, m + 1); }
}

lemma HeadAtMatchesModel(s: string, p: nat)
  requires p <= |s|
  ensures AsHead(headAt(s, p)) == WorkData.HeadAt(s, p)
{
  if p + 5 <= |s| { HeadFromMatchesModel(s, p + 4, p + 5); }
}

lemma NextHeadMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures nextHead(s, i) == WorkData.NextHead(s, i)
  decreases |s| - i
{
  if i < |s| { HeadAtMatchesModel(s, i); NextHeadMatchesModel(s, i + 1); }
}

lemma CommentsFromMatchesModel(s: string, p: nat)
  requires p <= |s|
  requires p == |s| || headAt(s, p).ok
  ensures AsSegments(commentsFrom(s, p)) == WorkData.CommentsFrom(s, p)
  decreases |s| - p
{
  if p < |s| {
    HeadAtMatchesModel(s, p);
    var h := headAt(s, p);
    NextHeadMatchesModel(s, h.end);
    var q := nextHead(s, h.end);
    CommentsFromMatchesModel(s, q);
    AsSegmentsCons(Segment(h.author, h.at, s[h.end..q]), commentsFrom(s, q));
  }
}

lemma SplitSegmentsMatchesModel(body: string, author: string, at: string)
  ensures AsSegments(splitSegments(body, author, at)) == WorkData.SplitSegments(body, author, at)
{
  NextHeadMatchesModel(body, 0);
  var first := nextHead(body, 0);
  CommentsFromMatchesModel(body, first);
  AsSegmentsCons(Segment(author, at, body[0..first]), commentsFrom(body, first));
}

// ---------------------------------------------------------------- frontmatter

function AsValue(v: YamlValue): WorkData.YamlValue { WorkData.YamlValue(v.isList, v.scalar, v.items) }

function AsKind(k: LineKind): WorkData.LineKind
{
  match k
  case blank => WorkData.Blank
  case item => WorkData.Item
  case pair => WorkData.Pair
  case bad => WorkData.Bad
}

function AsLine(l: YamlLine): WorkData.YamlLine { WorkData.YamlLine(AsKind(l.kind), l.key, l.rest) }

function AsEntries(es: seq<YamlEntry>): seq<WorkData.YamlEntry>
{
  seq(|es|, k requires 0 <= k < |es| => WorkData.YamlEntry(es[k].key, AsValue(es[k].value)))
}

function AsProblems(ps: seq<YamlProblem>): seq<WorkData.YamlProblem>
{
  seq(|ps|, k requires 0 <= k < |ps| => WorkData.YamlProblem(if ps[k].line < 0 then 0 else ps[k].line, ps[k].kind, ps[k].text))
}

function AsYaml(y: Yaml): WorkData.Yaml { WorkData.Yaml(AsEntries(y.entries), AsProblems(y.problems)) }

lemma TrimStartMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures trimStartAt(s, i) == WorkData.TrimStart(s, i)
  decreases |s| - i
{
  if i < |s| { TrimStartMatchesModel(s, i + 1); }
}

lemma TrimEndMatchesModel(s: string, lo: nat, e: nat)
  requires lo <= e <= |s|
  ensures trimEndAt(s, lo, e) == WorkData.TrimEnd(s, lo, e)
  decreases e - lo
{
  if e > lo { TrimEndMatchesModel(s, lo, e - 1); }
}

lemma TrimMatchesModel(s: string)
  ensures trimText(s) == WorkData.Trim(s)
{
  TrimStartMatchesModel(s, 0);
  TrimEndMatchesModel(s, trimStartAt(s, 0), |s|);
}

lemma HasMarkFromMatchesModel(s: string, i: nat)
  ensures hasMarkFrom(s, i) <==> exists k :: i <= k < |s| && WorkData.Mark(s[k] as int)
  decreases |s| - i
{
  if i < |s| { HasMarkFromMatchesModel(s, i + 1); }
}

lemma HasDoubleQuoteFromMatchesModel(s: string, i: nat)
  ensures hasDoubleQuoteFrom(s, i) <==> exists k :: i <= k < |s| && s[k] == '"'
  decreases |s| - i
{
  if i < |s| { HasDoubleQuoteFromMatchesModel(s, i + 1); }
}

lemma FormatScalarMatchesModel(text: string)
  ensures formatScalar(text) == WorkData.FormatScalar(text)
{
  HasMarkFromMatchesModel(text, 0);
  HasDoubleQuoteFromMatchesModel(text, 0);
}

lemma FormatItemsMatchesModel(items: seq<string>, i: nat)
  ensures formatItemsFrom(items, i) == WorkData.FormatItems(items, i)
  decreases |items| - i
{
  if i < |items| {
    FormatScalarMatchesModel(items[i]);
    FormatItemsMatchesModel(items, i + 1);
  }
}

lemma FormatListMatchesModel(items: seq<string>)
  ensures formatList(items) == WorkData.FormatList(items)
{
  FormatItemsMatchesModel(items, 0);
}

lemma ParseScalarMatchesModel(raw: string)
  ensures parseScalar(raw) == WorkData.ParseScalar(raw)
{
  TrimMatchesModel(raw);
  var v := trimText(raw);
  if |v| >= 2 {
    NoLineEndFromMatchesModel(v[1..|v| - 1], 0);
    assert v[1..|v| - 1][0..] == v[1..|v| - 1];
  }
}

lemma CommaFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures commaFrom(s, i) == WorkData.CommaFrom(s, i)
  decreases |s| - i
{
  if i < |s| { CommaFromMatchesModel(s, i + 1); }
}

lemma SplitItemsMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures splitItemsFrom(s, i) == WorkData.SplitItems(s, i)
  decreases |s| - i
{
  CommaFromMatchesModel(s, i);
  var c := commaFrom(s, i);
  ParseScalarMatchesModel(s[i..c]);
  if c < |s| { SplitItemsMatchesModel(s, c + 1); }
}

lemma ParseValueMatchesModel(raw: string)
  ensures AsValue(parseValue(raw)) == WorkData.ParseValue(raw)
{
  TrimMatchesModel(raw);
  var v := trimText(raw);
  ParseScalarMatchesModel(v);
  if |v| >= 2 {
    TrimMatchesModel(v[1..|v| - 1]);
    var inner := trimText(v[1..|v| - 1]);
    SplitItemsMatchesModel(inner, 0);
  }
}

lemma KeyRunEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures keyRunEnd(s, i) == WorkData.KeyRunEnd(s, i)
  decreases |s| - i
{
  if i < |s| { KeyRunEndMatchesModel(s, i + 1); }
}

lemma ItemStartMatchesModel(line: string)
  ensures itemStart(line) == WorkData.ItemStart(line)
{
  SpaceRunEndMatchesModel(line, 0);
  var i := spaceRunEnd(line, 0);
  if i + 1 <= |line| {
    SpaceRunEndMatchesModel(line, i + 1);
    var j := spaceRunEnd(line, i + 1);
    NoLineEndFromMatchesModel(line, j);
  }
}

lemma ClassifyLineMatchesModel(line: string)
  ensures AsLine(classifyLine(line)) == WorkData.ClassifyLine(line)
{
  SpaceRunEndMatchesModel(line, 0);
  var s := spaceRunEnd(line, 0);
  if s + 1 <= |line| { NoLineEndFromMatchesModel(line, s + 1); }
  ItemStartMatchesModel(line);
  KeyRunEndMatchesModel(line, 0);
  var k := keyRunEnd(line, 0);
  if k + 1 <= |line| { NoLineEndFromMatchesModel(line, k + 1); }
}

lemma EntryIndexMatchesModel(es: seq<YamlEntry>, key: string, i: nat)
  ensures entryIndex(es, key, i) == WorkData.EntryIndex(AsEntries(es), key, i)
  decreases |es| - i
{
  if i < |es| { EntryIndexMatchesModel(es, key, i + 1); }
}

lemma SetEntryMatchesModel(es: seq<YamlEntry>, key: string, value: YamlValue)
  ensures AsEntries(setEntry(es, key, value)) == WorkData.SetEntry(AsEntries(es), key, AsValue(value))
{
  EntryIndexMatchesModel(es, key, 0);
  var k := entryIndex(es, key, 0);
  var e := YamlEntry(key, value);
  if k < 0 { assert AsEntries(es + [e]) == AsEntries(es) + [WorkData.YamlEntry(key, AsValue(value))]; }
  else { assert AsEntries(es[..k] + [e] + es[k + 1..]) == AsEntries(es)[..k] + [WorkData.YamlEntry(key, AsValue(value))] + AsEntries(es)[k + 1..]; }
}

lemma PushItemFromMatchesModel(es: seq<YamlEntry>, i: nat, listKey: string, item: string)
  ensures AsEntries(pushItemFrom(es, i, listKey, item)) == WorkData.PushItemFrom(AsEntries(es), i, listKey, item)
  decreases |es| - i
{
  if i < |es| {
    PushItemFromMatchesModel(es, i + 1, listKey, item);
    var e := es[i];
    var head := if e.key == listKey then YamlEntry(e.key, YamlValue(true, "", e.value.items + [item])) else e;
    var rest := pushItemFrom(es, i + 1, listKey, item);
    assert AsEntries([head] + rest) == [WorkData.YamlEntry(head.key, AsValue(head.value))] + AsEntries(rest);
  } else {
    assert AsEntries([]) == [];
  }
}

lemma PushItemMatchesModel(es: seq<YamlEntry>, listKey: string, item: string)
  ensures AsEntries(pushItem(es, listKey, item)) == WorkData.PushItem(AsEntries(es), listKey, item)
{
  PushItemFromMatchesModel(es, 0, listKey, item);
}

lemma ReadPairMatchesModel(yaml: Yaml, i: nat, key: string, rest: string)
  ensures AsYaml(readPair(yaml, i, key, rest)) == WorkData.ReadPair(AsYaml(yaml), i, key, rest)
{
  TrimMatchesModel(rest);
  ParseValueMatchesModel(rest);
  var value := if |trimText(rest)| == 0 then YamlValue(true, "", []) else parseValue(rest);
  SetEntryMatchesModel(yaml.entries, key, value);
  EntryIndexMatchesModel(yaml.entries, key, 0);
  var p := YamlProblem(i, "duplicate", key);
  assert AsProblems(yaml.problems + [p]) == AsProblems(yaml.problems) + [WorkData.YamlProblem(i, "duplicate", key)];
}

lemma ReadLinesMatchesModel(lines: seq<string>, i: nat, listKey: string, yaml: Yaml)
  ensures AsYaml(readLines(lines, i, listKey, yaml)) == WorkData.ReadLines(lines, i, listKey, AsYaml(yaml))
  decreases |lines| - i
{
  if i < |lines| {
    ClassifyLineMatchesModel(lines[i]);
    var line := classifyLine(lines[i]);
    if line.kind == blank { ReadLinesMatchesModel(lines, i + 1, listKey, yaml); }
    else if line.kind == item && listKey != "" {
      ParseScalarMatchesModel(line.rest);
      PushItemMatchesModel(yaml.entries, listKey, parseScalar(line.rest));
      ReadLinesMatchesModel(lines, i + 1, listKey, Yaml(pushItem(yaml.entries, listKey, parseScalar(line.rest)), yaml.problems));
    } else if line.kind == pair {
      TrimMatchesModel(line.rest);
      ReadPairMatchesModel(yaml, i, line.key, line.rest);
      ReadLinesMatchesModel(lines, i + 1, if |trimText(line.rest)| == 0 then line.key else "", readPair(yaml, i, line.key, line.rest));
    } else {
      TrimMatchesModel(lines[i]);
      var bad := YamlProblem(i, "bad", trimText(lines[i]));
      assert AsProblems(yaml.problems + [bad]) == AsProblems(yaml.problems) + [WorkData.YamlProblem(i, "bad", trimText(lines[i]))];
      ReadLinesMatchesModel(lines, i + 1, listKey, Yaml(yaml.entries, yaml.problems + [bad]));
    }
  }
}

lemma ParseYamlMatchesModel(lines: seq<string>)
  ensures AsYaml(parseYaml(lines)) == WorkData.ParseYaml(lines)
{
  assert AsYaml(Yaml([], [])) == WorkData.Yaml([], []);
  ReadLinesMatchesModel(lines, 0, "", Yaml([], []));
}

// ---------------------------------------------------------------- field formats

lemma IdRestFromMatchesModel(s: string, i: nat)
  ensures idRestFrom(s, i) <==> forall k :: i <= k < |s| ==> WorkData.IdChar(s[k] as int)
  decreases |s| - i
{
  if i < |s| { IdRestFromMatchesModel(s, i + 1); }
}

lemma IsIdTextMatchesModel(s: string)
  ensures isIdText(s) == WorkData.IsId(s)
{
  IdRestFromMatchesModel(s, 1);
}

lemma HasSolidFromMatchesModel(s: string, i: nat)
  ensures hasSolidFrom(s, i) <==> exists k :: i <= k < |s| && !WorkData.Space(s[k] as int)
  decreases |s| - i
{
  if i < |s| { HasSolidFromMatchesModel(s, i + 1); }
}

lemma EqualsFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures equalsFrom(s, i) == WorkData.EqualsCount(s[i..])
  decreases |s| - i
{
  if i < |s| { EqualsFromMatchesModel(s, i + 1); assert s[i..][1..] == s[i + 1..]; }
}

lemma EqualsAtMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures equalsAt(s, i) == WorkData.FirstEquals(s, i)
  decreases |s| - i
{
  if i < |s| { EqualsAtMatchesModel(s, i + 1); }
}

lemma DigitsAtMatchesModel(s: string, i: nat, n: nat)
  ensures digitsAt(s, i, n) == WorkData.DigitsAt(s, i, n)
  decreases n
{
  if n > 0 { DigitsAtMatchesModel(s, i + 1, n - 1); }
}

lemma DayPartMatchesModel(s: string)
  ensures isDayPart(s) == WorkData.DayPart(s)
{
  DigitsAtMatchesModel(s, 0, 4);
  DigitsAtMatchesModel(s, 5, 2);
  DigitsAtMatchesModel(s, 8, 2);
}

lemma AfterSecondsMatchesModel(s: string, p: nat)
  requires p <= |s|
  ensures afterSeconds(s, p) == WorkData.AfterSeconds(s, p)
{
  DigitsAtMatchesModel(s, p + 1, 2);
  if p + 4 <= |s| { DigitRunEndMatchesModel(s, p + 4); }
}

lemma AfterZoneMatchesModel(s: string, p: nat)
  requires p <= |s|
  ensures afterZone(s, p) == WorkData.AfterZone(s, p)
{
  DigitsAtMatchesModel(s, p + 1, 2);
  DigitsAtMatchesModel(s, p + 3, 2);
  DigitsAtMatchesModel(s, p + 4, 2);
}

lemma IsWhenTextMatchesModel(s: string)
  ensures isWhenText(s) == WorkData.IsWhen(s)
{
  DayPartMatchesModel(s);
  DigitsAtMatchesModel(s, 11, 2);
  DigitsAtMatchesModel(s, 14, 2);
  if |s| >= 16 {
    AfterSecondsMatchesModel(s, 16);
    AfterZoneMatchesModel(s, afterSeconds(s, 16));
  }
}

lemma MatchesFormatMatchesModel(format: string, v: string)
  ensures matchesFormat(format, v) == WorkData.MatchesFormat(format, v)
{
  IsIdTextMatchesModel(v);
  HasSolidFromMatchesModel(v, 0);
  EqualsFromMatchesModel(v, 0);
  assert v[0..] == v;
  EqualsAtMatchesModel(v, 0);
  RepoRunEndMatchesModel(v, 0);
  var a := repoRunEnd(v, 0);
  if a + 1 <= |v| { RepoRunEndMatchesModel(v, a + 1); }
  AllDigitsFromMatchesModel(v, 0);
  IsWhenTextMatchesModel(v);
  DayPartMatchesModel(v);
  DigitsAtMatchesModel(v, 11, 2);
  DigitsAtMatchesModel(v, 14, 2);
}

lemma HoldsFromMatchesModel(xs: seq<string>, x: string, i: nat)
  requires i <= |xs|
  ensures holdsFrom(xs, x, i) == (x in xs[i..])
  decreases |xs| - i
{
  if i < |xs| { HoldsFromMatchesModel(xs, x, i + 1); assert xs[i..] == [xs[i]] + xs[i + 1..]; }
}

lemma HoldsMatchesModel(xs: seq<string>, x: string)
  ensures holds(xs, x) == (x in xs)
{
  HoldsFromMatchesModel(xs, x, 0);
  assert xs[0..] == xs;
}

lemma RepeatsAtMatchesModel(xs: seq<string>, i: nat)
  requires i < |xs|
  ensures repeatsAt(xs, i) == (xs[i] in xs[..i])
{
  HoldsMatchesModel(xs[0..i], xs[i]);
}

lemma ScalarProblemMatchesModel(isList: bool, v: string, hasEnum: bool, allowed: seq<string>, format: string)
  ensures scalarProblem(isList, v, hasEnum, allowed, format) == WorkData.ScalarProblem(isList, v, hasEnum, allowed, format)
{
  HoldsMatchesModel(allowed, v);
  MatchesFormatMatchesModel(format, v);
}

lemma IdFromFileMatchesModel(name: string, folder: string)
  ensures idFromFile(name, folder) == WorkData.IdFromFile(name, folder)
{
}

// ---------------------------------------------------------------- order

lemma CompareFromMatchesModel(a: string, b: string, i: nat)
  requires i <= |a| && i <= |b|
  ensures compareFrom(a, b, i) == WorkData.CompareText(a[i..], b[i..])
  decreases |a| - i
{
  if i < |a| && i < |b| {
    CompareFromMatchesModel(a, b, i + 1);
    assert a[i..][1..] == a[i + 1..] && b[i..][1..] == b[i + 1..];
  }
}

lemma CompareTextMatchesModel(a: string, b: string)
  ensures compareText(a, b) == WorkData.CompareText(a, b)
{
  CompareFromMatchesModel(a, b, 0);
  assert a[0..] == a && b[0..] == b;
}

lemma LaterTextMatchesModel(a: string, b: string)
  ensures laterText(a, b) == WorkData.LaterText(a, b)
{
  CompareTextMatchesModel(a, b);
}

lemma EarlierPresentMatchesModel(a: string, b: string)
  ensures earlierPresent(a, b) == WorkData.EarlierPresent(a, b)
{
  CompareTextMatchesModel(b, a);
}

// ---------------------------------------------------------------- refresh and briefs

lemma IsLockStaleMatchesModel(now: int, lockedAt: int)
  ensures isLockStale(now, lockedAt) == WorkData.IsLockStale(now, lockedAt)
{
}

lemma AutoSyncOfMatchesModel(value: string)
  ensures autoSyncOf(value) == WorkData.AutoSyncOf(value)
{
}

lemma ProjectOfRefMatchesModel(ref: string)
  ensures projectOfRef(ref) == WorkData.ProjectOfRef(ref)
{
  if |ref| >= 9 { DigitRunEndMatchesModel(ref, 9); }
}

lemma IsAutoHubMatchesModel(summary: string)
  ensures isAutoHub(summary) == WorkData.IsAutoHub(summary)
{
}

lemma IsVisibleNameMatchesModel(name: string)
  ensures isVisibleName(name) == WorkData.IsVisibleName(name)
{
}

lemma AllItemsFromMatchesModel(names: seq<string>, i: nat)
  ensures allItemsFrom(names, i) <==> forall k :: i <= k < |names| ==> names[k] == "items"
  decreases |names| - i
{
  if i < |names| { AllItemsFromMatchesModel(names, i + 1); }
}

lemma IsEmptyHubMatchesModel(others: seq<string>, visibleItems: int)
  ensures isEmptyHub(others, visibleItems) == WorkData.IsEmptyHub(others, visibleItems)
{
  AllItemsFromMatchesModel(others, 0);
}

lemma ProjectInUrlFromMatchesModel(url: string, i: nat)
  requires i <= |url|
  ensures projectInUrlFrom(url, i) == WorkData.ProjectInUrlFrom(url, i)
  decreases |url| - i
{
  if i < |url| {
    if i + 10 <= |url| { DigitRunEndMatchesModel(url, i + 10); }
    ProjectInUrlFromMatchesModel(url, i + 1);
  }
}

lemma ProjectInUrlMatchesModel(url: string)
  ensures projectInUrl(url) == WorkData.ProjectInUrl(url)
{
  ProjectInUrlFromMatchesModel(url, 0);
}

lemma BriefCellFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures briefCellFrom(s, i) == WorkData.BriefCellFrom(s, i)
  decreases |s| - i
{
  if i < |s| {
    SpaceRunEndMatchesModel(s, i);
    if WorkData.Space(s[i] as int) { BriefCellFromMatchesModel(s, spaceRunEnd(s, i)); }
    else { BriefCellFromMatchesModel(s, i + 1); }
  }
}

lemma BriefCellMatchesModel(text: string)
  ensures briefCell(text) == WorkData.BriefCell(text)
{
  BriefCellFromMatchesModel(text, 0);
}

lemma IsQuietMatchesModel(hasUpdated: bool, todayMs: int, updatedMs: int)
  ensures isQuiet(hasUpdated, todayMs, updatedMs) == WorkData.IsQuiet(hasUpdated, todayMs, updatedMs)
{
}

lemma MarkersInOrderMatchesModel(start: int, end: int)
  ensures markersInOrder(start, end) == WorkData.MarkersInOrder(start, end)
{
}

// ---------------------------------------------------------------- the digest and the list

lemma IsBotNameMatchesModel(p: string)
  ensures isBotName(p) == WorkData.IsBotName(p)
{
}

lemma LastSetMatchesModel(flags: seq<bool>, i: nat)
  requires i <= |flags|
  ensures lastSetBefore(flags, i) == WorkData.LastSet(flags, i)
  decreases i
{
  if i > 0 { LastSetMatchesModel(flags, i - 1); }
}

lemma LastMineIndexMatchesModel(mine: seq<bool>)
  ensures lastMineIndex(mine) == WorkData.LastMineIndex(mine)
{
  LastSetMatchesModel(mine, |mine|);
}

lemma WaitsOnMatchesModel(hasAuthor: bool, isMe: bool, isBot: bool)
  ensures waitsOn(hasAuthor, isMe, isBot) == WorkData.WaitsOn(hasAuthor, isMe, isBot)
{
}

lemma HoldsUpMatchesModel(owners: int, anyIsMe: bool)
  ensures holdsUp(owners, anyIsMe) == WorkData.HoldsUp(owners, anyIsMe)
{
}

lemma DueMatchesModel(due: string, today: string, days: int)
  ensures isOverdue(due, today) == WorkData.IsOverdue(due, today)
  ensures isDueSoon(due, today, days) == WorkData.IsDueSoon(due, today, days)
  ensures isStale(due, days) == WorkData.IsStale(due, days)
{
  CompareTextMatchesModel(due, today);
}

lemma IsUnfetchedMatchesModel(id: string, known: bool)
  ensures isUnfetched(id, known) == WorkData.IsUnfetched(id, known)
{
}

lemma RowsLeftOutMatchesModel(total: int)
  ensures rowsLeftOut(total) == WorkData.RowsLeftOut(total)
{
}

lemma ImpactOrderMatchesModel(ba: int, bb: int, da: int, db: int, sa: string, sb: string)
  ensures impactOrder(ba, bb, da, db, sa, sb) == WorkData.ImpactOrder(ba, bb, da, db, sa, sb)
{
  CompareTextMatchesModel(if sa == "" then "9" else sa, if sb == "" then "9" else sb);
}

lemma NumberTextFromMatchesModel(d: string, i: nat)
  requires i <= |d|
  ensures numberTextFrom(d, i) == WorkData.NumberTextFrom(d, i)
  decreases |d| - i
{
  if i + 1 < |d| { NumberTextFromMatchesModel(d, i + 1); }
}

lemma ShortRefMatchesModel(id: string, org: string)
  ensures shortRef(id, org) == WorkData.ShortRef(id, org)
{
  ParseGithubIdMatchesModel(id, org);
  NumberTextFromMatchesModel(parseGithubId(id, org).digits, 0);
}

lemma IsMineMatchesModel(ownedRepo: bool, anyIsMe: bool)
  ensures isMine(ownedRepo, anyIsMe) == WorkData.IsMine(ownedRepo, anyIsMe)
{
}

lemma IsListedMatchesModel(isBasecamp: bool, isAssigned: bool, isIssue: bool, watched: bool)
  ensures isListed(isBasecamp, isAssigned, isIssue, watched) == WorkData.IsListed(isBasecamp, isAssigned, isIssue, watched)
{
}

lemma IssueOrderMatchesModel(repoA: string, repoB: string, numberA: int, numberB: int)
  ensures issueOrder(repoA, repoB, numberA, numberB) == WorkData.IssueOrder(repoA, repoB, numberA, numberB)
{
  CompareTextMatchesModel(repoA, repoB);
}

// ---------------------------------------------------------------- the chart

function AsEdges(es: seq<Edge>): seq<WorkData.Edge>
{
  seq(|es|, k requires 0 <= k < |es| => WorkData.Edge(es[k].from, es[k].to, es[k].closes))
}

lemma NodeNameMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures nodeNameFrom(s, i) == WorkData.NodeName(s[i..])
  decreases |s| - i
{
  if i < |s| {
    NodeNameMatchesModel(s, i + 1);
    assert s[i..][1..] == s[i + 1..];
    assert s[i..i + 1] == [s[i]];
  }
}

lemma NodeIdMatchesModel(id: string)
  ensures nodeId(id) == WorkData.NodeId(id)
{
  NodeNameMatchesModel(id, 0);
  assert id[0..] == id;
}

lemma LabelFromMatchesModel(s: string, i: nat)
  ensures labelFrom(s, i) == WorkData.LabelFrom(s, i)
  decreases |s| - i
{
  if i < |s| { LabelFromMatchesModel(s, i + 1); }
}

lemma ChartLabelMatchesModel(text: string)
  ensures chartLabel(text) == WorkData.ChartLabel(text)
{
  LabelFromMatchesModel(text, 0);
}

lemma ChartTitleMatchesModel(title: string)
  ensures chartTitle(title) == WorkData.ChartTitle(title)
{
}

lemma ChartRefMatchesModel(id: string)
  ensures chartRef(id) == WorkData.ChartRef(id)
{
  ParseGithubIdMatchesModel(id, "");
  LastHyphenMatchesModel(id, |id|);
}

lemma ArrowOfMatchesModel(closes: bool)
  ensures arrowOf(closes) == WorkData.ArrowOf(closes)
{
}

lemma HtmlFromMatchesModel(s: string, i: nat)
  ensures htmlFrom(s, i) == WorkData.HtmlFrom(s, i)
  decreases |s| - i
{
  if i < |s| { HtmlFromMatchesModel(s, i + 1); }
}

lemma HtmlTextMatchesModel(text: string)
  ensures htmlText(text) == WorkData.HtmlText(text)
{
  HtmlFromMatchesModel(text, 0);
}

lemma EdgeIndexMatchesModel(es: seq<Edge>, from: string, to: string, i: nat)
  ensures edgeIndex(es, from, to, i) == WorkData.EdgeIndex(AsEdges(es), from, to, i)
  decreases |es| - i
{
  if i < |es| { EdgeIndexMatchesModel(es, from, to, i + 1); }
}

lemma AddEdgeMatchesModel(es: seq<Edge>, from: string, to: string, closes: bool)
  ensures AsEdges(addEdge(es, from, to, closes)) == WorkData.AddEdge(AsEdges(es), from, to, closes)
{
  EdgeIndexMatchesModel(es, from, to, 0);
  var k := edgeIndex(es, from, to, 0);
  if k < 0 {
    assert AsEdges(es + [Edge(from, to, closes)]) == AsEdges(es) + [WorkData.Edge(from, to, closes)];
  } else {
    var e := Edge(es[k].from, es[k].to, es[k].closes || closes);
    assert AsEdges(es[..k] + [e] + es[k + 1..]) == AsEdges(es)[..k] + [WorkData.Edge(e.from, e.to, e.closes)] + AsEdges(es)[k + 1..];
  }
}

// ---------------------------------------------------------------- follow

lemma IsRootItemMatchesModel(isBasecamp: bool, ownedRepo: bool)
  ensures isRootItem(isBasecamp, ownedRepo) == WorkData.IsRootItem(isBasecamp, ownedRepo)
{
}

lemma FollowKindMatchesModel(id: string, org: string, owned: bool)
  ensures followKind(id, org, owned) == WorkData.FollowKind(id, org, owned)
{
  ParseGithubIdMatchesModel(id, org);
}

lemma TodoProjectMatchesModel(linkProject: string, elsewhere: string, hubProjects: seq<string>)
  ensures todoProject(linkProject, elsewhere, hubProjects) == WorkData.TodoProject(linkProject, elsewhere, hubProjects)
{
}

lemma OccursInMatchesModel(s: string, w: string, i: nat)
  ensures occursIn(s, w, i) == WorkData.OccursFrom(s, w, i)
  decreases |s| - i
{
  if i + |w| <= |s| { OccursInMatchesModel(s, w, i + 1); }
}

lemma MovedAwayMatchesModel(htmlUrl: string, org: string, repo: string)
  ensures movedAway(htmlUrl, org, repo) == WorkData.MovedAway(htmlUrl, org, repo)
{
  LowerMatchesModel(htmlUrl);
  LowerMatchesModel("/" + org + "/" + repo + "/issues/");
  OccursInMatchesModel(lower(htmlUrl), lower("/" + org + "/" + repo + "/issues/"), 0);
}

lemma IsPrunedMatchesModel(isGithub: bool, isRoot: bool, visited: bool)
  ensures isPruned(isGithub, isRoot, visited) == WorkData.IsPruned(isGithub, isRoot, visited)
{
}

lemma IsHubForMatchesModel(hubId: string, followed: seq<string>, repo: string)
  ensures isHubFor(hubId, followed, repo) == WorkData.IsHubFor(hubId, followed, repo)
{
  HoldsMatchesModel(followed, repo);
}

// ---------------------------------------------------------------- GitHub and Basecamp items

lemma ItemWordsMatchModel(isPull: bool, closed: bool, name: string)
  ensures issueKind(isPull) == WorkData.IssueKind(isPull)
  ensures statusOf(closed) == WorkData.StatusOf(closed)
  ensures orUnknown(name) == WorkData.OrUnknown(name)
{
}

lemma IsClosedItemMatchesModel(id: string, prefix: string, open: bool)
  ensures isClosedItem(id, prefix, open) == WorkData.IsClosedItem(id, prefix, open)
{
  if hasAt(id, 0, prefix) && |id| > |prefix| {
    var rest := id[|prefix|..|id|];
    AllDigitsFromMatchesModel(rest, 0);
    assert rest[0..] == rest && id[|prefix|..] == rest;
  }
}

lemma SlugFromMatchesModel(s: string, i: nat, started: bool, gap: bool)
  ensures slugFrom(s, i, started, gap) == WorkData.SlugFrom(s, i, started, gap)
  decreases |s| - i
{
  if i < |s| {
    SlugFromMatchesModel(s, i + 1, started, started);
    SlugFromMatchesModel(s, i + 1, true, false);
  }
}

lemma SlugMatchesModel(name: string)
  ensures slug(name) == WorkData.Slug(name)
{
  LowerMatchesModel(name);
  SlugFromMatchesModel(lower(name), 0, false, false);
}

lemma HubIdForMatchesModel(projectName: string, project: string)
  ensures hubIdFor(projectName, project) == WorkData.HubIdFor(projectName, project)
{
  SlugMatchesModel(projectName);
}

lemma BrEndMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures brEnd(s, i) == WorkData.BrEnd(s, i)
{
  if i + 3 <= |s| {
    LowerMatchesModel(s[i..i + 3]);
    SpaceRunEndMatchesModel(s, i + 3);
  }
}

lemma PlainFromMatchesModel(s: string, i: nat)
  requires i <= |s|
  ensures plainFrom(s, i) == WorkData.PlainFrom(s, i)
  decreases |s| - i
{
  if i < |s| {
    BrEndMatchesModel(s, i);
    var e := brEnd(s, i);
    if e > 0 { PlainFromMatchesModel(s, e); } else { PlainFromMatchesModel(s, i + 1); }
  }
}

lemma PlainTextMatchesModel(html: string)
  ensures plainText(html) == WorkData.PlainText(html)
{
  PlainFromMatchesModel(html, 0);
}

// ---------------------------------------------------------------- the exported character rules

lemma CharactersMatchModel(c: int, s: string, i: nat, w: string)
  ensures isWordUnit(c) == WorkData.Word(c)
  ensures isSpaceUnit(c) == WorkData.Space(c)
  ensures isLineEndUnit(c) == WorkData.LineEnd(c)
  ensures hasAt(s, i, w) == WorkData.At(s, i, w)
{
}

lemma NumberTextMatchesModel(digits: string)
  ensures numberText(digits) == WorkData.NumberText(digits)
{
  NumberTextFromMatchesModel(digits, 0);
}

lemma SettingsMatchModel(value: string, isSet: bool, minutes: int)
  ensures orgOf(value) == WorkData.OrgOf(value)
  ensures syncMinutesOf(isSet, minutes) == WorkData.SyncMinutesOf(isSet, minutes)
{
}
