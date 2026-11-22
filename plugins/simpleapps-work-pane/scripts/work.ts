#!/usr/bin/env node
// The `work` command: manage a project's work/ folder. `node <plugin>/scripts/work.ts <command>
// --root <project>/work`; without --root, the work/ folder in the current directory. The Work pane
// runs it with Node 22.18 or later (type stripping); the logic and its tests are in lib/.
import { join } from "node:path";

import { runWork } from "./lib/cli.ts";

process.exitCode = runWork(process.argv.slice(2), join(process.cwd(), "work"), (line) => {
  process.stdout.write(`${line}\n`);
});
