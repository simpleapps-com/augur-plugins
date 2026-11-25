// The model of the simpleapps-statusline mod's decisions. Hand-written Dafny, written before the
// code (wiki Proofs). `plugins/simpleapps-statusline/scripts/usage-rules.ts` is proved with
// LemmaScript and linked to it in `models/links/usage-rules.dfy`. The meters, cache ages and
// wrapping are not modelled yet (wiki Proofs, "Not yet proved").

module StatusLine {
  datatype UsageAnswer = UsageHelp | UsageReading

  // What `/plan-usage <args>` answers, `args` trimmed: `help` explains the command (every
  // command answers help, the owner, 2026-11-25); anything else prints the reading, as before.
  function UsageCommand(args: string): UsageAnswer
  {
    if args == "help" then UsageHelp else UsageReading
  }

  lemma UsageCommandUnchanged(args: string)
    ensures UsageCommand("help") == UsageHelp
    ensures args != "help" ==> UsageCommand(args) == UsageReading
  {
  }
}
