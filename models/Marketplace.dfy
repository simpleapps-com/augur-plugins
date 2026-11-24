// The model of this repo: what makes the augur marketplace valid. Hand-written Dafny, written
// before the code (wiki Proofs). `scripts/rules.ts` is proved with LemmaScript and linked to it
// in `models/links/scripts-rules.dfy`. Nothing is generated from this file.
//
// Each rule's source of truth: wiki Plugin-Format (versions, connectors) and Skill-Authoring
// (skill frontmatter), which in turn cite Anthropic's docs.

module Marketplace {

  // ---------------------------------------------------------------- characters
  // Text is UTF-16 code units, as in JavaScript (lemmascript.json "javascript-utf16").

  predicate DigitCode(c: int) { 48 <= c <= 57 }          // 0-9
  predicate LowerCode(c: int) { 97 <= c <= 122 }         // a-z
  predicate NameCode(c: int) { LowerCode(c) || DigitCode(c) || c == 45 }  // a-z, 0-9, -

  predicate DigitText(s: string)
  {
    forall k :: 0 <= k < |s| ==> DigitCode(s[k] as int)
  }

  // ---------------------------------------------------------------- CalVer
  // A plugin's version, `YYYY.M.seq`: a four-digit year, a month 1 to 12 and a release number at
  // least 1, none with a leading zero. The platform's rule (atlas models/Values.dfy "CalVer",
  // proved there in packages/utils calver.ts), adopted here 2026-11-22.

  predicate YearText(y: string)
  {
    |y| == 4 && DigitText(y) && y[0] != '0'
  }

  predicate MonthText(m: string)
  {
    (|m| == 1 && '1' <= m[0] <= '9') || m == "10" || m == "11" || m == "12"
  }

  predicate SeqText(q: string)
  {
    |q| > 0 && DigitText(q) && q[0] != '0'
  }

  // The year is s[..4]; the month ends at the second dot, at 6 or 7; the rest is the release.
  predicate IsCalVer(s: string)
  {
    |s| >= 8 && YearText(s[..4]) && s[4] == '.' &&
    ((s[6] == '.' && MonthText(s[5..6]) && SeqText(s[7..])) ||
     (|s| >= 9 && s[7] == '.' && MonthText(s[5..7]) && SeqText(s[8..])))
  }

  // Every version shipped so far is one, and a zero-padded month is not.
  lemma ShippedVersionsAreCalVer()
    ensures IsCalVer("2026.11.1") && IsCalVer("2026.11.2")
    ensures !IsCalVer("2026.01.1") && !IsCalVer("2026.13.1") && !IsCalVer("2026.11.0")
  {
    assert YearText("2026");
    assert "2026.01.1"[5..7] == "01" && "2026.01.1"[6] != '.';
  }

  // ---------------------------------------------------------------- skills
  // claude.ai accepts only these SKILL.md frontmatter keys; any other is a hard error there.

  predicate IsSkillKey(k: string)
  {
    k == "name" || k == "description" || k == "license" ||
    k == "compatibility" || k == "metadata" || k == "allowed-tools"
  }

  // A skill name: 1 to 64 characters, a lowercase letter first, then a-z, 0-9 and hyphens.
  predicate IsSkillName(n: string)
  {
    1 <= |n| <= 64 && LowerCode(n[0] as int) &&
    forall k :: 1 <= k < |n| ==> NameCode(n[k] as int)
  }

  // `w` occurs in `s` starting at `i` or later.
  predicate OccursFrom(s: string, w: string, i: nat)
    decreases |s| - i
  {
    i + |w| <= |s| && (s[i..i + |w|] == w || OccursFrom(s, w, i + 1))
  }

  // A match at p is found by any search starting at or before p.
  lemma OccursFromFindsMatch(s: string, w: string, i: nat, p: nat)
    requires i <= p && p + |w| <= |s| && s[p..p + |w|] == w
    ensures OccursFrom(s, w, i)
    decreases p - i
  {
    if i < p { OccursFromFindsMatch(s, w, i + 1, p); }
  }

  // Anthropic reserves these words: a skill name MUST NOT contain them.
  predicate IsReservedName(n: string)
  {
    OccursFrom(n, "anthropic", 0) || OccursFrom(n, "claude", 0)
  }

  const MaxDescription: nat := 1024

  predicate DescriptionFits(length: nat)
  {
    length <= MaxDescription
  }

  // The 5K-token budget, measured in words (1 token is about 0.75 words): over 3,750 fails,
  // over 3,375 (90%) warns.
  datatype Budget = Fits | Near | Over

  function BudgetOf(words: nat): Budget
  {
    if words > 3750 then Over else if words > 3375 then Near else Fits
  }

  // ---------------------------------------------------------------- connectors
  // A connector URL: `https://<label>.augur-mcp.com/...`, the label one or more of a-z, 0-9, -.

  const Scheme: string := "https://"
  const Domain: string := ".augur-mcp.com/"

  // Where the host label that starts at `i` ends: the first index from `i` that is not a
  // label character, or the end.
  function LabelEnd(u: string, i: nat): nat
    requires i <= |u|
    ensures i <= LabelEnd(u, i) <= |u|
    decreases |u| - i
  {
    if i == |u| || !NameCode(u[i] as int) then i else LabelEnd(u, i + 1)
  }

  // The label ends at j when everything from i to j is a label character and j is not.
  lemma LabelEndIs(u: string, i: nat, j: nat)
    requires i <= j <= |u|
    requires forall k :: i <= k < j ==> NameCode(u[k] as int)
    requires j == |u| || !NameCode(u[j] as int)
    ensures LabelEnd(u, i) == j
    decreases j - i
  {
    if i < j { LabelEndIs(u, i + 1, j); }
  }

  predicate IsConnectorUrl(u: string)
  {
    |u| >= 8 && u[..8] == Scheme &&
    var j := LabelEnd(u, 8);
    j > 8 && j + 15 <= |u| && u[j..j + 15] == Domain
  }

  // The three shipped connectors pass, and a lookalike domain does not.
  lemma ShippedConnectorsPass()
    ensures IsConnectorUrl("https://intelligence.augur-mcp.com/mcp")
    ensures !IsConnectorUrl("https://augur-mcp.com/mcp")
    ensures !IsConnectorUrl("https://evil.example.com/.augur-mcp.com/")
  {
    var u := "https://intelligence.augur-mcp.com/mcp";
    LabelEndIs(u, 8, 20);
    var v := "https://augur-mcp.com/mcp";
    LabelEndIs(v, 8, 17);
    var w := "https://evil.example.com/.augur-mcp.com/";
    LabelEndIs(w, 8, 12);
    assert w[12..27] != Domain by { assert w[13] != Domain[1]; }
  }

  // ---------------------------------------------------------------- LSP plugins (GH36)
  // A plugin's .lsp.json ships to every installer, so no key in it may hold a secret: an
  // Intelephense licence, in either spelling (the server reads its own licence file instead).
  predicate IsSecretKey(k: string) { k == "licenceKey" || k == "licenseKey" }

  lemma SecretKeyExamples()
    ensures IsSecretKey("licenceKey") && IsSecretKey("licenseKey")
    ensures !IsSecretKey("maxMemory") && !IsSecretKey("licence") && !IsSecretKey("LicenceKey")
  {
  }

  // An LSP server's command is a binary: no spaces, unless it is an absolute path (Claude Code's
  // rule: "No spaces unless the value starts with `/`"), and never empty.
  predicate SpaceFrom(s: string, i: nat)
    decreases |s| - i
  {
    i < |s| && (s[i] as int == 32 || SpaceFrom(s, i + 1))
  }

  predicate IsLspCommand(c: string)
  {
    |c| > 0 && (c[0] as int == 47 || !SpaceFrom(c, 0))
  }

  lemma LspCommandExamples()
    ensures IsLspCommand("intelephense")
    ensures IsLspCommand("/opt/my tools/intelephense")
    ensures !IsLspCommand("intelephense --stdio")
    ensures !IsLspCommand("")
  {
    assert SpaceFrom("intelephense --stdio", 12);
  }
}
