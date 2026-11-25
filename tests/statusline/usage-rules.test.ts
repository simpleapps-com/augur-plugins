// Pins the status line's proved rules (plugins/simpleapps-statusline/scripts/usage-rules.ts) to
// the runtime: the proof says what the Dafny model decides; these say JavaScript decides the same.
import assert from "node:assert/strict";
import { test } from "node:test";

import { usageCommand } from "../../plugins/simpleapps-statusline/scripts/usage-rules.ts";

test("usageCommand: help explains, anything else prints the reading", () => {
  assert.equal(usageCommand("help"), "help");
  for (const args of ["", "Help", "help me", "check", "x"])
    assert.equal(usageCommand(args), "reading");
});
