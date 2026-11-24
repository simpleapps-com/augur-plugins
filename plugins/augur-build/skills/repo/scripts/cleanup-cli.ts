// The logic of `cleanup-plan.ts`: read the facts the skill gathered, as JSON, and answer with the
// proved decisions from cleanup-rules.ts. It runs nothing; the skill runs the git commands.
import {
  type BranchStep,
  branchStep,
  endsOn,
  fastForwards,
  staysOnBranch,
  switchesToDefault,
} from "./cleanup-rules.ts";

interface Move {
  dirty: boolean;
  current: string;
  default: string;
  currentOpenPr: boolean;
}

interface BranchFacts {
  name: string;
  tip: string;
  mergedHeads: string[];
  listedMerged: boolean;
}

interface Branches {
  dirty: boolean;
  current: string;
  default: string;
  branches: BranchFacts[];
}

export interface Result {
  code: number;
  output: string;
}

const USAGE = "usage: cleanup-plan.ts move '<json>' | cleanup-plan.ts branches '<json>'";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A branch name or commit: non-empty, and never read as an option. */
function isName(v: unknown): v is string {
  return typeof v === "string" && v !== "" && !v.startsWith("-");
}

function isFacts(v: unknown): v is BranchFacts {
  return (
    isRecord(v) &&
    isName(v.name) &&
    isName(v.tip) &&
    Array.isArray(v.mergedHeads) &&
    v.mergedHeads.every(isName) &&
    typeof v.listedMerged === "boolean"
  );
}

function isMove(v: unknown): v is Move {
  return (
    isRecord(v) &&
    typeof v.dirty === "boolean" &&
    isName(v.current) &&
    isName(v.default) &&
    typeof v.currentOpenPr === "boolean"
  );
}

function isBranches(v: unknown): v is Branches {
  return (
    isRecord(v) &&
    typeof v.dirty === "boolean" &&
    isName(v.current) &&
    isName(v.default) &&
    Array.isArray(v.branches) &&
    v.branches.every(isFacts)
  );
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function fail(message: string): Result {
  return { code: 2, output: JSON.stringify({ error: message }) };
}

function reasonFor(step: BranchStep, b: BranchFacts, input: Branches): string {
  if (step === "force-delete") return "its tip is a merged PR's head commit";
  if (step === "safe-delete") return "git lists it as merged";
  if (input.dirty) return "uncommitted changes: nothing is deleted";
  if (b.name === input.default || b.name === input.current)
    return "the default or checked-out branch";
  return "it holds work no merge contains";
}

function planMove(m: Move): Result {
  const plan = {
    stays: staysOnBranch(m.current, m.default, m.currentOpenPr),
    switch: switchesToDefault(m.dirty, m.current, m.default, m.currentOpenPr),
    fastForward: fastForwards(m.dirty, m.current, m.default, m.currentOpenPr),
    endsOn: endsOn(m.dirty, m.current, m.default, m.currentOpenPr),
  };
  return { code: 0, output: JSON.stringify(plan) };
}

function planBranches(input: Branches): Result {
  const branches = input.branches.map((b) => {
    const step = branchStep(
      input.dirty,
      b.name,
      b.tip,
      b.mergedHeads,
      b.listedMerged,
      input.default,
      input.current,
    );
    return { name: b.name, step, reason: reasonFor(step, b, input) };
  });
  return { code: 0, output: JSON.stringify({ branches }) };
}

/** `move '<json>'` before the move; `branches '<json>'` after it, with the branch now checked out. */
export function runCleanupPlan(args: string[]): Result {
  const [mode, text] = args;
  if (args.length !== 2 || text === undefined) return fail(USAGE);
  const input = parse(text);
  if (mode === "move")
    return isMove(input)
      ? planMove(input)
      : fail("move: expected {dirty, current, default, currentOpenPr}");
  if (mode === "branches") {
    return isBranches(input)
      ? planBranches(input)
      : fail(
          "branches: expected {dirty, current, default, branches: [{name, tip, mergedHeads, listedMerged}]}",
        );
  }
  return fail(USAGE);
}
