// The model of the work scripts (plugins/simpleapps-work-pane/scripts): what each decision about
// work/ means. Hand-written Dafny. `scripts/work-rules.ts` is proved with LemmaScript and linked to
// it in `models/links/work-data-rules.dfy`. Nothing is generated from this file.
//
// Each rule keeps the behaviour of the work scripts it replaces (GH #14), whose decisions were
// regexes: the reference grammar, comment headings, frontmatter YAML, and field formats. Here each
// regex is spelled as the leftmost, greedy match JavaScript makes, over UTF-16 code units
// (lemmascript.json "javascript-utf16"). The lemmas at the end of each section are the guarantees
// work/ relies on.

module WorkData {

  // ---------------------------------------------------------------- characters

  predicate Word(c: int) { 65 <= c <= 90 || 97 <= c <= 122 || 48 <= c <= 57 || c == 95 }   // \w
  predicate RepoChar(c: int) { Word(c) || c == 46 || c == 45 }                             // [\w.-]
  predicate Alpha(c: int) { 65 <= c <= 90 || 97 <= c <= 122 }                              // [A-Za-z]
  predicate Digit(c: int) { 48 <= c <= 57 }                                                // \d
  // \s, and what String.prototype.trim removes
  predicate Space(c: int)
  {
    9 <= c <= 13 || c == 32 || c == 160 || c == 5760 || 8192 <= c <= 8202 ||
    c == 8232 || c == 8233 || c == 8239 || c == 8287 || c == 12288 || c == 65279
  }
  predicate LineEnd(c: int) { c == 10 || c == 13 || c == 8232 || c == 8233 }               // not `.`
  predicate Lead(c: int) { Space(c) || c == 40 || c == 91 }                                // [\s([]

  lemma LineEndsAreSpace(c: int)
    ensures LineEnd(c) ==> Space(c)
  {
  }

  predicate At(s: string, i: nat, w: string)
  {
    i + |w| <= |s| && s[i..i + |w|] == w
  }

  // Where the run of characters of a class that starts at i ends: the greedy `[...]*`.
  function RepoRunEnd(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= RepoRunEnd(s, i) <= |s|
    decreases |s| - i
  {
    if i == |s| || !RepoChar(s[i] as int) then i else RepoRunEnd(s, i + 1)
  }

  function DigitRunEnd(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= DigitRunEnd(s, i) <= |s|
    decreases |s| - i
  {
    if i == |s| || !Digit(s[i] as int) then i else DigitRunEnd(s, i + 1)
  }

  function SpaceRunEnd(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= SpaceRunEnd(s, i) <= |s|
    decreases |s| - i
  {
    if i == |s| || !Space(s[i] as int) then i else SpaceRunEnd(s, i + 1)
  }

  function SolidRunEnd(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= SolidRunEnd(s, i) <= |s|
    decreases |s| - i
  {
    if i == |s| || Space(s[i] as int) then i else SolidRunEnd(s, i + 1)
  }

  // A run ends where its class stops: everything before is in the class, the end is not.
  lemma RepoRunIsMaximal(s: string, i: nat)
    requires i <= |s|
    ensures forall k :: i <= k < RepoRunEnd(s, i) ==> RepoChar(s[k] as int)
    ensures RepoRunEnd(s, i) == |s| || !RepoChar(s[RepoRunEnd(s, i)] as int)
    decreases |s| - i
  {
    if i < |s| && RepoChar(s[i] as int) { RepoRunIsMaximal(s, i + 1); }
  }

  predicate AllDigits(s: string)
  {
    forall k :: 0 <= k < |s| ==> Digit(s[k] as int)
  }

  predicate NoLineEnd(s: string)
  {
    forall k :: 0 <= k < |s| ==> !LineEnd(s[k] as int)
  }

  // A-Z lowered; nothing else changes. Every text lowered here is ASCII.
  function LowerChar(c: char): char
  {
    if 'A' <= c <= 'Z' then (c as int + 32) as char else c
  }

  function Lower(s: string): string
    ensures |Lower(s)| == |s|
  {
    if |s| == 0 then "" else [LowerChar(s[0])] + Lower(s[1..])
  }

  lemma LowerIndex(s: string, k: nat)
    requires k < |s|
    ensures Lower(s)[k] == LowerChar(s[k])
  {
    if k > 0 { LowerIndex(s[1..], k - 1); }
  }

  lemma LowerAppend(a: string, b: string)
    ensures Lower(a + b) == Lower(a) + Lower(b)
  {
    if |a| == 0 {
      assert a + b == b;
    } else {
      assert (a + b)[0] == a[0];
      assert (a + b)[1..] == a[1..] + b;
      LowerAppend(a[1..], b);
    }
  }

  // ---------------------------------------------------------------- item ids

  // `gh-<repo>-<n>` in the person's org, else `gh-<owner>.<repo>-<n>`; the name lowered.
  function GithubId(owner: string, repo: string, num: string, org: string): string
  {
    var name := if Lower(owner) == Lower(org) then repo else owner + "." + repo;
    "gh-" + Lower(name) + "-" + num
  }

  function BasecampId(isMessage: bool, num: string): string
  {
    (if isMessage then "bc-message-" else "bc-todo-") + num
  }

  // `#500000014` means a Basecamp todo: todo ids have 9+ digits, issue numbers far fewer.
  function NumberedId(owner: string, repo: string, num: string, org: string): string
  {
    if |num| >= 9 then BasecampId(false, num) else GithubId(owner, repo, num, org)
  }

  datatype GithubParts = GithubParts(ok: bool, owner: string, repo: string, digits: string)

  // The last hyphen before i, or -1.
  function LastHyphen(s: string, i: nat): int
    requires i <= |s|
    ensures -1 <= LastHyphen(s, i) < i
    ensures LastHyphen(s, i) >= 0 ==> s[LastHyphen(s, i)] == '-'
    ensures forall k :: LastHyphen(s, i) < k < i ==> s[k] != '-'
    decreases i
  {
    if i == 0 then -1 else if s[i - 1] == '-' then i - 1 else LastHyphen(s, i - 1)
  }

  function FirstDot(s: string, i: nat): int
    ensures FirstDot(s, i) == -1 || i <= FirstDot(s, i) < |s|
    decreases |s| - i
  {
    if i >= |s| then -1 else if s[i] == '.' then i else FirstDot(s, i + 1)
  }

  // `^gh-(.+)-(\d+)$`: greedy `.+` splits at the last hyphen, so the number is what follows it.
  // Then the name splits at its first dot into owner and repo; no dot means the person's org.
  function ParseGithubId(id: string, org: string): GithubParts
  {
    if !At(id, 0, "gh-") then GithubParts(false, "", "", "")
    else
      var k := LastHyphen(id, |id|);
      if k <= 3 then GithubParts(false, "", "", "")
      else
        var digits := id[k + 1..];
        var name := id[3..k];
        if |digits| == 0 || !AllDigits(digits) || !NoLineEnd(name) then GithubParts(false, "", "", "")
        else
          var dot := FirstDot(name, 0);
          if dot < 0 then GithubParts(true, org, name, digits)
          else GithubParts(true, name[..dot], name[dot + 1..], digits)
  }

  function TodoLabel(id: string): string
  {
    if At(id, 0, "bc-todo-") then "BC" + id[8..] else id
  }

  lemma FirstDotNone(s: string, i: nat)
    requires forall k :: i <= k < |s| ==> s[k] != '.'
    ensures FirstDot(s, i) == -1
    decreases |s| - i
  {
    if i < |s| { FirstDotNone(s, i + 1); }
  }

  lemma LastHyphenIs(s: string, j: nat)
    requires j < |s| && s[j] == '-'
    requires forall k :: j < k < |s| ==> s[k] != '-'
    ensures LastHyphen(s, |s|) == j
  {
    LastHyphenFrom(s, |s|, j);
  }

  lemma LastHyphenFrom(s: string, i: nat, j: nat)
    requires j < i <= |s| && s[j] == '-'
    requires forall k :: j < k < i ==> s[k] != '-'
    ensures LastHyphen(s, i) == j
    decreases i
  {
    if i - 1 > j { LastHyphenFrom(s, i - 1, j); }
  }

  // An org repo's id parses back: owner the org, the repo lowered, the number as it was.
  lemma GithubIdParsesBack(repo: string, num: string, org: string)
    requires |repo| > 0 && |num| > 0 && AllDigits(num) && NoLineEnd(repo)
    requires forall k :: 0 <= k < |repo| ==> repo[k] != '.'
    ensures ParseGithubId(GithubId(org, repo, num, org), org) == GithubParts(true, org, Lower(repo), num)
  {
    var name := Lower(repo);
    var pre := "gh-" + name + "-";
    var id := pre + num;
    var j := 3 + |name|;
    assert GithubId(org, repo, num, org) == id;
    assert |pre| == j + 1 && id[..j + 1] == pre && id[j + 1..] == num;
    assert id[..3] == "gh-" && id[3..j] == name && id[j] == '-';
    NumberHasNoHyphen(id, j + 1, num);
    LastHyphenIs(id, j);
    LowerKeepsShape(repo);
    FirstDotNone(name, 0);
  }

  lemma NumberHasNoHyphen(id: string, from: nat, num: string)
    requires from <= |id| && id[from..] == num && AllDigits(num)
    ensures forall k :: from <= k < |id| ==> id[k] != '-'
  {
    forall k | from <= k < |id| ensures id[k] != '-' {
      assert id[k] == num[k - from];
      assert Digit(num[k - from] as int);
    }
  }

  // Lowering keeps a text free of line ends and dots.
  lemma LowerKeepsShape(s: string)
    requires NoLineEnd(s) && forall k :: 0 <= k < |s| ==> s[k] != '.'
    ensures NoLineEnd(Lower(s)) && forall k :: 0 <= k < |Lower(s)| ==> Lower(s)[k] != '.'
  {
    forall k | 0 <= k < |s| ensures !LineEnd(Lower(s)[k] as int) && Lower(s)[k] != '.' {
      LowerIndex(s, k);
    }
  }

  // ---------------------------------------------------------------- "closes" before a reference
  // `\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*$`, ignoring case, on the 24 code units
  // before the reference. The window ends with whitespace, an optional colon and whitespace;
  // what is left must end with a keyword that starts the window or follows a non-word character.

  const Keywords: seq<string> :=
    ["close", "closes", "closed", "fix", "fixes", "fixed", "resolve", "resolves", "resolved"]

  function SpaceStart(s: string, lo: nat, e: nat): nat
    requires lo <= e <= |s|
    ensures lo <= SpaceStart(s, lo, e) <= e
    decreases e - lo
  {
    if e > lo && Space(s[e - 1] as int) then SpaceStart(s, lo, e - 1) else e
  }

  predicate KeywordEndsAt(s: string, lo: nat, e: nat, k: string)
    requires lo <= e <= |s|
  {
    |k| <= e - lo &&
    var b := e - |k|;
    Lower(s[b..e]) == k && (b == lo || !Word(s[b - 1] as int))
  }

  predicate ClosesBefore(s: string, start: nat)
    requires start <= |s|
  {
    var lo := if start >= 24 then start - 24 else 0;
    var e1 := SpaceStart(s, lo, start);
    var e := if e1 > lo && s[e1 - 1] == ':' then SpaceStart(s, lo, e1 - 1) else e1;
    exists i :: 0 <= i < |Keywords| && KeywordEndsAt(s, lo, e, Keywords[i])
  }

  // ---------------------------------------------------------------- the five reference forms

  datatype Hit = Hit(ok: bool, end: nat, owner: string, repo: string, num: string, project: string, isMessage: bool)

  const Miss: Hit := Hit(false, 0, "", "", "", "", false)

  // After `https?://` at i (greedy `s?`), or -1.
  function AfterScheme(s: string, i: nat): int
    ensures AfterScheme(s, i) == -1 || i < AfterScheme(s, i) <= |s|
  {
    if !At(s, i, "http") then -1
    else
      var j := if At(s, i + 4, "s") then i + 5 else i + 4;
      if At(s, j, "://") then j + 3 else -1
  }

  // `https?://github.com/<owner>/<repo>/(issues|pull)/<n>` at i.
  function GithubUrlAt(s: string, i: nat): Hit
    requires i <= |s|
    ensures GithubUrlAt(s, i).ok ==> i < GithubUrlAt(s, i).end <= |s|
  {
    var j := AfterScheme(s, i);
    if j < 0 || !At(s, j, "github.com/") then Miss
    else
      var a := j + 11;
      var o := RepoRunEnd(s, a);
      if o == a || !At(s, o, "/") then Miss
      else
        var r := RepoRunEnd(s, o + 1);
        if r == o + 1 || !At(s, r, "/") then Miss
        else
          var k := if At(s, r + 1, "issues/") then r + 8 else if At(s, r + 1, "pull/") then r + 6 else -1;
          if k < 0 then Miss
          else
            var d := DigitRunEnd(s, k);
            if d == k then Miss else Hit(true, d, s[a..o], s[o + 1..r], s[k..d], "", false)
  }

  // `https?://(3.)?basecamp.com/<account>/projects/<project>/(todos|messages)/<n>` at i.
  function BasecampUrlAt(s: string, i: nat): Hit
    requires i <= |s|
    ensures BasecampUrlAt(s, i).ok ==> i < BasecampUrlAt(s, i).end <= |s|
  {
    var j := AfterScheme(s, i);
    if j < 0 then Miss
    else
      var b := if At(s, j, "3.") then j + 2 else j;
      if !At(s, b, "basecamp.com/") then Miss
      else
        var a := b + 13;
        var d1 := DigitRunEnd(s, a);
        if d1 == a || !At(s, d1, "/projects/") then Miss
        else
          var p := d1 + 10;
          var d2 := DigitRunEnd(s, p);
          if d2 == p || !At(s, d2, "/") then Miss
          else
            var n := if At(s, d2 + 1, "todos/") then d2 + 7 else if At(s, d2 + 1, "messages/") then d2 + 10 else -1;
            if n < 0 then Miss
            else
              var d3 := DigitRunEnd(s, n);
              if d3 == n then Miss else Hit(true, d3, "", "", s[n..d3], s[p..d2], At(s, d2 + 1, "messages/"))
  }

  // A reference may start at q: the text's start (or a line's, multiline `^`), or after `[\s([]`.
  predicate LeadsAt(s: string, q: nat)
    requires q <= |s|
  {
    q == 0 || Lead(s[q - 1] as int)
  }

  // `\b` after the digits.
  predicate EndsWord(s: string, d: nat)
    requires d <= |s|
  {
    d == |s| || !Word(s[d] as int)
  }

  // `(<owner>/)?<repo>#<n>\b` after a lead; the repo two or more characters, a letter first.
  function IssueRefAt(s: string, q: nat): Hit
    requires q <= |s|
    ensures IssueRefAt(s, q).ok ==> q < IssueRefAt(s, q).end <= |s|
  {
    if !LeadsAt(s, q) then Miss
    else
      var r1 := RepoRunEnd(s, q);
      if r1 == q then Miss
      else
        var hasOwner := At(s, r1, "/");
        var rs := if hasOwner then r1 + 1 else q;
        var re := if hasOwner then RepoRunEnd(s, r1 + 1) else r1;
        if re - rs < 2 || !Alpha(s[rs] as int) || !At(s, re, "#") then Miss
        else
          var d := DigitRunEnd(s, re + 1);
          if d == re + 1 || !EndsWord(s, d) then Miss
          else Hit(true, d, if hasOwner then s[q..r1] else "", s[rs..re], s[re + 1..d], "", false)
  }

  // `#<n>\b` after a lead.
  function BareRefAt(s: string, q: nat): Hit
    requires q <= |s|
    ensures BareRefAt(s, q).ok ==> q < BareRefAt(s, q).end <= |s|
  {
    if !LeadsAt(s, q) || !At(s, q, "#") then Miss
    else
      var d := DigitRunEnd(s, q + 1);
      if d == q + 1 || !EndsWord(s, d) then Miss else Hit(true, d, "", "", s[q + 1..d], "", false)
  }

  // `\bBC\d{6,}\b`.
  function BcRefAt(s: string, i: nat): Hit
    requires i <= |s|
    ensures BcRefAt(s, i).ok ==> i < BcRefAt(s, i).end <= |s|
  {
    if (i > 0 && Word(s[i - 1] as int)) || !At(s, i, "BC") then Miss
    else
      var d := DigitRunEnd(s, i + 2);
      if d - (i + 2) < 6 || !EndsWord(s, d) then Miss else Hit(true, d, "", "", s[i + 2..d], "", false)
  }

  // ---------------------------------------------------------------- references in a text

  datatype Ref = Ref(id: string, closes: bool, project: string)
  datatype RefContext = RefContext(hasRepo: bool, owner: string, repo: string, org: string)

  // A GitHub item's `ref`, `^([\w.-]+)/([\w.-]+)#\d+$`, names the repo bare `#<n>` means.
  function ContextOf(isGithub: bool, ref: string, org: string): RefContext
  {
    var none := RefContext(false, "", "", org);
    if !isGithub then none
    else
      var o := RepoRunEnd(ref, 0);
      if o == 0 || !At(ref, o, "/") then none
      else
        var r := RepoRunEnd(ref, o + 1);
        if r == o + 1 || !At(ref, r, "#") then none
        else
          var d := DigitRunEnd(ref, r + 1);
          if d == r + 1 || d != |ref| then none else RefContext(true, ref[..o], ref[o + 1..r], org)
  }

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

  function ScanGithubUrls(s: string, i: nat, ctx: RefContext, refs: seq<Ref>): seq<Ref>
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then refs
    else
      var h := GithubUrlAt(s, i);
      if !h.ok then ScanGithubUrls(s, i + 1, ctx, refs)
      else ScanGithubUrls(s, h.end, ctx, AddRef(refs, GithubId(h.owner, h.repo, h.num, ctx.org), ClosesBefore(s, i), ""))
  }

  // `GH#<n>` is the item's own repo, like a bare `#<n>`; "" when there is none.
  function IssueRefId(h: Hit, ctx: RefContext): string
  {
    if h.owner == "" && Lower(h.repo) == "gh" then
      (if ctx.hasRepo then NumberedId(ctx.owner, ctx.repo, h.num, ctx.org) else "")
    else NumberedId(if h.owner == "" then ctx.org else h.owner, h.repo, h.num, ctx.org)
  }

  function ScanIssueRefs(s: string, i: nat, ctx: RefContext, refs: seq<Ref>): seq<Ref>
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then refs
    else
      var h := IssueRefAt(s, i);
      if !h.ok then ScanIssueRefs(s, i + 1, ctx, refs)
      else
        var id := IssueRefId(h, ctx);
        ScanIssueRefs(s, h.end, ctx, if id == "" then refs else AddRef(refs, id, ClosesBefore(s, i), ""))
  }

  // The first GitHub reference so far whose number is num.
  function KnownIssueId(refs: seq<Ref>, num: string, i: nat): string
    decreases |refs| - i
  {
    if i >= |refs| then ""
    else
      var id := refs[i].id;
      var tail := "-" + num;
      if At(id, 0, "gh-") && |id| >= |tail| && id[|id| - |tail|..] == tail then id
      else KnownIssueId(refs, num, i + 1)
  }

  function BareRefId(refs: seq<Ref>, num: string, ctx: RefContext): string
  {
    var known := KnownIssueId(refs, num, 0);
    if known != "" then known else if ctx.hasRepo then NumberedId(ctx.owner, ctx.repo, num, ctx.org) else ""
  }

  function ScanBareRefs(s: string, i: nat, ctx: RefContext, refs: seq<Ref>): seq<Ref>
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then refs
    else
      var h := BareRefAt(s, i);
      if !h.ok then ScanBareRefs(s, i + 1, ctx, refs)
      else
        var id := BareRefId(refs, h.num, ctx);
        ScanBareRefs(s, h.end, ctx, if id == "" then refs else AddRef(refs, id, ClosesBefore(s, i), ""))
  }

  function ScanBasecampUrls(s: string, i: nat, refs: seq<Ref>): seq<Ref>
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then refs
    else
      var h := BasecampUrlAt(s, i);
      if !h.ok then ScanBasecampUrls(s, i + 1, refs)
      else ScanBasecampUrls(s, h.end, AddRef(refs, BasecampId(h.isMessage, h.num), ClosesBefore(s, i), h.project))
  }

  function ScanBcRefs(s: string, i: nat, refs: seq<Ref>): seq<Ref>
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then refs
    else
      var h := BcRefAt(s, i);
      if !h.ok then ScanBcRefs(s, i + 1, refs)
      else ScanBcRefs(s, h.end, AddRef(refs, BasecampId(false, h.num), ClosesBefore(s, i), ""))
  }

  // Every reference in a text, in the scripts' order: GitHub links, `repo#n`, bare `#n`,
  // Basecamp links, `BC<n>`; each pattern scans left to right, resuming after each match.
  function ExtractRefs(s: string, ctx: RefContext): seq<Ref>
  {
    ScanBcRefs(s, 0, ScanBasecampUrls(s, 0, ScanBareRefs(s, 0, ctx, ScanIssueRefs(s, 0, ctx, ScanGithubUrls(s, 0, ctx, [])))))
  }

  // Each target once.
  predicate Distinct(refs: seq<Ref>)
  {
    forall a, b :: 0 <= a < b < |refs| ==> refs[a].id != refs[b].id
  }

  lemma AddRefDistinct(refs: seq<Ref>, id: string, closes: bool, project: string)
    requires Distinct(refs)
    ensures Distinct(AddRef(refs, id, closes, project))
  {
  }

  // A closing reference stays closing: a later mention never downgrades it.
  lemma AddRefKeepsCloses(refs: seq<Ref>, id: string, closes: bool, project: string, k: nat)
    requires k < |refs| && refs[k].closes
    ensures var out := AddRef(refs, id, closes, project); exists j :: 0 <= j < |out| && out[j].id == refs[k].id && out[j].closes
  {
    var out := AddRef(refs, id, closes, project);
    assert out[k].id == refs[k].id && out[k].closes;
  }

  lemma ScanGithubUrlsDistinct(s: string, i: nat, ctx: RefContext, refs: seq<Ref>)
    requires i <= |s| && Distinct(refs)
    ensures Distinct(ScanGithubUrls(s, i, ctx, refs))
    decreases |s| - i
  {
    if i < |s| {
      var h := GithubUrlAt(s, i);
      if !h.ok { ScanGithubUrlsDistinct(s, i + 1, ctx, refs); }
      else {
        var id := GithubId(h.owner, h.repo, h.num, ctx.org);
        AddRefDistinct(refs, id, ClosesBefore(s, i), "");
        ScanGithubUrlsDistinct(s, h.end, ctx, AddRef(refs, id, ClosesBefore(s, i), ""));
      }
    }
  }

  lemma ScanIssueRefsDistinct(s: string, i: nat, ctx: RefContext, refs: seq<Ref>)
    requires i <= |s| && Distinct(refs)
    ensures Distinct(ScanIssueRefs(s, i, ctx, refs))
    decreases |s| - i
  {
    if i < |s| {
      var h := IssueRefAt(s, i);
      if !h.ok { ScanIssueRefsDistinct(s, i + 1, ctx, refs); }
      else {
        var id := IssueRefId(h, ctx);
        if id != "" { AddRefDistinct(refs, id, ClosesBefore(s, i), ""); }
        ScanIssueRefsDistinct(s, h.end, ctx, if id == "" then refs else AddRef(refs, id, ClosesBefore(s, i), ""));
      }
    }
  }

  lemma ScanBareRefsDistinct(s: string, i: nat, ctx: RefContext, refs: seq<Ref>)
    requires i <= |s| && Distinct(refs)
    ensures Distinct(ScanBareRefs(s, i, ctx, refs))
    decreases |s| - i
  {
    if i < |s| {
      var h := BareRefAt(s, i);
      if !h.ok { ScanBareRefsDistinct(s, i + 1, ctx, refs); }
      else {
        var id := BareRefId(refs, h.num, ctx);
        if id != "" { AddRefDistinct(refs, id, ClosesBefore(s, i), ""); }
        ScanBareRefsDistinct(s, h.end, ctx, if id == "" then refs else AddRef(refs, id, ClosesBefore(s, i), ""));
      }
    }
  }

  lemma ScanBasecampUrlsDistinct(s: string, i: nat, refs: seq<Ref>)
    requires i <= |s| && Distinct(refs)
    ensures Distinct(ScanBasecampUrls(s, i, refs))
    decreases |s| - i
  {
    if i < |s| {
      var h := BasecampUrlAt(s, i);
      if !h.ok { ScanBasecampUrlsDistinct(s, i + 1, refs); }
      else {
        var id := BasecampId(h.isMessage, h.num);
        AddRefDistinct(refs, id, ClosesBefore(s, i), h.project);
        ScanBasecampUrlsDistinct(s, h.end, AddRef(refs, id, ClosesBefore(s, i), h.project));
      }
    }
  }

  lemma ScanBcRefsDistinct(s: string, i: nat, refs: seq<Ref>)
    requires i <= |s| && Distinct(refs)
    ensures Distinct(ScanBcRefs(s, i, refs))
    decreases |s| - i
  {
    if i < |s| {
      var h := BcRefAt(s, i);
      if !h.ok { ScanBcRefsDistinct(s, i + 1, refs); }
      else {
        var id := BasecampId(false, h.num);
        AddRefDistinct(refs, id, ClosesBefore(s, i), "");
        ScanBcRefsDistinct(s, h.end, AddRef(refs, id, ClosesBefore(s, i), ""));
      }
    }
  }

  // The references of a text name each target once.
  lemma ExtractRefsDistinct(s: string, ctx: RefContext)
    ensures Distinct(ExtractRefs(s, ctx))
  {
    ScanGithubUrlsDistinct(s, 0, ctx, []);
    var a := ScanGithubUrls(s, 0, ctx, []);
    ScanIssueRefsDistinct(s, 0, ctx, a);
    var b := ScanIssueRefs(s, 0, ctx, a);
    ScanBareRefsDistinct(s, 0, ctx, b);
    var c := ScanBareRefs(s, 0, ctx, b);
    ScanBasecampUrlsDistinct(s, 0, c);
    ScanBcRefsDistinct(s, 0, ScanBasecampUrls(s, 0, c));
  }

  // ---------------------------------------------------------------- comment headings
  // `^### (.+?) · (\S+)\s*$`, multiline. The author is the shortest run with no line end that
  // ` · <when>` follows; `\s*` is greedy, so the heading ends at the last line end in the
  // whitespace after `<when>`, or at the end of the text.

  datatype Head = Head(ok: bool, end: nat, author: string, at: string)

  const NoHead: Head := Head(false, 0, "", "")

  function LastLineEnd(s: string, lo: nat, hi: nat): int
    requires lo <= hi <= |s|
    ensures LastLineEnd(s, lo, hi) == -1 || lo <= LastLineEnd(s, lo, hi) < hi
    decreases hi
  {
    if hi <= lo then -1 else if LineEnd(s[hi - 1] as int) then hi - 1 else LastLineEnd(s, lo, hi - 1)
  }

  function HeadTailEnd(s: string, t: nat): int
    requires t <= |s|
    ensures HeadTailEnd(s, t) == -1 || t < HeadTailEnd(s, t) <= |s|
  {
    var e := SolidRunEnd(s, t);
    if e == t then -1
    else
      var w := SpaceRunEnd(s, e);
      if w == |s| then w else LastLineEnd(s, e, w)
  }

  function HeadFrom(s: string, a: nat, m: nat): Head
    requires a < m <= |s|
    ensures HeadFrom(s, a, m).ok ==> m < HeadFrom(s, a, m).end <= |s|
    decreases |s| - m
  {
    var end := if At(s, m, " \u00b7 ") then HeadTailEnd(s, m + 3) else -1;
    if end >= 0 then Head(true, end, s[a..m], s[m + 3..SolidRunEnd(s, m + 3)])
    else if m >= |s| || LineEnd(s[m] as int) then NoHead
    else HeadFrom(s, a, m + 1)
  }

  function HeadAt(s: string, p: nat): Head
    requires p <= |s|
    ensures HeadAt(s, p).ok ==> p < HeadAt(s, p).end <= |s|
  {
    if p > 0 && !LineEnd(s[p - 1] as int) then NoHead
    else if !At(s, p, "### ") then NoHead
    else
      var a := p + 4;
      if a >= |s| || LineEnd(s[a] as int) then NoHead else HeadFrom(s, a, a + 1)
  }

  datatype Segment = Segment(author: string, at: string, text: string)

  function NextHead(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= NextHead(s, i) <= |s|
    decreases |s| - i
  {
    if i >= |s| then |s| else if HeadAt(s, i).ok then i else NextHead(s, i + 1)
  }

  function CommentsFrom(s: string, p: nat): seq<Segment>
    requires p <= |s|
    decreases |s| - p
  {
    if p >= |s| then []
    else
      var h := HeadAt(s, p);
      if !h.ok then []
      else
        var q := NextHead(s, h.end);
        [Segment(h.author, h.at, s[h.end..q])] + CommentsFrom(s, q)
  }

  // An item's body: the description, then one segment per comment heading.
  function SplitSegments(body: string, author: string, at: string): seq<Segment>
  {
    var first := NextHead(body, 0);
    [Segment(author, at, body[..first])] + CommentsFrom(body, first)
  }

  // ---------------------------------------------------------------- frontmatter YAML

  function TrimStart(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= TrimStart(s, i) <= |s|
    decreases |s| - i
  {
    if i >= |s| || !Space(s[i] as int) then i else TrimStart(s, i + 1)
  }

  function TrimEnd(s: string, lo: nat, e: nat): nat
    requires lo <= e <= |s|
    ensures lo <= TrimEnd(s, lo, e) <= e
    decreases e - lo
  {
    if e > lo && Space(s[e - 1] as int) then TrimEnd(s, lo, e - 1) else e
  }

  // String.prototype.trim.
  function Trim(s: string): string
  {
    var a := TrimStart(s, 0);
    s[a..TrimEnd(s, a, |s|)]
  }

  predicate Mark(c: int) { c == 58 || c == 35 || c == 44 || c == 91 || c == 93 || c == 34 || c == 39 }

  predicate HasMark(s: string)
  {
    exists k :: 0 <= k < |s| && Mark(s[k] as int)
  }

  predicate HasDoubleQuote(s: string)
  {
    exists k :: 0 <= k < |s| && s[k] == '"'
  }

  // A value is written plain unless it is empty, holds a mark, or starts or ends with whitespace;
  // then quoted, single quotes when it holds a double quote.
  predicate IsPlain(t: string)
  {
    |t| > 0 && !HasMark(t) && !Space(t[0] as int) && !Space(t[|t| - 1] as int)
  }

  function FormatScalar(t: string): string
  {
    if IsPlain(t) then t else if HasDoubleQuote(t) then "'" + t + "'" else "\"" + t + "\""
  }

  function FormatItems(items: seq<string>, i: nat): string
    decreases |items| - i
  {
    if i >= |items| then ""
    else if i + 1 >= |items| then FormatScalar(items[i])
    else FormatScalar(items[i]) + ", " + FormatItems(items, i + 1)
  }

  function FormatList(items: seq<string>): string
  {
    "[" + FormatItems(items, 0) + "]"
  }

  // Trimmed, and unquoted when it is `"..."` or `'...'` with no line end inside.
  function ParseScalar(raw: string): string
  {
    var v := Trim(raw);
    if |v| < 2 then v
    else if (v[0] != '"' && v[0] != '\'') || v[|v| - 1] != v[0] then v
    else if NoLineEnd(v[1..|v| - 1]) then v[1..|v| - 1]
    else v
  }

  function CommaFrom(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= CommaFrom(s, i) <= |s|
    decreases |s| - i
  {
    if i >= |s| || s[i] == ',' then i else CommaFrom(s, i + 1)
  }

  function SplitItems(s: string, i: nat): seq<string>
    requires i <= |s|
    decreases |s| - i
  {
    var c := CommaFrom(s, i);
    if c >= |s| then [ParseScalar(s[i..c])] else [ParseScalar(s[i..c])] + SplitItems(s, c + 1)
  }

  datatype YamlValue = YamlValue(isList: bool, scalar: string, items: seq<string>)

  function ParseValue(raw: string): YamlValue
  {
    var v := Trim(raw);
    if |v| < 2 || v[0] != '[' || v[|v| - 1] != ']' then YamlValue(false, ParseScalar(v), [])
    else
      var inner := Trim(v[1..|v| - 1]);
      if |inner| == 0 then YamlValue(true, "", []) else YamlValue(true, "", SplitItems(inner, 0))
  }

  // Trim leaves a text with no whitespace at either end as it is, and drops a single leading space.
  lemma TrimSolid(t: string)
    requires |t| > 0 && !Space(t[0] as int) && !Space(t[|t| - 1] as int)
    ensures Trim(t) == t
  {
    assert TrimStart(t, 0) == 0;
    assert TrimEnd(t, 0, |t|) == |t|;
  }

  lemma TrimLeadingSpace(t: string)
    requires |t| > 0 && !Space(t[0] as int) && !Space(t[|t| - 1] as int)
    ensures Trim(" " + t) == t
  {
    var u := " " + t;
    assert TrimStart(u, 1) == 1;
    assert TrimStart(u, 0) == 1;
    assert TrimEnd(u, 1, |u|) == |u|;
    assert u[1..] == t;
  }

  lemma FormattedIsSolid(t: string)
    ensures |FormatScalar(t)| > 0
    ensures !Space(FormatScalar(t)[0] as int) && !Space(FormatScalar(t)[|FormatScalar(t)| - 1] as int)
  {
  }

  // A value written by FormatScalar reads back as it was, when it has no line end.
  lemma ScalarRoundTrip(t: string)
    requires NoLineEnd(t)
    ensures ParseScalar(FormatScalar(t)) == t
  {
    var f := FormatScalar(t);
    FormattedIsSolid(t);
    TrimSolid(f);
    if IsPlain(t) {
      assert t[0] != '"' && t[0] != '\'' by { assert !Mark(t[0] as int); }
    } else {
      assert f[1..|f| - 1] == t;
    }
  }

  // After `key:`, a written scalar reads back: the space after the colon is trimmed, and a plain
  // value never looks like a list.
  lemma ValueRoundTrip(t: string)
    requires NoLineEnd(t)
    ensures ParseValue(" " + FormatScalar(t)) == YamlValue(false, t, [])
  {
    var f := FormatScalar(t);
    FormattedIsSolid(t);
    TrimLeadingSpace(f);
    TrimSolid(f);
    ScalarRoundTrip(t);
    if IsPlain(t) { assert f[0] != '[' by { assert !Mark(f[0] as int); } }
  }

  // ---------------------------------------------------------------- frontmatter lines

  datatype LineKind = Blank | Item | Pair | Bad
  datatype YamlLine = YamlLine(kind: LineKind, key: string, rest: string)

  predicate KeyChar(c: int) { 97 <= c <= 122 || c == 95 }

  function KeyRunEnd(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= KeyRunEnd(s, i) <= |s|
    decreases |s| - i
  {
    if i >= |s| || !KeyChar(s[i] as int) then i else KeyRunEnd(s, i + 1)
  }

  // `^\s+-\s+(.+)$`: the greedy `\s+` leaves the rest as the text; when that is empty, `.+`
  // takes the last whitespace, if it is not a line end.
  function ItemStart(line: string): int
    ensures ItemStart(line) == -1 || 0 <= ItemStart(line) < |line|
  {
    var i := SpaceRunEnd(line, 0);
    if i == 0 || !At(line, i, "-") then -1
    else
      var j := SpaceRunEnd(line, i + 1);
      if j == i + 1 then -1
      else if j < |line| then (if NoLineEnd(line[j..]) then j else -1)
      else if j - 1 >= i + 2 && !LineEnd(line[j - 1] as int) then j - 1
      else -1
  }

  // `^\s*(#.*)?$` is blank or a comment; then an item; then `^([a-z_]+):(.*)$`.
  function ClassifyLine(line: string): YamlLine
  {
    var s := SpaceRunEnd(line, 0);
    if s == |line| || (At(line, s, "#") && NoLineEnd(line[s + 1..])) then YamlLine(Blank, "", "")
    else
      var t := ItemStart(line);
      if t >= 0 then YamlLine(Item, "", line[t..])
      else
        var k := KeyRunEnd(line, 0);
        if k > 0 && At(line, k, ":") && NoLineEnd(line[k + 1..]) then YamlLine(Pair, line[..k], line[k + 1..])
        else YamlLine(Bad, "", "")
  }

  datatype YamlEntry = YamlEntry(key: string, value: YamlValue)
  datatype YamlProblem = YamlProblem(line: nat, kind: string, text: string)
  datatype Yaml = Yaml(entries: seq<YamlEntry>, problems: seq<YamlProblem>)

  function EntryIndex(entries: seq<YamlEntry>, key: string, i: nat): int
    ensures EntryIndex(entries, key, i) == -1 || i <= EntryIndex(entries, key, i) < |entries|
    decreases |entries| - i
  {
    if i >= |entries| then -1 else if entries[i].key == key then i else EntryIndex(entries, key, i + 1)
  }

  // A new key goes last; a key seen before keeps its place (a JavaScript object's order).
  function SetEntry(entries: seq<YamlEntry>, key: string, value: YamlValue): seq<YamlEntry>
  {
    var k := EntryIndex(entries, key, 0);
    if k < 0 then entries + [YamlEntry(key, value)] else entries[..k] + [YamlEntry(key, value)] + entries[k + 1..]
  }

  // An `- item` line adds to the list being read: the entry whose key is listKey (keys are unique).
  function PushItemFrom(entries: seq<YamlEntry>, i: nat, listKey: string, item: string): seq<YamlEntry>
    decreases |entries| - i
  {
    if i >= |entries| then []
    else
      var e := entries[i];
      [if e.key == listKey then YamlEntry(e.key, YamlValue(true, "", e.value.items + [item])) else e] +
      PushItemFrom(entries, i + 1, listKey, item)
  }

  function PushItem(entries: seq<YamlEntry>, listKey: string, item: string): seq<YamlEntry>
  {
    PushItemFrom(entries, 0, listKey, item)
  }

  function ReadPair(yaml: Yaml, i: nat, key: string, rest: string): Yaml
  {
    var value := if |Trim(rest)| == 0 then YamlValue(true, "", []) else ParseValue(rest);
    var problems := if EntryIndex(yaml.entries, key, 0) >= 0 then yaml.problems + [YamlProblem(i, "duplicate", key)] else yaml.problems;
    Yaml(SetEntry(yaml.entries, key, value), problems)
  }

  // Lines in order; a `key:` with nothing after it opens a list its `- item` lines fill.
  function ReadLines(lines: seq<string>, i: nat, listKey: string, yaml: Yaml): Yaml
    decreases |lines| - i
  {
    if i >= |lines| then yaml
    else
      var line := ClassifyLine(lines[i]);
      if line.kind == Blank then ReadLines(lines, i + 1, listKey, yaml)
      else if line.kind == Item && listKey != "" then
        ReadLines(lines, i + 1, listKey, Yaml(PushItem(yaml.entries, listKey, ParseScalar(line.rest)), yaml.problems))
      else if line.kind == Pair then
        ReadLines(lines, i + 1, if |Trim(line.rest)| == 0 then line.key else "", ReadPair(yaml, i, line.key, line.rest))
      else
        ReadLines(lines, i + 1, listKey, Yaml(yaml.entries, yaml.problems + [YamlProblem(i, "bad", Trim(lines[i]))]))
  }

  function ParseYaml(lines: seq<string>): Yaml
  {
    ReadLines(lines, 0, "", Yaml([], []))
  }

  // ---------------------------------------------------------------- field formats

  predicate IdStart(c: int) { 97 <= c <= 122 || 48 <= c <= 57 }
  predicate IdChar(c: int) { IdStart(c) || c == 46 || c == 95 || c == 45 }

  // `^[a-z0-9][a-z0-9._-]*$`
  predicate IsId(s: string)
  {
    |s| > 0 && IdStart(s[0] as int) && forall k :: 1 <= k < |s| ==> IdChar(s[k] as int)
  }

  // `\d{n}` at i: a digit at i, then n - 1 more.
  predicate DigitsAt(s: string, i: nat, n: nat)
    decreases n
  {
    n == 0 || (i < |s| && Digit(s[i] as int) && DigitsAt(s, i + 1, n - 1))
  }

  predicate DayPart(s: string)
  {
    DigitsAt(s, 0, 4) && At(s, 4, "-") && DigitsAt(s, 5, 2) && At(s, 7, "-") && DigitsAt(s, 8, 2)
  }

  function AfterSeconds(s: string, p: nat): nat
    requires p <= |s|
    ensures p <= AfterSeconds(s, p) <= |s|
  {
    if !At(s, p, ":") || !DigitsAt(s, p + 1, 2) then p
    else if !At(s, p + 3, ".") then p + 3
    else if DigitRunEnd(s, p + 4) > p + 4 then DigitRunEnd(s, p + 4) else p + 3
  }

  function AfterZone(s: string, p: nat): int
  {
    if At(s, p, "Z") then p + 1
    else if !At(s, p, "+") && !At(s, p, "-") then p
    else if !DigitsAt(s, p + 1, 2) then -1
    else
      var c := if At(s, p + 3, ":") then p + 4 else p + 3;
      if DigitsAt(s, c, 2) then c + 2 else -1
  }

  // `^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$`
  predicate IsWhen(s: string)
  {
    DayPart(s) &&
    (|s| == 10 ||
     (At(s, 10, "T") && DigitsAt(s, 11, 2) && At(s, 13, ":") && DigitsAt(s, 14, 2) &&
      AfterZone(s, AfterSeconds(s, 16)) == |s|))
  }

  // `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$`
  predicate IsStamp(s: string)
  {
    |s| == 16 && DayPart(s) && At(s, 10, " ") && DigitsAt(s, 11, 2) && At(s, 13, ":") && DigitsAt(s, 14, 2)
  }

  function EqualsCount(s: string): nat
  {
    if |s| == 0 then 0 else (if s[0] == '=' then 1 else 0) + EqualsCount(s[1..])
  }

  function FirstEquals(s: string, i: nat): nat
    requires i <= |s|
    ensures i <= FirstEquals(s, i) <= |s|
    decreases |s| - i
  {
    if i >= |s| || s[i] == '=' then i else FirstEquals(s, i + 1)
  }

  // `^[^=]+=[^=]+$`: exactly one `=`, with text before it and after it.
  predicate IsAlias(s: string)
  {
    EqualsCount(s) == 1 && FirstEquals(s, 0) > 0 && FirstEquals(s, 0) + 1 < |s|
  }

  // `^[\w.-]+(\/[\w.-]+)?$`
  predicate IsWatchRepo(s: string)
  {
    var a := RepoRunEnd(s, 0);
    a > 0 && (a == |s| || (At(s, a, "/") && RepoRunEnd(s, a + 1) > a + 1 && RepoRunEnd(s, a + 1) == |s|))
  }

  // `^([1-9]|[1-5]\d|60)$`
  predicate IsMinutes(s: string)
  {
    (|s| == 1 && '1' <= s[0] <= '9') || (|s| == 2 && (('1' <= s[0] <= '5' && Digit(s[1] as int)) || s == "60"))
  }

  lemma MinutesAreOneToSixty()
    ensures IsMinutes("1") && IsMinutes("59") && IsMinutes("60")
    ensures !IsMinutes("0") && !IsMinutes("61") && !IsMinutes("05") && !IsMinutes("")
  {
  }

  predicate MatchesFormat(format: string, v: string)
  {
    if format == "id" then IsId(v)
    else if format == "text" then exists k :: 0 <= k < |v| && !Space(v[k] as int)
    else if format == "alias" then IsAlias(v)
    else if format == "watch-repo" then IsWatchRepo(v)
    else if format == "repo" then |v| > 0 && RepoRunEnd(v, 0) == |v|
    else if format == "digits" then |v| > 0 && AllDigits(v)
    else if format == "minutes" then IsMinutes(v)
    else if format == "url" then At(v, 0, "http://") || At(v, 0, "https://")
    else if format == "when" then IsWhen(v)
    else if format == "stamp" then IsStamp(v)
    else false
  }

  // The first problem with a scalar field: missing or empty, outside its enum, then its format.
  function ScalarProblem(isList: bool, v: string, hasEnum: bool, allowed: seq<string>, format: string): string
  {
    if isList || |v| == 0 then "empty"
    else if hasEnum && v !in allowed then "enum"
    else if format != "" && !MatchesFormat(format, v) then "format"
    else ""
  }

  function IdFromFile(name: string, folder: string): string
  {
    if name == "README" then folder else name
  }

  // ---------------------------------------------------------------- order

  // JavaScript's string order: code units, a prefix first.
  function CompareText(a: string, b: string): int
    ensures -1 <= CompareText(a, b) <= 1
  {
    if |a| == 0 then (if |b| > 0 then -1 else 0)
    else if |b| == 0 then 1
    else if a[0] != b[0] then (if a[0] < b[0] then -1 else 1)
    else CompareText(a[1..], b[1..])
  }

  lemma CompareAntisymmetric(a: string, b: string)
    ensures CompareText(a, b) == -CompareText(b, a)
    ensures CompareText(a, b) == 0 <==> a == b
  {
    if |a| > 0 && |b| > 0 && a[0] == b[0] {
      CompareAntisymmetric(a[1..], b[1..]);
      assert a == [a[0]] + a[1..];
      assert b == [b[0]] + b[1..];
    }
  }

  // ---------------------------------------------------------------- refresh, briefs, digest

  const StaleLockMs: int := 15 * 60 * 1000
  predicate IsLockStale(now: int, lockedAt: int) { now - lockedAt >= StaleLockMs }

  const QuietMs: int := 14 * 24 * 60 * 60 * 1000
  predicate IsQuiet(hasUpdated: bool, todayMs: int, updatedMs: int) { hasUpdated && todayMs - updatedMs >= QuietMs }

  predicate IsOverdue(due: string, today: string) { due != "" && CompareText(due, today) < 0 }
  predicate IsDueSoon(due: string, today: string, days: int) { due != "" && CompareText(due, today) >= 0 && days <= 7 }
  predicate IsStale(touched: string, days: int) { touched != "" && days >= 30 }

  // An item cannot be both overdue and due soon.
  lemma OverdueIsNotDueSoon(due: string, today: string, days: int)
    ensures !(IsOverdue(due, today) && IsDueSoon(due, today, days))
  {
  }

  predicate IsBotName(p: string) { |p| >= 5 && p[|p| - 5..] == "[bot]" }
  predicate WaitsOn(hasAuthor: bool, isMe: bool, isBot: bool) { hasAuthor && !isMe && !isBot }
  predicate HoldsUp(owners: int, anyIsMe: bool) { owners > 0 && !anyIsMe }
  predicate IsListed(isBasecamp: bool, isAssigned: bool, isIssue: bool, watched: bool)
  {
    if isBasecamp then isAssigned else isIssue && watched
  }

  function RowsLeftOut(total: int): int { if total > 15 then total - 15 else 0 }

  // ---------------------------------------------------------------- the chart

  predicate Alnum(c: int) { Alpha(c) || Digit(c) }

  function NodeName(s: string): string
    ensures |NodeName(s)| == |s|
  {
    if |s| == 0 then "" else (if Alnum(s[0] as int) then [s[0]] else "_") + NodeName(s[1..])
  }

  function NodeId(id: string): string
  {
    "n_" + NodeName(id)
  }

  // A node id is a Mermaid-safe word: letters, digits and underscores only.
  lemma NodeNameIsSafe(s: string)
    ensures forall k :: 0 <= k < |NodeName(s)| ==> Alnum(NodeName(s)[k] as int) || NodeName(s)[k] == '_'
  {
    if |s| > 0 {
      NodeNameIsSafe(s[1..]);
      var head := if Alnum(s[0] as int) then [s[0]] else "_";
      assert NodeName(s) == head + NodeName(s[1..]);
    }
  }

  datatype Edge = Edge(from: string, to: string, closes: bool)

  function EdgeIndex(edges: seq<Edge>, from: string, to: string, i: nat): int
    ensures EdgeIndex(edges, from, to, i) == -1 || i <= EdgeIndex(edges, from, to, i) < |edges|
    ensures EdgeIndex(edges, from, to, i) >= 0 ==> edges[EdgeIndex(edges, from, to, i)].from == from && edges[EdgeIndex(edges, from, to, i)].to == to
    ensures EdgeIndex(edges, from, to, i) == -1 ==> forall k :: i <= k < |edges| ==> !(edges[k].from == from && edges[k].to == to)
    decreases |edges| - i
  {
    if i >= |edges| then -1
    else if edges[i].from == from && edges[i].to == to then i
    else EdgeIndex(edges, from, to, i + 1)
  }

  // One edge per pair, in the order first seen; `closes` wins.
  function AddEdge(edges: seq<Edge>, from: string, to: string, closes: bool): seq<Edge>
  {
    var k := EdgeIndex(edges, from, to, 0);
    if k < 0 then edges + [Edge(from, to, closes)]
    else edges[..k] + [Edge(edges[k].from, edges[k].to, edges[k].closes || closes)] + edges[k + 1..]
  }

  predicate DistinctEdges(edges: seq<Edge>)
  {
    forall a, b :: 0 <= a < b < |edges| ==> !(edges[a].from == edges[b].from && edges[a].to == edges[b].to)
  }

  lemma AddEdgeDistinct(edges: seq<Edge>, from: string, to: string, closes: bool)
    requires DistinctEdges(edges)
    ensures DistinctEdges(AddEdge(edges, from, to, closes))
  {
  }

  // ---------------------------------------------------------------- hub ids from Basecamp

  predicate SlugChar(c: int) { 97 <= c <= 122 || Digit(c) }

  // Lowered, each run of other characters one hyphen between kept ones, none at the ends.
  function SlugFrom(s: string, i: nat, started: bool, gap: bool): string
    decreases |s| - i
  {
    if i >= |s| then ""
    else if !SlugChar(s[i] as int) then SlugFrom(s, i + 1, started, started)
    else (if gap then "-" else "") + s[i..i + 1] + SlugFrom(s, i + 1, true, false)
  }

  function Slug(name: string): string
  {
    SlugFrom(Lower(name), 0, false, false)
  }

  // A slug is a-z, 0-9 and single hyphens between them: it starts and ends with a kept
  // character, and no two hyphens touch.
  predicate IsSlug(t: string)
  {
    (forall k :: 0 <= k < |t| ==> SlugChar(t[k] as int) || t[k] == '-') &&
    (|t| > 0 ==> t[0] != '-' && t[|t| - 1] != '-') &&
    (forall k :: 0 <= k < |t| - 1 ==> !(t[k] == '-' && t[k + 1] == '-'))
  }

  // The shape of what is left to emit: kept characters and hyphens, never a hyphen last or two
  // together, a hyphen first only once a character was kept, and then followed by a kept one.
  predicate SlugTail(t: string, started: bool)
  {
    (forall k :: 0 <= k < |t| ==> SlugChar(t[k] as int) || t[k] == '-') &&
    (|t| > 0 ==> t[|t| - 1] != '-') &&
    (!started && |t| > 0 ==> t[0] != '-') &&
    (forall k :: 0 <= k < |t| - 1 ==> !(t[k] == '-' && t[k + 1] == '-'))
  }

  lemma SlugFromShape(s: string, i: nat, started: bool, gap: bool)
    requires gap ==> started
    ensures SlugTail(SlugFrom(s, i, started, gap), started)
    decreases |s| - i
  {
    if i < |s| {
      if !SlugChar(s[i] as int) { SlugFromShape(s, i + 1, started, started); }
      else {
        SlugFromShape(s, i + 1, true, false);
        var rest := SlugFrom(s, i + 1, true, false);
        var head := (if gap then "-" else "") + s[i..i + 1];
        var t := head + rest;
        assert SlugFrom(s, i, started, gap) == t;
        assert head[|head| - 1] == s[i] && SlugChar(s[i] as int);
        forall k | 0 <= k < |t| - 1 ensures !(t[k] == '-' && t[k + 1] == '-') {
          if k + 1 < |head| { assert t[k + 1] == s[i]; }
          else if k + 1 == |head| { assert t[k] == s[i]; }
          else { assert t[k] == rest[k - |head|] && t[k + 1] == rest[k + 1 - |head|]; }
        }
        forall k | 0 <= k < |t| ensures SlugChar(t[k] as int) || t[k] == '-' {
          if k >= |head| { assert t[k] == rest[k - |head|]; }
        }
        if |rest| > 0 { assert t[|t| - 1] == rest[|rest| - 1]; }
      }
    }
  }

  lemma SlugIsSlug(name: string)
    ensures IsSlug(Slug(name))
  {
    SlugFromShape(Lower(name), 0, false, false);
  }

  // ---------------------------------------------------------------- follow

  // A followed reference: listed to fetch, another org's, synced in full already, or pulled.
  function FollowKind(id: string, org: string, owned: bool): string
  {
    if At(id, 0, "bc-") then "basecamp"
    else
      var gh := ParseGithubId(id, org);
      if !gh.ok || gh.owner != org then "external" else if owned then "owned" else "pull"
  }

  function TodoProject(linkProject: string, elsewhere: string, hubProjects: seq<string>): string
  {
    if linkProject != "" then linkProject
    else if elsewhere != "" then elsewhere
    else if |hubProjects| == 1 then hubProjects[0]
    else ""
  }

  predicate OccursFrom(s: string, w: string, i: nat)
    decreases |s| - i
  {
    i + |w| <= |s| && (s[i..i + |w|] == w || OccursFrom(s, w, i + 1))
  }

  // A transferred issue answers at its old path: its page is not under `/<org>/<repo>/issues/`.
  predicate MovedAway(htmlUrl: string, org: string, repo: string)
  {
    !OccursFrom(Lower(htmlUrl), Lower("/" + org + "/" + repo + "/issues/"), 0)
  }

  predicate IsRootItem(isBasecamp: bool, ownedRepo: bool) { isBasecamp || ownedRepo }
  predicate IsPruned(isGithub: bool, isRoot: bool, visited: bool) { isGithub && !isRoot && !visited }
  predicate IsHubFor(hubId: string, followed: seq<string>, repo: string) { hubId == repo || repo in followed }

  // ---------------------------------------------------------------- small rules

  function TextOr(v: string, fallback: string): string { if v == "" then fallback else v }

  function LaterText(a: string, b: string): string { if CompareText(a, b) < 0 then b else a }

  function EarlierPresent(a: string, b: string): string
  {
    if a == "" then b else if b == "" then a else if CompareText(b, a) < 0 then b else a
  }

  predicate AutoSyncOf(value: string) { value != "false" }

  // The GitHub org work/README.md names (`org:`), or SimpleApps' when it names none.
  const DefaultOrg: string := "simpleapps-com"

  function OrgOf(value: string): string { TextOr(value, DefaultOrg) }

  // How often the pane checks: `sync_minutes`, validated as 1 to 60, else 5.
  function SyncMinutesOf(isSet: bool, minutes: int): int { if isSet then minutes else 5 }

  function ProjectOfRef(ref: string): string
  {
    if !At(ref, 0, "basecamp:") then ""
    else
      var d := DigitRunEnd(ref, 9);
      if d > 9 && At(ref, d, "/") then ref[9..d] else ""
  }

  predicate IsAutoHub(summary: string) { At(summary, 0, "Auto-created by work ") }
  predicate IsVisibleName(name: string) { !At(name, 0, ".") }
  predicate IsEmptyHub(others: seq<string>, visibleItems: int)
  {
    (forall k :: 0 <= k < |others| ==> others[k] == "items") && visibleItems == 0
  }

  // The digits of the first `/projects/<n>/` in a URL.
  function ProjectInUrlFrom(url: string, i: nat): string
    requires i <= |url|
    decreases |url| - i
  {
    if i >= |url| then ""
    else if At(url, i, "/projects/") && DigitRunEnd(url, i + 10) > i + 10 && At(url, DigitRunEnd(url, i + 10), "/")
    then url[i + 10..DigitRunEnd(url, i + 10)]
    else ProjectInUrlFrom(url, i + 1)
  }

  function ProjectInUrl(url: string): string { ProjectInUrlFrom(url, 0) }

  // A brief's cell: `|` escaped, each run of whitespace one space.
  function BriefCellFrom(s: string, i: nat): string
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then ""
    else if Space(s[i] as int) then " " + BriefCellFrom(s, SpaceRunEnd(s, i))
    else (if s[i] == '|' then "\\|" else s[i..i + 1]) + BriefCellFrom(s, i + 1)
  }

  function BriefCell(text: string): string { BriefCellFrom(text, 0) }

  predicate MarkersInOrder(start: int, end: int) { start != -1 && end >= start }

  function LastSet(flags: seq<bool>, i: nat): int
    requires i <= |flags|
    ensures -1 <= LastSet(flags, i) < i
    decreases i
  {
    if i == 0 then -1 else if flags[i - 1] then i - 1 else LastSet(flags, i - 1)
  }

  function LastMineIndex(mine: seq<bool>): int { LastSet(mine, |mine|) }

  predicate IsUnfetched(id: string, known: bool) { At(id, 0, "bc-") && !known }
  predicate IsMine(ownedRepo: bool, anyIsMe: bool) { ownedRepo || anyIsMe }

  function ImpactOrder(blockedA: int, blockedB: int, dependentsA: int, dependentsB: int, sinceA: string, sinceB: string): int
  {
    if blockedA != blockedB then blockedB - blockedA
    else if dependentsA != dependentsB then dependentsB - dependentsA
    else CompareText(TextOr(sinceA, "9"), TextOr(sinceB, "9"))
  }

  function IssueOrder(repoA: string, repoB: string, numberA: int, numberB: int): int
  {
    if CompareText(repoA, repoB) != 0 then CompareText(repoA, repoB) else numberA - numberB
  }

  // Digits as Number prints them: leading zeros dropped, one zero kept.
  function NumberTextFrom(d: string, i: nat): string
    requires i <= |d|
    decreases |d| - i
  {
    if i + 1 < |d| && d[i] == '0' then NumberTextFrom(d, i + 1) else d[i..]
  }

  function NumberText(digits: string): string { NumberTextFrom(digits, 0) }

  function ShortRef(id: string, org: string): string
  {
    var gh := ParseGithubId(id, org);
    if gh.ok then gh.repo + "#" + NumberText(gh.digits) else TodoLabel(id)
  }

  function LabelFrom(s: string, i: nat): string
    decreases |s| - i
  {
    if i >= |s| then ""
    else (if s[i] == '"' then "#quot;" else if s[i] == '<' || s[i] == '>' then "" else s[i..i + 1]) + LabelFrom(s, i + 1)
  }

  function ChartLabel(text: string): string { LabelFrom(text, 0) }

  function ChartTitle(title: string): string
  {
    if |title| > 48 then title[..47] + "\u2026" else title
  }

  function ChartRef(id: string): string
  {
    var gh := ParseGithubId(id, "");
    if !gh.ok then TodoLabel(id) else id[3..LastHyphen(id, |id|)] + "#" + gh.digits
  }

  function ArrowOf(closes: bool): string { if closes then "==>" else "-.->" }

  function HtmlFrom(s: string, i: nat): string
    decreases |s| - i
  {
    if i >= |s| then ""
    else
      (if s[i] == '&' then "&amp;" else if s[i] == '<' then "&lt;" else if s[i] == '>' then "&gt;" else s[i..i + 1]) +
      HtmlFrom(s, i + 1)
  }

  function HtmlText(text: string): string { HtmlFrom(text, 0) }

  function IssueKind(isPull: bool): string { if isPull then "pull" else "issue" }
  function StatusOf(closed: bool): string { if closed then "closed" else "open" }

  // A synced repo's item that is no longer open: `<prefix><digits>`, not among the open ones.
  predicate IsClosedItem(id: string, prefix: string, open: bool)
  {
    At(id, 0, prefix) && |id| > |prefix| && AllDigits(id[|prefix|..]) && !open
  }

  function OrUnknown(name: string): string { TextOr(name, "unknown") }

  function HubIdFor(projectName: string, project: string): string
  {
    TextOr(Slug(projectName), "basecamp-" + project)
  }

  // `<br\s*\/?>`, ignoring case: where it ends, or -1.
  function BrEnd(s: string, i: nat): int
    requires i <= |s|
    ensures BrEnd(s, i) == -1 || i < BrEnd(s, i) <= |s|
  {
    if i + 3 > |s| || Lower(s[i..i + 3]) != "<br" then -1
    else
      var j := SpaceRunEnd(s, i + 3);
      var k := if At(s, j, "/") then j + 1 else j;
      if At(s, k, ">") then k + 1 else -1
  }

  function PlainFrom(s: string, i: nat): string
    requires i <= |s|
    decreases |s| - i
  {
    if i >= |s| then ""
    else if BrEnd(s, i) > 0 then "\n" + PlainFrom(s, BrEnd(s, i))
    else s[i..i + 1] + PlainFrom(s, i + 1)
  }

  function PlainText(html: string): string { PlainFrom(html, 0) }
}
