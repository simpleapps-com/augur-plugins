// Pins each proved rule in rules.ts to the runtime: the proof says what the Dafny model decides;
// these say JavaScript decides the same, against the regex each rule replaced as the oracle.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  budgetOf,
  descriptionFits,
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

test("isConnectorUrl is https://<label>.augur-mcp.com/...", () => {
  const oracle = /^https:\/\/[a-z0-9-]+\.augur-mcp\.com\//;
  const seeds = [
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
  agrees(isConnectorUrl, oracle, [...seeds, ...inputs]);
});

test("isSecretKey is a licence key in either spelling; isLspCommand is a binary (GH #36)", () => {
  for (const k of ["licenceKey", "licenseKey", "LicenceKey", "licence", "maxMemory", ""])
    assert.equal(isSecretKey(k), k === "licenceKey" || k === "licenseKey", k);
  // The oracle: non-empty, and an absolute path or no space
  const oracle = /^(\/.*|[^ ]+)$/s;
  agrees(isLspCommand, oracle, samples("a/ -", 6, 20000, ["intelephense", "/opt/x y", "a b", ""]));
});
