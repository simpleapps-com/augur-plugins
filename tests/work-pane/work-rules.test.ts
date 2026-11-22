// Pins each proved rule in work-rules.ts to the runtime: the proof says what the Dafny model
// decides; these say JavaScript decides the same, against the code each rule replaced in the
// work scripts it ports (GH #14), regexes and all, as the oracle, over thousands of seeded inputs.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addEdge,
  arrowOf,
  autoSyncOf,
  basecampId,
  briefCell,
  chartLabel,
  chartRef,
  chartTitle,
  classifyLine,
  closesBefore,
  compareText,
  earlierPresent,
  extractRefs,
  followKind,
  formatList,
  formatScalar,
  githubId,
  hasAt,
  holds,
  holdsUp,
  htmlText,
  hubIdFor,
  idFromFile,
  impactOrder,
  isAutoHub,
  isBotName,
  isClosedItem,
  isDueSoon,
  isEmptyHub,
  isHubFor,
  isIdText,
  isLineEndUnit,
  isListed,
  isLockStale,
  isMine,
  isOverdue,
  isPruned,
  isQuiet,
  isRootItem,
  isSpaceUnit,
  isStale,
  issueKind,
  issueOrder,
  isUnfetched,
  isVisibleName,
  isWhenText,
  isWordUnit,
  laterText,
  lastMineIndex,
  lower,
  markersInOrder,
  matchesFormat,
  movedAway,
  nodeId,
  numberText,
  orUnknown,
  parseGithubId,
  parseScalar,
  parseValue,
  parseYaml,
  plainText,
  projectInUrl,
  projectOfRef,
  refContext,
  repeatsAt,
  rowsLeftOut,
  scalarProblem,
  shortRef,
  slug,
  splitSegments,
  statusOf,
  todoLabel,
  todoProject,
  trimText,
  waitsOn,
} from "../../plugins/simpleapps-work-pane/scripts/work-rules.ts";

/** A seeded generator (mulberry32), so a failure reproduces. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(20261122);

/** A string of up to `max` pieces drawn from `pieces`. */
function draw(pieces: string[], max: number): string {
  let s = "";
  const length = Math.floor(next() * (max + 1));
  for (let i = 0; i < length; i++) s += pieces[Math.floor(next() * pieces.length)];
  return s;
}

const ORG = "simpleapps-com";

// ---------------------------------------------------------------- the oracle: the source's code

const oracleGithubId = (owner: string, repo: string, number: string, org: string) => {
  const name = owner.toLowerCase() === org.toLowerCase() ? repo : `${owner}.${repo}`;
  return `gh-${name.toLowerCase()}-${number}`;
};
const oracleBasecampId = (type: string, id: string) =>
  `bc-${type === "messages" ? "message" : "todo"}-${id}`;
const numbered = (owner: string, repo: string, num: string, org: string) =>
  num.length >= 9 ? oracleBasecampId("todos", num) : oracleGithubId(owner, repo, num, org);

interface Ctx {
  owner?: string;
  repo?: string;
}
type Groups = Record<string, string | undefined>;
type Found = Map<string, { id: string; kind: string; project?: string }>;

function patterns(org: string) {
  return [
    {
      re: /https?:\/\/github\.com\/(?<owner>[\w.-]+)\/(?<repo>[\w.-]+)\/(?:issues|pull)\/(?<num>\d+)/g,
      id: (g: Groups) => oracleGithubId(String(g.owner), String(g.repo), String(g.num), org),
    },
    {
      re: /(?<lead>^|[\s([])(?:(?<owner>[\w.-]+)\/)?(?<repo>[A-Za-z][\w.-]+)#(?<num>\d+)\b/gm,
      id: (g: Groups, context: Ctx) => {
        if (!g.owner && String(g.repo).toLowerCase() === "gh")
          return context.repo
            ? numbered(context.owner ?? org, context.repo, String(g.num), org)
            : null;
        return numbered(g.owner ?? org, String(g.repo), String(g.num), org);
      },
    },
    {
      re: /(?<lead>^|[\s([])#(?<num>\d+)\b/gm,
      id: (g: Groups, context: Ctx, found: Found) =>
        [...found.keys()].find((key) => key.startsWith("gh-") && key.endsWith(`-${g.num}`)) ??
        (context.repo ? numbered(context.owner ?? org, context.repo, String(g.num), org) : null),
    },
    {
      re: /https?:\/\/(?:3\.)?basecamp\.com\/\d+\/projects\/(?<project>\d+)\/(?<type>todos|messages)\/(?<num>\d+)/g,
      id: (g: Groups) => oracleBasecampId(String(g.type), String(g.num)),
    },
    {
      re: /\bBC(?<num>\d{6,})\b/g,
      id: (g: Groups) => oracleBasecampId("todos", String(g.num)),
    },
  ];
}

const CLOSES = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*$/i;

/** The scripts' addRef: closes wins over mention, and a project once known is kept. */
function oracleAdd(found: Found, ref: string, kind: string, project: string | undefined) {
  const prior = found.get(ref);
  const kept = project ?? prior?.project;
  found.set(ref, {
    id: ref,
    kind: prior?.kind === "closes" ? "closes" : kind,
    ...(kept && { project: kept }),
  });
}

function oracleRefs(text: string, context: Ctx, org: string) {
  const found: Found = new Map();
  for (const { re, id } of patterns(org)) {
    for (const match of text.matchAll(re)) {
      const g = match.groups as Groups;
      const ref = id(g, context, found);
      if (!ref) continue;
      const start = Number(match.index) + (g.lead?.length ?? 0);
      const kind = CLOSES.test(text.slice(Math.max(0, start - 24), start)) ? "closes" : "mention";
      oracleAdd(found, ref, kind, g.project);
    }
  }
  return [...found.values()];
}

/** extractRefs' records as the scripts use them: `{ id, kind, project? }`. */
const asScripts = (refs: ReturnType<typeof extractRefs>) =>
  refs.map((r) => ({
    id: r.id,
    kind: r.closes ? "closes" : "mention",
    ...(r.project !== "" && { project: r.project }),
  }));

const COMMENT = /^### (.+?) \u00b7 (\S+)\s*$/gm;

function oracleSegments(body: string, author: string, at: string) {
  const heads = [...body.matchAll(COMMENT)];
  return [
    { author, at, text: body.slice(0, heads[0]?.index ?? body.length) },
    ...heads.map((head, i) => ({
      author: String(head[1]),
      at: String(head[2]),
      text: body.slice(Number(head.index) + head[0].length, heads[i + 1]?.index ?? body.length),
    })),
  ];
}

function oracleParse(id: string, org: string) {
  const match = /^gh-(.+)-(\d+)$/.exec(id);
  if (!match) return { ok: false, owner: "", repo: "", digits: "" };
  const name = String(match[1]);
  const dot = name.indexOf(".");
  if (dot < 0) return { ok: true, owner: org, repo: name, digits: String(match[2]) };
  return {
    ok: true,
    owner: name.slice(0, dot),
    repo: name.slice(dot + 1),
    digits: String(match[2]),
  };
}

// ---------------------------------------------------------------- inputs

/** Pieces that build every reference form, near-misses, and their surroundings. */
const PIECES = [
  " site#12",
  " #4",
  "Fixes ",
  "https://github.com/simpleapps-com/site/issues/3",
  "https://3.basecamp.com/1/projects/22/todos/500000014",
  " BC1234567",
  "https://github.com/",
  "http://github.com/",
  "https://3.basecamp.com/",
  "https://basecamp.com/",
  "httpsx://",
  "simpleapps-com/",
  "acme.io/",
  "site",
  "Site-2",
  "a",
  "gh",
  "GH",
  "/issues/",
  "/pull/",
  "issues/",
  "/projects/",
  "/todos/",
  "/messages/",
  "123",
  "500000014",
  "4",
  "#",
  "#12",
  "BC",
  "BC1234567",
  "BC123",
  " ",
  "\n",
  "\r",
  "\u00a0",
  "(",
  "[",
  ")",
  ".",
  "_",
  "x",
  "Fixes ",
  "closes: ",
  "Resolved",
  "prefix ",
  "fix",
  ":",
  "\u2028",
];

const SPACES = [9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8202, 8232, 8233, 8239, 8287, 12288, 65279];

// ---------------------------------------------------------------- characters and ids

test("character classes match \\w, \\s and line ends for every code unit", () => {
  for (let c = 0; c < 65536; c++) {
    const ch = String.fromCharCode(c);
    assert.equal(isWordUnit(c), /\w/.test(ch), `\\w ${c}`);
    assert.equal(isSpaceUnit(c), /\s/.test(ch), `\\s ${c}`);
    assert.equal(isSpaceUnit(c), ch.trim() === "", `trim ${c}`);
    assert.equal(isLineEndUnit(c), !/./.test(ch), `. ${c}`);
  }
  assert.deepEqual(
    SPACES.filter((c) => isSpaceUnit(c)),
    SPACES,
  );
});

test("lower lowers ASCII only; hasAt is a slice compare", () => {
  for (let n = 0; n < 2000; n++) {
    const s = draw(["A", "z", "Q", "-", "\u00c4", "9", "."], 8);
    const ascii = s.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
    assert.equal(lower(s), ascii);
    const w = draw(["A", "z", "-"], 3);
    const i = Math.floor(next() * (s.length + 2));
    assert.equal(hasAt(s, i, w), i + w.length <= s.length && s.slice(i, i + w.length) === w);
  }
});

test("githubId and basecampId build the scripts' ids", () => {
  for (const [owner, repo, num] of [
    ["simpleapps-com", "Site", "12"],
    ["SimpleApps-COM", "site", "1"],
    ["acme.io", "Tool", "7"],
    ["Acme", "x.y", "0"],
  ] as const) {
    assert.equal(githubId(owner, repo, num, ORG), oracleGithubId(owner, repo, num, ORG));
  }
  assert.equal(basecampId(false, "9"), oracleBasecampId("todos", "9"));
  assert.equal(basecampId(true, "9"), oracleBasecampId("messages", "9"));
});

test("parseGithubId is ^gh-(.+)-(\\d+)$ split at the first dot", () => {
  const ids = [
    "gh-site-1",
    "gh-acme.tool-22",
    "gh--1",
    "gh-a-",
    "gh-a-b-3",
    "gh-a\nb-3",
    "gh-a.b.c-9",
  ];
  for (let n = 0; n < 4000; n++)
    ids.push(`${next() < 0.8 ? "gh-" : "gx-"}${draw(["a", "-", ".", "1", "\n", "x"], 6)}`);
  for (const id of ids) assert.deepEqual(parseGithubId(id, ORG), oracleParse(id, ORG), id);
});

test("todoLabel shortens bc-todo- ids only", () => {
  for (const id of ["bc-todo-123", "bc-todo-", "bc-message-1", "gh-site-1", "xbc-todo-1"])
    assert.equal(todoLabel(id), id.replace(/^bc-todo-/, "BC"));
});

// ---------------------------------------------------------------- references

test("closesBefore is the CLOSES regex on the 24 code units before", () => {
  const words = ["close", "Closes", "CLOSED", "fix", "Fixes", "fixed", "resolve", "resolves"];
  const pieces = [...words, "d", "es", " ", ":", "\n", "x", "_", "pre", "-", "\u00a0", "9"];
  for (let n = 0; n < 20000; n++) {
    const s = draw(pieces, 8);
    const start = Math.floor(next() * (s.length + 1));
    const oracle = CLOSES.test(s.slice(Math.max(0, start - 24), start));
    assert.equal(closesBefore(s, start), oracle, JSON.stringify([s, start]));
  }
});

test("refContext is ^([\\w.-]+)/([\\w.-]+)#\\d+$ on a GitHub item's ref", () => {
  const refs = ["simpleapps-com/site#12", "a/b#", "a/b#1x", "/b#1", "a/#1", "a.b/c-d#3", "ab#1"];
  for (let n = 0; n < 3000; n++) refs.push(draw(["a", "/", "#", "1", ".", "-", " "], 7));
  for (const ref of refs) {
    const m = /^([\w.-]+)\/([\w.-]+)#\d+$/.exec(ref);
    const expected = m
      ? { hasRepo: true, owner: String(m[1]), repo: String(m[2]), org: ORG }
      : { hasRepo: false, owner: "", repo: "", org: ORG };
    assert.deepEqual(refContext(true, ref, ORG), expected, ref);
    assert.equal(refContext(false, ref, ORG).hasRepo, false);
  }
});

test("extractRefs finds what the five regexes find, in their order, closes winning", () => {
  const contexts: Ctx[] = [
    {},
    { owner: "simpleapps-com", repo: "site" },
    { owner: "acme", repo: "tool" },
  ];
  const fixed = [
    "Fixes #12 and site#12",
    "see https://github.com/simpleapps-com/site/issues/12 then #12",
    "closes: https://3.basecamp.com/1/projects/22/todos/500000014",
    "BC1234567 and (BC7654321) BC12",
    "GH#5 gh#500000014",
    "acme.io/tool#3 x/ab#1 ab/c#1",
    "line\n#4\r#5\u2028#6",
    "https://basecamp.com/9/projects/8/messages/7 again https://basecamp.com/9/projects/8/messages/7",
    "https://github.com/acme/tool/pull/7 https://github.com/a/b/issues/x",
    "https://basecamp.com/1/projects/2/uploads/3 https://basecamp.com/1/projects/2/todos/x",
    "https://basecamp.com/1/projects/x/todos/3 https://basecamp.com/1/projects/2x/todos/3",
    "https://basecamp.com/x/projects/2/todos/3 https://basecamp.com/1/project/2/todos/3",
  ];
  for (let n = 0; n < 6000; n++) fixed.push(draw(PIECES, 10));
  let found = 0;
  let closing = 0;
  for (const text of fixed)
    for (const context of contexts) {
      const ctx = refContext(
        context.repo !== undefined,
        context.repo ? `${context.owner}/${context.repo}#1` : "",
        ORG,
      );
      const refs = asScripts(extractRefs(text, ctx));
      assert.deepEqual(refs, oracleRefs(text, context, ORG), JSON.stringify([text, context]));
      if (refs.length > 0) found++;
      if (refs.some((r) => r.kind === "closes")) closing++;
    }
  // The inputs reach the grammar: many texts hold references, and some close them
  assert.ok(found > 2000, `only ${found} texts held a reference`);
  assert.ok(closing > 100, `only ${closing} texts closed one`);
});

test("splitSegments is the description, then one segment per ### author \u00b7 when heading", () => {
  const pieces = [
    "\n### Ann \u00b7 2026-11-22\n",
    "### B \u00b7 c  \n",
    "### ",
    "Ann",
    " \u00b7 ",
    "2026-11-22",
    "\n",
    " ",
    "\r",
    "text",
    "#",
    "\u2028",
    "x",
  ];
  const bodies = [
    "",
    "plain",
    "### Ann \u00b7 2026\nhi",
    "a\n### Ann \u00b7 when  \n\nb\n### B \u00b7 c",
    "### a \u00b7 b \u00b7 c\n",
  ];
  for (let n = 0; n < 8000; n++) bodies.push(draw(pieces, 12));
  let headed = 0;
  for (const body of bodies) {
    const segments = splitSegments(body, "me", "then");
    assert.deepEqual(segments, oracleSegments(body, "me", "then"), JSON.stringify(body));
    if (segments.length > 1) headed++;
  }
  // The inputs reach the grammar: many bodies hold a comment heading
  assert.ok(headed > 500, `only ${headed} bodies held a heading`);
});

// ---------------------------------------------------------------- frontmatter

function oracleFormatScalar(value: string) {
  const text = String(value);
  if (!/[:#,[\]"']|^\s|\s$|^$/.test(text)) return text;
  return text.includes('"') ? `'${text}'` : `"${text}"`;
}

function oracleParseScalar(raw: string) {
  const value = raw.trim();
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? String(quoted[2]) : value;
}

function oracleParseValue(raw: string): string | string[] {
  const value = raw.trim();
  if (!value.startsWith("[") || !value.endsWith("]")) return oracleParseScalar(value);
  const inner = value.slice(1, -1).trim();
  return inner === "" ? [] : inner.split(",").map(oracleParseScalar);
}

function oracleParseYaml(lines: string[]) {
  const data: Record<string, string | string[]> = {};
  const errors: string[] = [];
  let listKey: string | null = null;
  lines.forEach((line, index) => {
    if (/^\s*(#.*)?$/.test(line)) return;
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item && listKey) {
      (data[listKey] as string[]).push(oracleParseScalar(String(item[1])));
      return;
    }
    const pair = /^([a-z_]+):(.*)$/.exec(line);
    if (!pair) {
      errors.push(`frontmatter line ${index + 2}: unsupported syntax "${line.trim()}"`);
      return;
    }
    const key = String(pair[1]);
    const rest = String(pair[2]);
    if (key in data) errors.push(`frontmatter: duplicate key "${key}"`);
    listKey = rest.trim() === "" ? key : null;
    data[key] = listKey ? [] : oracleParseValue(rest);
  });
  return { data, errors };
}

/** parseYaml's result as the scripts use it: the shell builds the same object and messages. */
function asData(yaml: ReturnType<typeof parseYaml>) {
  const data: Record<string, string | string[]> = {};
  for (const { key, value } of yaml.entries) data[key] = value.isList ? value.items : value.scalar;
  const errors = yaml.problems.map((p) =>
    p.kind === "bad"
      ? `frontmatter line ${p.line + 2}: unsupported syntax "${p.text}"`
      : `frontmatter: duplicate key "${p.text}"`,
  );
  return { data, errors };
}

const TEXT_PIECES = [
  "a",
  "B",
  " ",
  ":",
  "#",
  ",",
  "[",
  "]",
  '"',
  "'",
  "\u00a0",
  "\n",
  "\r",
  "x y",
  "-",
  "\u2028",
];

test("trimText is String.prototype.trim", () => {
  for (let n = 0; n < 4000; n++) {
    const s = draw(TEXT_PIECES, 8);
    assert.equal(trimText(s), s.trim(), JSON.stringify(s));
  }
});

test("formatScalar, formatList, parseScalar and parseValue are the scripts' YAML", () => {
  for (let n = 0; n < 6000; n++) {
    const s = draw(TEXT_PIECES, 8);
    assert.equal(formatScalar(s), oracleFormatScalar(s), JSON.stringify(s));
    assert.equal(parseScalar(s), oracleParseScalar(s), JSON.stringify(s));
    const v = parseValue(s);
    assert.deepEqual(v.isList ? v.items : v.scalar, oracleParseValue(s), JSON.stringify(s));
    const items = Array.from({ length: Math.floor(next() * 4) }, () => draw(TEXT_PIECES, 4));
    assert.equal(formatList(items), `[${items.map(oracleFormatScalar).join(", ")}]`);
  }
});

test("a scalar or a comma-free list reads back as written (no line ends)", () => {
  const pieces = TEXT_PIECES.filter((p) => !/[\n\r\u2028,]/.test(p));
  for (let n = 0; n < 6000; n++) {
    const s = draw(pieces, 8);
    const read = parseValue(` ${formatScalar(s)}`);
    assert.deepEqual([read.isList, read.scalar], [false, s], JSON.stringify(s));
    const items = Array.from({ length: Math.floor(next() * 4) }, () => draw(pieces, 4));
    assert.deepEqual(parseValue(` ${formatList(items)}`).items, items, JSON.stringify(items));
  }
});

test("classifyLine and parseYaml read frontmatter as the scripts do", () => {
  const pieces = [
    "id: work",
    "me:",
    "title: [a, b]",
    "key",
    "id",
    "_",
    ":",
    " ",
    "  - ",
    "-",
    "#",
    "x",
    "[a, b]",
    '"q"',
    "\t",
    "\r",
    "\u2028",
    "A",
  ];
  let keyed = 0;
  for (let n = 0; n < 6000; n++) {
    const lines = Array.from({ length: Math.floor(next() * 6) }, () => draw(pieces, 5));
    const read = asData(parseYaml(lines));
    assert.deepEqual(read, oracleParseYaml(lines), JSON.stringify(lines));
    if (Object.keys(read.data).length > 0) keyed++;
  }
  // The inputs reach the grammar: many line sets hold a key
  assert.ok(keyed > 500, `only ${keyed} line sets held a key`);
  const index = ["id: work", "me:", "  - Ann", "  - Bob", "title: Work", "me: [x]"];
  assert.deepEqual(asData(parseYaml(index)), oracleParseYaml(index));
  assert.equal(classifyLine("  # note").kind, "blank");
  assert.deepEqual(classifyLine("  - a"), { kind: "item", key: "", rest: "a" });
  assert.deepEqual(classifyLine("me: x"), { kind: "pair", key: "me", rest: " x" });
  assert.equal(classifyLine("Me: x").kind, "bad");
});

// ---------------------------------------------------------------- field formats

const FORMATS: Record<string, RegExp> = {
  id: /^[a-z0-9][a-z0-9._-]*$/,
  text: /\S/,
  alias: /^[^=]+=[^=]+$/,
  "watch-repo": /^[\w.-]+(\/[\w.-]+)?$/,
  repo: /^[\w.-]+$/,
  digits: /^\d+$/,
  minutes: /^([1-9]|[1-5]\d|60)$/,
  url: /^https?:\/\//,
  when: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  stamp: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
};

test("matchesFormat is each schema regex", () => {
  const pieces: Record<string, string[]> = {
    id: ["a", "0", ".", "_", "-", "A", " "],
    text: [" ", "\n", "x", "\u3000"],
    alias: ["a", "=", " ", "\n"],
    "watch-repo": ["a", "/", ".", "-", "_", " "],
    repo: ["a", "/", ".", "-", " "],
    digits: ["1", "0", "a"],
    minutes: ["0", "1", "5", "6", "9", "60", "61"],
    url: ["http", "s", "://", "x", "S"],
    when: ["2026-11-22", "T", "10", ":", "05", ".", "123", "Z", "+", "-", "0530", " "],
    stamp: ["2026-11-22", " ", "10", ":", "05", "T"],
  };
  for (const [format, re] of Object.entries(FORMATS))
    for (let n = 0; n < 3000; n++) {
      const v = draw(pieces[format] ?? [], 6);
      assert.equal(matchesFormat(format, v), re.test(v), `${format} ${JSON.stringify(v)}`);
    }
  const times = [
    "2026-11-22",
    "2026-11-22T10:05",
    "2026-11-22T10:05:01",
    "2026-11-22T10:05:01.5",
    "2026-11-22T10:05:01.",
    "2026-11-22T10:05:0",
    "2026-11-22T10:05Z",
    "2026-11-22T10:05+05:30",
    "2026-11-22T10:05-0530",
    "2026-11-22T10:05+05",
    "2026-11-22T10:05+0",
    "2026-11-22T10:05+05:3",
    "2026-11-22T10:05x",
    "2026-11-22T1:05",
  ];
  for (const v of times) assert.equal(matchesFormat("when", v), FORMATS.when?.test(v), v);
  assert.equal(matchesFormat("unknown", "x"), false);
  assert.equal(isIdText("work"), true);
  assert.equal(isWhenText("2026-11-22T10:05:01.5+05:30"), true);
});

/** The scripts' checkScalar, first problem first, as a tag. */
function oracleScalarProblem(
  isList: boolean,
  v: string,
  enumOf: string[] | undefined,
  format: string,
) {
  if (isList || v === "") return "empty";
  if (enumOf && !enumOf.includes(v)) return "enum";
  if (format !== "" && !FORMATS[format]?.test(v)) return "format";
  return "";
}

test("holds, repeatsAt, scalarProblem and idFromFile are the schema checks", () => {
  const xs = ["a", "b", "a", "c", "b"];
  for (let i = 0; i < xs.length; i++)
    assert.equal(repeatsAt(xs, i), xs.indexOf(String(xs[i])) !== i);
  assert.equal(holds(xs, "c"), true);
  assert.equal(holds(xs, "z"), false);
  const allowed = ["open", "closed"];
  for (const isList of [false, true])
    for (const v of ["", "open", "x y"])
      for (const hasEnum of [false, true])
        for (const format of ["", "id"])
          assert.equal(
            scalarProblem(isList, v, hasEnum, allowed, format),
            oracleScalarProblem(isList, v, hasEnum ? allowed : undefined, format),
          );
  assert.equal(idFromFile("README", "site"), "site");
  assert.equal(idFromFile("gh-site-1", "items"), "gh-site-1");
});

// ---------------------------------------------------------------- order, refresh, briefs, digest

const ASCIIISH = ["a", "B", "0", "9", "-", ".", "_", " ", "~", "\u00e9", "Z", "2026-11-22"];

test("compareText is JavaScript's string order; laterText and earlierPresent follow it", () => {
  for (let n = 0; n < 6000; n++) {
    const a = draw(ASCIIISH, 4);
    const b = draw(ASCIIISH, 4);
    assert.equal(compareText(a, b), a < b ? -1 : a > b ? 1 : 0);
    assert.equal(laterText(a, b), [a, b].sort().at(-1));
    assert.equal(earlierPresent(a, b), [a, b].filter(Boolean).sort()[0] ?? "");
  }
});

test("lock, settings, ref project, and tidy decisions", () => {
  for (const age of [0, 899999, 900000, 900001])
    assert.equal(isLockStale(age, 0), !(age < 15 * 60 * 1000));
  for (const v of ["false", "true", "", "False"]) assert.equal(autoSyncOf(v), v !== "false");
  for (let n = 0; n < 3000; n++) {
    const ref = draw(["basecamp:", "12", "/", "todos", "x", "basecamp", ":"], 4);
    assert.equal(projectOfRef(ref), /^basecamp:(\d+)\//.exec(ref)?.[1] ?? "", ref);
  }
  assert.equal(isAutoHub("Auto-created by work follow for x"), true);
  assert.equal(isAutoHub("Mine"), false);
  assert.equal(isVisibleName(".DS_Store"), false);
  assert.equal(isVisibleName("items"), true);
  assert.equal(isEmptyHub([], 0), true);
  assert.equal(isEmptyHub(["items"], 0), true);
  assert.equal(isEmptyHub(["items"], 1), false);
  assert.equal(isEmptyHub(["notes.md"], 0), false);
});

test("brief decisions: the project in a URL, cells, quiet, markers", () => {
  for (let n = 0; n < 4000; n++) {
    const url = draw(["/projects/", "12", "/", "x", "https://3.basecamp.com/1"], 5);
    assert.equal(projectInUrl(url), /\/projects\/(\d+)\//.exec(url)?.[1] ?? "", url);
    const text = draw(["a", "|", " ", "\n", "\u00a0", "\t", "b"], 6);
    assert.equal(briefCell(text), text.replace(/\|/g, "\\|").replace(/\s+/g, " "));
  }
  const DAY = 86_400_000;
  for (const diff of [0, 14 * DAY - 1, 14 * DAY, 20 * DAY, -DAY])
    for (const has of [false, true]) assert.equal(isQuiet(has, diff, 0), has && diff / DAY >= 14);
  assert.equal(markersInOrder(-1, 5), false);
  assert.equal(markersInOrder(3, 2), false);
  assert.equal(markersInOrder(3, 3), true);
});

test("digest decisions: bots, last word, waits", () => {
  for (const p of ["dependabot[bot]", "[bot]", "bot]", "Ann", "x[bot]y"])
    assert.equal(isBotName(p), /\[bot\]$/.test(p));
  for (let n = 0; n < 2000; n++) {
    const mine = Array.from({ length: Math.floor(next() * 5) }, () => next() < 0.4);
    // The digest's findLastIndex over the segments, which for flags is lastIndexOf(true)
    assert.equal(lastMineIndex(mine), mine.lastIndexOf(true));
  }
  for (const [a, b, c] of [
    [true, false, false],
    [true, true, false],
    [false, false, false],
    [true, false, true],
  ] as const)
    assert.equal(waitsOn(a, b, c), a && !b && !c);
  assert.equal(holdsUp(0, false), false);
  assert.equal(holdsUp(2, true), false);
  assert.equal(holdsUp(1, false), true);
});

/** The digest's overdue, due-soon and going-stale filters. */
function oracleDue(due: string, today: string, days: number) {
  return {
    overdue: Boolean(due && due < today),
    soon: Boolean(due >= today && due && days <= 7),
    stale: Boolean(due && days * 5 >= 30),
  };
}

test("digest decisions: due, stale, unfetched, rows", () => {
  const today = "2026-11-22";
  for (const due of ["", "2026-11-21", today, "2026-11-29", "2026-12-01"])
    for (const days of [0, 7, 8])
      assert.deepEqual(
        {
          overdue: isOverdue(due, today),
          soon: isDueSoon(due, today, days),
          stale: isStale(due, days * 5),
        },
        oracleDue(due, today, days),
      );
  for (const id of ["bc-todo-1", "gh-site-1"])
    for (const known of [false, true])
      assert.equal(isUnfetched(id, known), id.startsWith("bc-") && !known);
  for (const total of [0, 15, 16, 40])
    assert.equal(rowsLeftOut(total), total > 15 ? total - 15 : 0);
});

test("digest decisions: impact order, numbers, labels, mine", () => {
  // The digest's byImpact, as a sign
  const sign = (x: number) => Math.sign(x);
  for (let n = 0; n < 3000; n++) {
    const [ba, bb, da, db] = [0, 0, 0, 0].map(() => Math.floor(next() * 3)) as [
      number,
      number,
      number,
      number,
    ];
    const sa = next() < 0.3 ? "" : draw(["2026-11-2", "1", "2"], 2);
    const sb = next() < 0.3 ? "" : draw(["2026-11-2", "1", "2"], 2);
    const oracle = bb - ba || db - da || (sa || "9").localeCompare(sb || "9");
    assert.equal(sign(impactOrder(ba, bb, da, db, sa, sb)), sign(oracle));
  }
  for (let n = 0; n < 2000; n++) {
    const d = draw(["0", "1", "7", "00"], 6) || "0";
    assert.equal(numberText(d), String(Number(d)), d);
  }
  assert.equal(shortRef("gh-site-007", ORG), "site#7");
  assert.equal(shortRef("bc-todo-12", ORG), "BC12");
  assert.equal(isMine(false, true), true);
  assert.equal(isMine(false, false), false);
});

test("list decisions", () => {
  for (const [a, b, c, d] of [
    [true, true, false, false],
    [true, false, true, true],
    [false, true, true, true],
    [false, false, true, false],
  ] as const)
    assert.equal(isListed(a, b, c, d), a ? b : c && d);
  assert.ok(issueOrder("a", "b", 9, 1) < 0);
  assert.ok(issueOrder("b", "b", 2, 10) < 0);
});

test("chart decisions", () => {
  for (let n = 0; n < 3000; n++) {
    const s = draw(["a", "Z", "9", "-", ".", '"', "<", ">", "&", "\u00e9", " "], 8);
    assert.equal(nodeId(s), `n_${s.replace(/[^a-zA-Z0-9]/g, "_")}`);
    assert.equal(chartLabel(s), s.replace(/"/g, "#quot;").replace(/[<>]/g, ""));
    assert.equal(htmlText(s), s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  }
  for (const length of [0, 47, 48, 49, 80]) {
    const t = "x".repeat(length);
    assert.equal(chartTitle(t), t.length > 48 ? `${t.slice(0, 47)}\u2026` : t);
  }
  for (const id of ["gh-acme.tool-3", "gh-site-12", "bc-todo-5", "gh-x"]) {
    const m = /^gh-(.+)-(\d+)$/.exec(id);
    assert.equal(chartRef(id), m ? `${m[1]}#${m[2]}` : id.replace(/^bc-todo-/, "BC"));
  }
  assert.equal(arrowOf(true), "==>");
  assert.equal(arrowOf(false), "-.->");
  // The chart's dependencyEdges: one per pair, closes winning
  const raw = [
    ["a", "b", false],
    ["a", "b", true],
    ["a", "c", true],
    ["a", "b", false],
    ["c", "a", false],
  ] as const;
  let edges = [] as ReturnType<typeof addEdge>;
  const oracle = new Map<string, { from: string; to: string; closes: boolean }>();
  for (const [from, to, closes] of raw) {
    edges = addEdge(edges, from, to, closes);
    const key = `${from}>${to}`;
    if (oracle.get(key)?.closes !== true) oracle.set(key, { from, to, closes });
  }
  assert.deepEqual(edges, [...oracle.values()]);
});

test("follow, GitHub and Basecamp item decisions", () => {
  assert.equal(isRootItem(true, false), true);
  assert.equal(isRootItem(false, false), false);
  assert.equal(followKind("bc-todo-1", ORG, false), "basecamp");
  assert.equal(followKind("gh-acme.tool-1", ORG, false), "external");
  assert.equal(followKind("nonsense", ORG, false), "external");
  assert.equal(followKind("gh-site-1", ORG, true), "owned");
  assert.equal(followKind("gh-site-1", ORG, false), "pull");
  assert.equal(todoProject("1", "2", ["3"]), "1");
  assert.equal(todoProject("", "2", ["3"]), "2");
  assert.equal(todoProject("", "", ["3"]), "3");
  assert.equal(todoProject("", "", ["3", "4"]), "");
  const page = "https://github.com/SimpleApps-Com/Site/issues/4";
  assert.equal(movedAway(page, ORG, "site"), false);
  assert.equal(movedAway(page, ORG, "other"), true);
  assert.equal(isPruned(true, false, false), true);
  assert.equal(isPruned(true, true, false), false);
  assert.equal(isHubFor("site", [], "site"), true);
  assert.equal(isHubFor("hub", ["site"], "site"), true);
  assert.equal(isHubFor("hub", [], "site"), false);
  assert.equal(issueKind(true), "pull");
  assert.equal(issueKind(false), "issue");
  assert.equal(statusOf(true), "closed");
  assert.equal(statusOf(false), "open");
  for (const name of ["gh-site-1", "gh-site-", "gh-site-1a", "gh-sites-1", "gh-site-22"])
    for (const open of [false, true]) {
      const prefix = "gh-site-";
      const oracle = name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)) && !open;
      assert.equal(isClosedItem(name, prefix, open), oracle, name);
    }
  assert.equal(orUnknown(""), "unknown");
  assert.equal(orUnknown("Ann"), "Ann");
  // basecamp.mjs slug; toLowerCase and ASCII lowering agree on these (not on the Kelvin sign or dotted I)
  for (let n = 0; n < 4000; n++) {
    const name = draw(["Acme", " ", "-", "&", "Co.", "9", "\u00e9", "--", "_"], 5);
    const oracle = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    assert.equal(slug(name), oracle, name);
    assert.equal(hubIdFor(name, "77"), oracle || "basecamp-77");
  }
  for (let n = 0; n < 3000; n++) {
    const html = draw(["<br>", "<BR/>", "<br />", "<br", " ", "/", ">", "x", "\n"], 6);
    assert.equal(plainText(html), html.replace(/<br\s*\/?>/gi, "\n"), JSON.stringify(html));
  }
});
