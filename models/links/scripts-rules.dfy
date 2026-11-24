// Links scripts/rules.ts (its proved .dfy) to the model, models/Marketplace.dfy: every exported
// rule decides exactly what the model says. The code reads code units in place; the model reads
// slices.
include "../../scripts/rules.dfy"
include "../Marketplace.dfy"

// ---------------------------------------------------------------- scans
// The one induction in this file: the code's scan is the model's, for any test. Every rule
// below reuses it and the model's general scan lemmas (ScanReaches, ScanEndAgree).

lemma ScanEndMatchesModel(s: string, i: nat, ok: int -> bool)
  requires i <= |s|
  ensures scanEnd(s, i, ok) == Text.ScanEnd(s, i, ok)
  decreases |s| - i
{
  if i < |s| { ScanEndMatchesModel(s, i + 1, ok); }
}

// ---------------------------------------------------------------- CalVer

lemma YearPartMatchesModel(s: string)
  requires |s| >= 8
  ensures yearPart(s) <==> (Marketplace.YearText(s[..4]) && s[4] == '.')
{
  ScanEndMatchesModel(s, 1, isDigitCode);
  Text.ScanReaches(s, 1, 4, isDigitCode);
}

lemma SeqFromMatchesModel(s: string, a: nat)
  requires a < |s|
  ensures seqFrom(s, a) <==> Marketplace.SeqText(s[a..])
{
  ScanEndMatchesModel(s, a + 1, isDigitCode);
  Text.ScanReaches(s, a + 1, |s|, isDigitCode);
  var q := s[a..];
  if Marketplace.SeqText(q) {
    forall k | a + 1 <= k < |s| ensures isDigitCode(s[k] as int) { assert s[k] == q[k - a]; }
  }
}

lemma ShortMonthMatchesModel(s: string)
  requires |s| >= 8
  ensures shortMonth(s) <==> (s[6] == '.' && Marketplace.MonthText(s[5..6]) && Marketplace.SeqText(s[7..]))
{
  SeqFromMatchesModel(s, 7);
}

lemma LongMonthMatchesModel(s: string)
  requires |s| >= 8
  ensures longMonth(s) <==> (|s| >= 9 && s[7] == '.' && Marketplace.MonthText(s[5..7]) && Marketplace.SeqText(s[8..]))
{
  if |s| >= 9 { SeqFromMatchesModel(s, 8); }
}

lemma IsCalVerMatchesModel(s: string)
  ensures isCalVer(s) == Marketplace.IsCalVer(s)
{
  if |s| >= 8 {
    YearPartMatchesModel(s);
    ShortMonthMatchesModel(s);
    LongMonthMatchesModel(s);
  }
}

// ---------------------------------------------------------------- skills

lemma IsSkillKeyMatchesModel(k: string)
  ensures isSkillKey(k) == Marketplace.IsSkillKey(k)
{
}

lemma IsSkillNameMatchesModel(n: string)
  ensures isSkillName(n) == Marketplace.IsSkillName(n)
{
  if |n| >= 1 {
    ScanEndMatchesModel(n, 1, isNameCode);
    Text.ScanReaches(n, 1, |n|, isNameCode);
  }
}

lemma OccursFromMatchesModel(s: string, w: string, i: nat)
  ensures occursFrom(s, w, i) == Marketplace.OccursFrom(s, w, i)
  decreases |s| - i
{
  if i + |w| <= |s| { OccursFromMatchesModel(s, w, i + 1); }
}

lemma IsReservedNameMatchesModel(n: string)
  ensures isReservedName(n) == Marketplace.IsReservedName(n)
{
  OccursFromMatchesModel(n, "anthropic", 0);
  OccursFromMatchesModel(n, "claude", 0);
}

lemma DescriptionFitsMatchesModel(length: nat)
  ensures descriptionFits(length) == Marketplace.DescriptionFits(length)
{
}

lemma BudgetOfMatchesModel(words: nat)
  ensures budgetOf(words) == fits <==> Marketplace.BudgetOf(words) == Marketplace.Fits
  ensures budgetOf(words) == near <==> Marketplace.BudgetOf(words) == Marketplace.Near
  ensures budgetOf(words) == over <==> Marketplace.BudgetOf(words) == Marketplace.Over
{
}

// ---------------------------------------------------------------- connectors

lemma IsConnectorUrlMatchesModel(u: string)
  ensures isConnectorUrl(u) == Marketplace.IsConnectorUrl(u)
{
  if |u| >= 8 {
    ScanEndMatchesModel(u, 8, isNameCode);
    Text.ScanEndAgree(u, 8, isNameCode, Marketplace.NameCode);
  }
}

// ---------------------------------------------------------------- LSP plugins (GH36)

lemma IsSecretKeyMatchesModel(k: string)
  ensures isSecretKey(k) == Marketplace.IsSecretKey(k)
{
}

lemma IsLspCommandMatchesModel(c: string)
  ensures isLspCommand(c) == Marketplace.IsLspCommand(c)
{
  ScanEndMatchesModel(c, 0, isNonSpaceCode);
  Text.ScanEndAgree(c, 0, isNonSpaceCode, Marketplace.NonSpaceCode);
}
