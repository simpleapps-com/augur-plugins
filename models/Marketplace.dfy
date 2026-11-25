// The model of this repo: what makes the augur marketplace valid. Hand-written Dafny, written
// before the code (wiki Proofs). `scripts/rules.ts` is proved with LemmaScript and linked to it
// in `models/links/scripts-rules.dfy`. Nothing is generated from this file.
//
// Each rule's source of truth: wiki Plugin-Format (versions, connectors) and Skill-Authoring
// (skill frontmatter), which in turn cite Anthropic's docs. Scans come from the shared layer,
// Text.dfy.

include "Text.dfy"

module Marketplace {
  import opened Text

  // ---------------------------------------------------------------- characters
  // Text is UTF-16 code units, as in JavaScript (lemmascript.json "javascript-utf16").

  predicate DigitCode(c: int) { 48 <= c <= 57 }          // 0-9
  predicate LowerCode(c: int) { 97 <= c <= 122 }         // a-z
  predicate NameCode(c: int) { LowerCode(c) || DigitCode(c) || c == 45 }  // a-z, 0-9, -
  predicate NonSpaceCode(c: int) { c != 32 }                               // not a space

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
  // A connector URL is a SimpleApps service, `https://<label>.augur-mcp.com/...` (the label one or
  // more of a-z, 0-9, -), or a vendor's own MCP server, named here by a fixed prefix: its origin
  // and `/` (GH64, the owner, 2026-11-25: "allow named vendor hosts"). Only Semrush so far.

  const Scheme: string := "https://"
  const Domain: string := ".augur-mcp.com/"
  const SemrushRoot: string := "https://mcp.semrush.com/"

  // The host label starts at 8 and ends where the scan for label characters stops.
  predicate IsAugurUrl(u: string)
  {
    |u| >= 8 && u[..8] == Scheme &&
    var j := ScanEnd(u, 8, NameCode);
    j > 8 && j + 15 <= |u| && u[j..j + 15] == Domain
  }

  // A named vendor host: the URL starts with its root, trailing `/` included, so a longer host
  // (`mcp.semrush.com.example.io`) never matches.
  predicate IsVendorUrl(u: string)
  {
    |u| >= |SemrushRoot| && u[..|SemrushRoot|] == SemrushRoot
  }

  predicate IsConnectorUrl(u: string)
  {
    IsAugurUrl(u) || IsVendorUrl(u)
  }

  // The shipped connectors pass, and lookalike domains do not.
  lemma ShippedConnectorsPass()
    ensures IsConnectorUrl("https://intelligence.augur-mcp.com/mcp")
    ensures IsConnectorUrl("https://mcp.semrush.com/v2/mcp")
    ensures !IsConnectorUrl("https://augur-mcp.com/mcp")
    ensures !IsConnectorUrl("https://evil.example.com/.augur-mcp.com/")
    ensures !IsConnectorUrl("https://mcp.semrush.com.example.io/mcp")
  {
    var u := "https://intelligence.augur-mcp.com/mcp";
    ScanEndIs(u, 8, 20, NameCode);
    var s := "https://mcp.semrush.com/v2/mcp";
    assert s[..|SemrushRoot|] == SemrushRoot;
    var v := "https://augur-mcp.com/mcp";
    ScanEndIs(v, 8, 17, NameCode);
    assert v[..|SemrushRoot|] != SemrushRoot by { assert v[8] != SemrushRoot[8]; }
    var w := "https://evil.example.com/.augur-mcp.com/";
    ScanEndIs(w, 8, 12, NameCode);
    assert w[12..27] != Domain by { assert w[13] != Domain[1]; }
    assert w[..|SemrushRoot|] != SemrushRoot by { assert w[8] != SemrushRoot[8]; }
    var x := "https://mcp.semrush.com.example.io/mcp";
    ScanEndIs(x, 8, 11, NameCode);
    assert x[11..26] != Domain by { assert x[12] != Domain[1]; }
    assert x[..|SemrushRoot|] != SemrushRoot by { assert x[23] != SemrushRoot[23]; }
  }

  // ---------------------------------------------------------------- help (every skill and command)
  // Every skill MUST answer `help` with how it is used (the owner, 2026-11-25, "all of them
  // every one"). A SKILL.md says how in the shared Help block: its opening marker, then the
  // `## Help` heading on the next line. The shared-block check (validate.ts) keeps every copy's
  // text identical, so a hand-written `## Help` without the marker fails here.
  const HelpHeading: string := "<!-- shared:help -->\n## Help\n"

  predicate HasHelpSection(text: string) { OccursFrom(text, HelpHeading, 0) }

  // A command's `argument-hint` lists `help`: `[a | b | help]`, or `[help]` for a command with no
  // other subcommand (a mod's). Where it sits in the hint is not checked.
  const HelpHint: string := " | help]"
  const HelpAlone: string := "[help]"

  predicate HintListsHelp(hint: string) { OccursFrom(hint, HelpHint, 0) || OccursFrom(hint, HelpAlone, 0) }

  lemma HelpExamples()
    ensures HasHelpSection("# Repo\n" + HelpHeading + "\nHow it is used.")
    ensures HintListsHelp("[write | audit | help]")
    ensures HintListsHelp(HelpAlone)
    ensures !HintListsHelp("[help")
    ensures !HasHelpSection("## Help")
  {
    var s := "# Repo\n" + HelpHeading + "\nHow it is used.";
    assert s[7..7 + |HelpHeading|] == HelpHeading;
    OccursFromFindsMatch(s, HelpHeading, 0, 7);
    OccursFromFindsMatch("[write | audit | help]", HelpHint, 0, 14);
    OccursFromFindsMatch(HelpAlone, HelpAlone, 0, 0);
  }

  // ---------------------------------------------------------------- commands
  // A command that shares a skill's name replaces the skill's description in Claude's listing, so
  // its `description` MUST be the skill's, word for word (wiki Skill-Authoring).
  predicate SameDescription(command: string, skill: string) { command == skill }

  lemma SameDescriptionExamples()
    ensures SameDescription("Ships code.", "Ships code.")
    ensures !SameDescription("Ships code", "Ships code.")
  {
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
  // rule: "No spaces unless the value starts with `/`"), and never empty. "No spaces" is the scan
  // for non-space code units reaching the end.
  predicate IsLspCommand(c: string)
  {
    |c| > 0 && (c[0] as int == 47 || ScanEnd(c, 0, NonSpaceCode) == |c|)
  }

  lemma LspCommandExamples()
    ensures IsLspCommand("intelephense")
    ensures IsLspCommand("/opt/my tools/intelephense")
    ensures !IsLspCommand("intelephense --stdio")
    ensures !IsLspCommand("")
  {
    ScanEndIs("intelephense", 0, 12, NonSpaceCode);
    ScanEndIs("intelephense --stdio", 0, 12, NonSpaceCode);
  }
}
