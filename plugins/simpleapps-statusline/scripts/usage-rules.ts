// The status line mod's proved decisions (model: models/StatusLine.dfy, link:
// models/links/usage-rules.dfy). hooks/register.tsx calls these; it decides nothing itself here.

/** What `/plan-usage <args>` answers, `args` trimmed: `help` explains the command; anything else
    prints the reading (model: StatusLine.UsageCommand). */
export type UsageAnswer = "help" | "reading";

export function usageCommand(args: string): UsageAnswer {
  //@ verify
  //@ ensures (args === "help") === (\result === "help")
  return args === "help" ? "help" : "reading";
}
