// Pins each proved rule in rules.ts to the runtime: the proof says what the Dafny model decides;
// these say JavaScript decides the same, against the regex each rule replaced as the oracle.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  budgetOf,
  descriptionFits,
  hasHelpSection,
  hintListsHelp,
  sameDescription,
  isCalVer,
  isConnectorUrl,
  isLspCommand,
  isReservedName,
  isSecretKey,
  isSkillKey,
  isSkillName,
} from "./rules.ts";

/** A seeded generator (mulberry32), so a failure reproduces. */
function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` strings of up to `max` characters drawn from `alphabet`, plus the `seeds`. */
function samples(alphabet, max, count, seeds) {
  const next = random(20261122);
  const out = [...seeds];
  for (let n = 0; n < count; n++) {
    const length = Math.floor(next() * (max + 1));
    let s = "";
    for (let i = 0; i < length; i++) s += alphabet[Math.floor(next() * alphabet.length)];
    out.push(s);
  }
  return out;
}

function agrees(rule, oracle, inputs) {
  for (const s of inputs) assert.equal(rule(s), oracle.test(s), JSON.stringify(s));
}

test("isCalVer is YYYY.M.seq, no leading zeros", () => {
  const oracle = /^[1-9]\d{3}\.([1-9]|1[0-2])\.[1-9]\d*$/;
  const seeds = [
    "2026.11.1",
    "2026.1.1",
    "2026.12.30",
    "2026.01.1",
    "2026.13.1",
    "2026.10.0",
    "0026.1.1",
    "2026.1.",
    "2026.11",
    "2026x11.1",
    "20261.1.1",
    "2026.1.1a",
    "2026.10.1",
    "2026.1a.1",
  ];
  const generated = samples("0123456789.", 11, 20000, seeds);
  // Mostly well-formed shapes, so the month and release branches are well covered
  const shaped = samples("0129.", 3, 3000, []).map((t) => `2026.${t}`);
  agrees(isCalVer, oracle, [...generated, ...shaped]);
});

test("isSkillKey is exactly the six claude.ai keys", () => {
  const keys = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
  for (const k of keys) assert.equal(isSkillKey(k), true, k);
  for (const k of ["when_to_use", "model", "Name", "", "allowed_tools", "names"])
    assert.equal(isSkillKey(k), false, k);
});

test("isSkillName is kebab-case, a letter first, at most 64", () => {
  const oracle = /^[a-z][a-z0-9-]{0,63}$/;
  const seeds = ["a", "site-data", "a".repeat(64), "a".repeat(65), "", "1abc", "-a", "Ab", "a_b"];
  agrees(isSkillName, oracle, samples("ab09-_A", 70, 20000, seeds));
});

test("isReservedName finds anthropic or claude anywhere", () => {
  const oracle = /anthropic|claude/;
  const seeds = ["claude", "my-claude-helper", "anthropic", "xanthropicx", "clau", "", "claud"];
  agrees(isReservedName, oracle, samples("claudenthropi-", 14, 20000, seeds));
});

/**
 * `count` texts that hold `needle`, or a near miss (one code unit changed, or one dropped), between
 * random runs of `alphabet`, so both sides of a search are well covered.
 */
function embedded(needle: string, alphabet: string, count: number): string[] {
  const next = random(20261125);
  const pick = (s: string) => s[Math.floor(next() * s.length)] ?? "";
  const run = () => {
    let s = "";
    for (let i = Math.floor(next() * 6); i > 0; i--) s += pick(alphabet);
    return s;
  };
  const out: string[] = [];
  for (let n = 0; n < count; n++) {
    const at = Math.floor(next() * needle.length);
    const kind = Math.floor(next() * 3);
    const middle =
      kind === 0
        ? needle
        : kind === 1
          ? needle.slice(0, at) + pick(alphabet) + needle.slice(at + 1)
          : needle.slice(0, at) + needle.slice(at + 1);
    out.push(run() + middle + run());
  }
  return out;
}

test("hasHelpSection finds the shared Help block's marker and heading", () => {
  const needle = "<!-- shared:help -->\n## Help\n";
  const oracle = /<!-- shared:help -->\n## Help\n/;
  const seeds = [
    `# Repo\n\n${needle}\nHow.`,
    "# Repo\n\n## Help\n\nHow.",
    "<!-- shared:help -->\n## Help",
    "<!-- shared:help -->\n\n## Help\n",
    "",
  ];
  agrees(hasHelpSection, oracle, [...seeds, ...embedded(needle, "\n# Help<!->", 20000)]);
});

test("hintListsHelp finds | help] or [help]", () => {
  const oracle = / \| help\]|\[help\]/;
  const seeds = [
    "[write | audit | help]",
    "[status | help] [...]",
    "[help]",
    "[write | audit]",
    "| help]",
    "[help",
    "",
  ];
  const generated = [
    ...embedded(" | help]", " |help[]a", 10000),
    ...embedded("[help]", " |help[]a", 10000),
  ];
  agrees(hintListsHelp, oracle, [...seeds, ...generated]);
});

test("sameDescription is exact equality", () => {
  assert.equal(sameDescription("Ships code.", "Ships code."), true);
  for (const [a, b] of [
    ["Ships code", "Ships code."],
    ["ships code.", "Ships code."],
    ["", "x"],
  ] as const)
    assert.equal(sameDescription(a, b), false, `${a} vs ${b}`);
});

test("descriptionFits is at most 1,024", () => {
  assert.equal(descriptionFits(0), true);
  assert.equal(descriptionFits(1024), true);
  assert.equal(descriptionFits(1025), false);
});

test("budgetOf fits to 3,375, warns to 3,750, fails above", () => {
  assert.equal(budgetOf(0), "fits");
  assert.equal(budgetOf(3375), "fits");
  assert.equal(budgetOf(3376), "near");
  assert.equal(budgetOf(3750), "near");
  assert.equal(budgetOf(3751), "over");
});

test("isConnectorUrl is https://<label>.augur-mcp.com/... or https://mcp.semrush.com/... (GH #64)", () => {
  const oracle = /^https:\/\/[a-z0-9-]+\.augur-mcp\.com\/|^https:\/\/mcp\.semrush\.com\//;
  const seeds = [
    "https://mcp.semrush.com/v2/mcp",
    "https://mcp.semrush.com/",
    "https://mcp.semrush.com",
    "https://mcp.semrush.com.example.io/mcp",
    "https://xmcp.semrush.com/v2/mcp",
    "http://mcp.semrush.com/v2/mcp",
    "https://intelligence.augur-mcp.com/mcp",
    "https://api.augur-mcp.com/mcp",
    "https://augur-mcp.com/mcp",
    "https://evil.example.com/.augur-mcp.com/",
    "http://api.augur-mcp.com/mcp",
    "https://API.augur-mcp.com/mcp",
    "https://a.augur-mcp.com",
    "https:/",
    "",
  ];
  const labels = samples("ab-.A", 6, 20000, []);
  const inputs = labels.map((l) => `https://${l}.augur-mcp.com/x`);
  const vendors = embedded("https://mcp.semrush.com/", "mcp.semrush/v2", 20000);
  agrees(isConnectorUrl, oracle, [...seeds, ...inputs, ...vendors]);
});

test("isSecretKey is a licence key in either spelling; isLspCommand is a binary (GH #36)", () => {
  for (const k of ["licenceKey", "licenseKey", "LicenceKey", "licence", "maxMemory", ""])
    assert.equal(isSecretKey(k), k === "licenceKey" || k === "licenseKey", k);
  // The oracle: non-empty, and an absolute path or no space
  const oracle = /^(\/.*|[^ ]+)$/s;
  agrees(isLspCommand, oracle, samples("a/ -", 6, 20000, ["intelephense", "/opt/x y", "a b", ""]));
});
