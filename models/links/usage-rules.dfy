// Links plugins/simpleapps-statusline/scripts/usage-rules.ts (its proved .dfy) to the model,
// models/StatusLine.dfy: every exported rule decides exactly what the model says.
include "../../plugins/simpleapps-statusline/scripts/usage-rules.dfy"
include "../StatusLine.dfy"

lemma UsageCommandMatchesModel(args: string)
  ensures usageCommand(args) == UsageAnswer.help <==> StatusLine.UsageCommand(args) == StatusLine.UsageHelp
  ensures usageCommand(args) == UsageAnswer.reading <==> StatusLine.UsageCommand(args) == StatusLine.UsageReading
{
}
