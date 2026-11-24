#!/usr/bin/env node
// The repo skill's cleanup decisions, proved (cleanup-rules.ts, models/Repo.dfy).
// `node <skill>/scripts/cleanup-plan.ts move '<json>'` or `... branches '<json>'`; prints JSON.
// Node 22.18 or later (type stripping). The logic and its tests: cleanup-cli.ts.
import { runCleanupPlan } from "./cleanup-cli.ts";

const result = runCleanupPlan(process.argv.slice(2));
process.stdout.write(`${result.output}\n`);
process.exitCode = result.code;
