#!/usr/bin/env node
// One operation from a downloaded OpenAPI document, with its `$ref`s resolved.
// `node <skill>/scripts/openapi-op.ts <openapi.json file> <METHOD> <path>`; prints JSON.
// Node 22.18 or later (type stripping). The logic and its tests: openapi-op-cli.ts.
import { readFileSync } from "node:fs";

import { checkArgs, runOpenapiOp } from "./openapi-op-cli.ts";

const args = process.argv.slice(2);
const bad = checkArgs(args);
let result = bad;
if (result === undefined) {
  const [file, method, path] = args as [string, string, string];
  try {
    result = runOpenapiOp(readFileSync(file, "utf8"), method, path);
  } catch {
    result = { code: 2, output: JSON.stringify({ error: `cannot read ${file}` }) };
  }
}
process.stdout.write(`${result.output}\n`);
process.exitCode = result.code;
