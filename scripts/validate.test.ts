import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { report, validate } from "./validate.ts";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "validate.ts");
const VERSION = "2026.11.1";
const roots: string[] = [];

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

const skill = (name, body = "Does a thing.", extra = "") =>
  `---\nname: ${name}\ndescription: "Use when testing"\n${extra}---\n\n${body}\n`;
const command = (name, body = "Run it.") =>
  `---\nname: ${name}\ndescription: Test command\n---\n\n${body}\n`;
const words = (count) => Array.from({ length: count }, () => "word").join(" ");
const marketplace = (entries) => JSON.stringify({ name: "augur", plugins: entries });
const entry = (name) => ({ name, source: `./plugins/${name}` });
const server = (key, host = "demo") => ({
  [key]: {
    type: "http",
    url: `https://${host}.augur-mcp.com/mcp`,
    title: key,
    description: "Does a thing.",
  },
});

/** A valid one-plugin repo, with `files` (path → text, or null to leave out) laid over it. */
async function repo(files = {}) {
  const root = await mkdtemp(join(tmpdir(), "validate-"));
  roots.push(root);
  const base = {
    ".claude-plugin/marketplace.json": marketplace([entry("demo")]),
    "plugins/demo/.claude-plugin/plugin.json": JSON.stringify({ name: "demo", version: VERSION }),
    "plugins/demo/.mcp.json": JSON.stringify({ mcpServers: server("Demo") }),
    "plugins/demo/skills/alpha/SKILL.md": skill("alpha"),
    "plugins/demo/commands/go.md": command("go", 'Load Skill("alpha") then Skill("demo:alpha").'),
    ".claude/CLAUDE.md": "# Demo\n",
  };
  for (const [path, text] of Object.entries({ ...base, ...files })) {
    if (text === null) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

test("a valid repo passes and counts its skills", async () => {
  const result = await validate(await repo());
  assert.deepEqual(result, { errors: [], warnings: [], skillCount: 1 });
});

test("marketplace.json: no versions, and every source is an existing ./plugins/<name>", async () => {
  const root = await repo({
    ".claude-plugin/marketplace.json": JSON.stringify({
      version: VERSION,
      plugins: [
        { ...entry("demo"), version: VERSION },
        { name: "moved", source: "./elsewhere/moved" },
        entry("ghost"),
      ],
    }),
  });
  assert.deepEqual((await validate(root)).errors, [
    ".claude-plugin/marketplace.json MUST NOT set version (versions live in plugin.json)",
    ".claude-plugin/marketplace.json plugins[0] (demo) MUST NOT set version",
    ".claude-plugin/marketplace.json plugins[1] (moved) source is ./elsewhere/moved, expected ./plugins/moved",
    ".claude-plugin/marketplace.json plugins[2] (ghost) source ./plugins/ghost does not exist",
  ]);
});

test("a missing marketplace is reported once and skips the listing check", async () => {
  const missing = await validate(await repo({ ".claude-plugin/marketplace.json": null }));
  assert.deepEqual(missing.errors, ["Missing or invalid .claude-plugin/marketplace.json"]);

  const noPlugins = await validate(
    await repo({
      ".claude-plugin/marketplace.json": JSON.stringify({ name: "augur" }),
      "plugins/demo/.claude-plugin/plugin.json": null,
    }),
  );
  assert.deepEqual(noPlugins.errors, [
    "Missing or invalid plugins/demo/.claude-plugin/plugin.json",
    "plugins/demo is not listed in .claude-plugin/marketplace.json",
  ]);
});

test("plugin.json: name, CalVer version, no privacyPolicyUrl; no bin/; files in plugins/ ignored", async () => {
  const root = await repo({
    "plugins/demo/.claude-plugin/plugin.json": JSON.stringify({
      name: "other",
      version: "2026.13.1",
      privacyPolicyUrl: "https://example.com/privacy",
    }),
    "plugins/demo/bin/tool": "#!/bin/sh\n",
    "plugins/notes.txt": "a file, not a plugin",
  });
  assert.deepEqual((await validate(root)).errors, [
    'plugins/demo/.claude-plugin/plugin.json name="other" but folder="demo"',
    'plugins/demo/.claude-plugin/plugin.json version="2026.13.1" is not CalVer YYYY.M.seq',
    "plugins/demo/.claude-plugin/plugin.json MUST NOT set privacyPolicyUrl (claude.ai's sync rejects it; use a README Privacy section)",
    "plugins/demo/bin/ makes chat and Cowork refuse the plugin",
  ]);
});

test("skill frontmatter, naming and missing files", async () => {
  const root = await repo({
    "plugins/demo/skills/no-file/README.md": "not a skill",
    "plugins/demo/skills/no-front/SKILL.md": "Just text.\n",
    "plugins/demo/skills/empty-front/SKILL.md": "---\nlicense: MIT\n---\n",
    "plugins/demo/skills/Bad_Name/SKILL.md": skill("Bad_Name"),
    "plugins/demo/skills/renamed/SKILL.md": skill("something-else"),
    "plugins/demo/skills/loose-file.md": "a file, not a skill folder",
  });
  const { errors, skillCount } = await validate(root);
  assert.deepEqual(
    errors.sort(),
    [
      'Invalid name "Bad_Name" in plugins/demo/skills/Bad_Name/SKILL.md (must be kebab-case, start with a letter, <=64 chars)',
      "Missing SKILL.md: plugins/demo/skills/no-file/SKILL.md",
      "Missing description in frontmatter: plugins/demo/skills/empty-front/SKILL.md",
      "Missing name in frontmatter: plugins/demo/skills/empty-front/SKILL.md",
      "No frontmatter: plugins/demo/skills/no-front/SKILL.md",
      'Name mismatch: plugins/demo/skills/renamed/SKILL.md frontmatter name="something-else" but directory="renamed"',
    ].sort(),
  );
  // alpha, Bad_Name, empty-front and renamed have frontmatter, so they count
  assert.equal(skillCount, 4);
});

test("skills: claude.ai's six keys only, no anthropic/claude in names, description ≤ 1,024", async () => {
  const root = await repo({
    "plugins/demo/skills/extra-keys/SKILL.md": skill(
      "extra-keys",
      "Body.",
      "when_to_use: later\nallowed-tools:\n  - Read\nmodel: opus\n",
    ),
    "plugins/demo/skills/claude-helper/SKILL.md": skill("claude-helper"),
    "plugins/demo/skills/long/SKILL.md": `---\nname: long\ndescription: ${"x".repeat(1025)}\n---\n`,
  });
  assert.deepEqual((await validate(root)).errors.sort(), [
    "Description in plugins/demo/skills/long/SKILL.md is 1025 characters (limit 1024)",
    'Frontmatter key "model" in plugins/demo/skills/extra-keys/SKILL.md is rejected by claude.ai',
    'Frontmatter key "when_to_use" in plugins/demo/skills/extra-keys/SKILL.md is rejected by claude.ai',
    'Invalid name "claude-helper" in plugins/demo/skills/claude-helper/SKILL.md (must not contain anthropic or claude)',
  ]);
});

test("the token budget warns from 3,376 words and fails above 3,750", async () => {
  const root = await repo({
    "plugins/demo/skills/near/SKILL.md": skill("near", words(3400)),
    "plugins/demo/skills/over/SKILL.md": skill("over", words(3800)),
  });
  const { errors, warnings } = await validate(root);
  assert.equal(warnings.length, 1);
  assert.match(
    warnings.join(),
    /^Approaching token limit: plugins\/demo\/skills\/near\/SKILL\.md is \d+ words/,
  );
  assert.equal(errors.length, 1);
  assert.match(errors.join(), /^Token budget exceeded: plugins\/demo\/skills\/over\/SKILL\.md/);
});

test("commands: frontmatter, name, and Skill() references outside code", async () => {
  const root = await repo({
    "plugins/demo/commands/notes.txt": "ignored, not markdown",
    "plugins/demo/commands/bare.md": "No frontmatter here.\n",
    "plugins/demo/commands/misnamed.md": command("other"),
    "plugins/demo/commands/refs.md": command(
      "refs",
      'Skill("missing") and Skill(\'demo:gone\') and Skill("demo:alpha:extra").\n\n```\nSkill("in-a-fence")\n```\n\n`Skill("inline-code")`',
    ),
  });
  const { errors } = await validate(root);
  assert.deepEqual(errors, [
    "No frontmatter: plugins/demo/commands/bare.md",
    'Name mismatch: plugins/demo/commands/misnamed.md frontmatter name="other" but file="misnamed.md"',
    'Unknown Skill("missing") in plugins/demo/commands/refs.md',
    'Unknown Skill("demo:gone") in plugins/demo/commands/refs.md',
  ]);
});

test(".mcp.json: http on augur-mcp.com, keyed by title, described, no auth fields", async () => {
  const listed = marketplace(["demo", "shapes", "broken", "nulled"].map(entry));
  const plugin = (name) => JSON.stringify({ name, version: VERSION });
  const root = await repo({
    ".claude-plugin/marketplace.json": listed,
    "plugins/demo/.mcp.json": JSON.stringify({
      mcpServers: {
        Wrong: {
          type: "sse",
          url: "https://evil.example.com/mcp",
          title: "Other",
          headers: { Authorization: "x" },
          headersHelper: "x",
          oauth: {},
        },
        Empty: null,
      },
    }),
    "plugins/shapes/.claude-plugin/plugin.json": plugin("shapes"),
    "plugins/shapes/.mcp.json": JSON.stringify({ servers: {} }),
    "plugins/broken/.claude-plugin/plugin.json": plugin("broken"),
    "plugins/broken/.mcp.json": "{ not json",
    "plugins/nulled/.claude-plugin/plugin.json": plugin("nulled"),
    "plugins/nulled/.mcp.json": JSON.stringify({ mcpServers: null }),
  });
  assert.deepEqual((await validate(root)).errors, [
    "plugins/broken/.mcp.json is not valid JSON",
    'plugins/demo/.mcp.json "Wrong" type MUST be "http"',
    'plugins/demo/.mcp.json "Wrong" url MUST be https://<service>.augur-mcp.com/...',
    'plugins/demo/.mcp.json "Wrong" title MUST equal its key "Wrong"',
    'plugins/demo/.mcp.json "Wrong" MUST have a description',
    'plugins/demo/.mcp.json "Wrong" MUST NOT set headers',
    'plugins/demo/.mcp.json "Wrong" MUST NOT set headersHelper',
    'plugins/demo/.mcp.json "Wrong" MUST NOT set oauth',
    'plugins/demo/.mcp.json "Empty" type MUST be "http"',
    'plugins/demo/.mcp.json "Empty" url MUST be https://<service>.augur-mcp.com/...',
    'plugins/demo/.mcp.json "Empty" title MUST equal its key "Empty"',
    'plugins/demo/.mcp.json "Empty" MUST have a description',
    'plugins/nulled/.mcp.json MUST have an "mcpServers" object',
    'plugins/shapes/.mcp.json MUST have an "mcpServers" object',
  ]);
});

test("hooks.json: valid JSON, hooks or modules, and every plugin-root file it runs exists", async () => {
  const hookCommand = (file) =>
    JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [{ type: "command", command: "node", args: [`\${CLAUDE_PLUGIN_ROOT}/${file}`] }],
          },
        ],
      },
    });
  const plugin = (name) => JSON.stringify({ name, version: VERSION });
  const good = await repo({
    ".claude-plugin/marketplace.json": marketplace(["demo", "mod"].map(entry)),
    "plugins/demo/hooks/hooks.json": hookCommand("hooks/run.mjs"),
    "plugins/demo/hooks/run.mjs": "",
    "plugins/mod/.claude-plugin/plugin.json": plugin("mod"),
    "plugins/mod/hooks/hooks.json": '{ "modules": ["./register.tsx"] }',
  });
  assert.deepEqual((await validate(good)).errors, []);

  const names = ["demo", "empty", "nulled", "broken"];
  const files = Object.fromEntries(
    names.slice(1).map((n) => [`plugins/${n}/.claude-plugin/plugin.json`, plugin(n)]),
  );
  const bad = await repo({
    ...files,
    ".claude-plugin/marketplace.json": marketplace(names.map(entry)),
    "plugins/demo/hooks/hooks.json": hookCommand("hooks/missing.mjs"),
    "plugins/empty/hooks/hooks.json": "{}",
    "plugins/nulled/hooks/hooks.json": "null",
    "plugins/broken/hooks/hooks.json": "{ not json",
  });
  assert.deepEqual((await validate(bad)).errors, [
    "plugins/broken/hooks/hooks.json is not valid JSON",
    "plugins/demo/hooks/hooks.json runs plugins/demo/hooks/missing.mjs, which does not exist",
    'plugins/empty/hooks/hooks.json MUST have a "hooks" object or a "modules" list',
    'plugins/nulled/hooks/hooks.json MUST have a "hooks" object or a "modules" list',
  ]);
});

test(".lsp.json: servers name a binary and their extensions, and hold no secret (GH #36)", async () => {
  const plugin = (name) => JSON.stringify({ name, version: VERSION });
  const server = (extra = {}) => ({
    command: "intelephense",
    args: ["--stdio"],
    extensionToLanguage: { ".php": "php" },
    ...extra,
  });
  const good = await repo({
    ".claude-plugin/marketplace.json": marketplace(["demo", "lsp", "abs"].map(entry)),
    "plugins/lsp/.claude-plugin/plugin.json": plugin("lsp"),
    "plugins/lsp/.lsp.json": JSON.stringify({
      intelephense: server({ settings: { intelephense: { maxMemory: 4096 } } }),
    }),
    "plugins/abs/.claude-plugin/plugin.json": plugin("abs"),
    "plugins/abs/.lsp.json": JSON.stringify({ x: server({ command: "/opt/my tools/x" }) }),
  });
  assert.deepEqual((await validate(good)).errors, []);

  const names = ["broken", "list", "spaced", "nomap", "secret", "odd"];
  const files = Object.fromEntries(
    names.map((n) => [`plugins/${n}/.claude-plugin/plugin.json`, plugin(n)]),
  );
  const bad = await repo({
    ...files,
    ".claude-plugin/marketplace.json": marketplace(["demo", ...names].map(entry)),
    "plugins/broken/.lsp.json": "{ not json",
    "plugins/list/.lsp.json": "[]",
    "plugins/spaced/.lsp.json": JSON.stringify({ s: server({ command: "intelephense --stdio" }) }),
    "plugins/nomap/.lsp.json": JSON.stringify({ n: { command: "x", extensionToLanguage: [] } }),
    "plugins/secret/.lsp.json": JSON.stringify({
      k: server({ initializationOptions: { licenceKey: "x" }, settings: { licenseKey: "y" } }),
    }),
    "plugins/odd/.lsp.json": JSON.stringify({ o: "not a server" }),
  });
  assert.deepEqual((await validate(bad)).errors, [
    "plugins/broken/.lsp.json is not valid JSON",
    "plugins/list/.lsp.json MUST be an object of servers",
    'plugins/nomap/.lsp.json "n" MUST have an "extensionToLanguage" object',
    'plugins/odd/.lsp.json "o" MUST have a "command" naming a binary (no spaces unless an absolute path)',
    'plugins/odd/.lsp.json "o" MUST have an "extensionToLanguage" object',
    'plugins/secret/.lsp.json MUST NOT hold a secret: "licenceKey"',
    'plugins/secret/.lsp.json MUST NOT hold a secret: "licenseKey"',
    'plugins/spaced/.lsp.json "s" MUST have a "command" naming a binary (no spaces unless an absolute path)',
  ]);
});

test("proofs: proved files are listed, and hand-written Dafny never escapes the proof", async () => {
  const proved = "//@ backend dafny\nexport function f() {}\n";
  const good = await repo({
    "LemmaScript-files.txt": "scripts/rules.ts 30\nplugins/demo/scripts/pane-rules.ts\n",
    "scripts/rules.ts": proved,
    "plugins/demo/scripts/pane-rules.ts": proved,
    "plugins/demo/scripts/pane-rules.dfy.gen": "function g(): int { 2 }\n",
    "plugins/demo/scripts/pane-rules.dfy": "function g(): int { 2 }\n",
    "scripts/plain.ts": "export const x = 1;\n",
    "scripts/rules.dfy.gen": "function f(): int { 1 }\n",
    "scripts/rules.dfy": "function f(): int { 1 }\n// assume nothing: comments are fine\n",
    "models/README.md": "not Dafny",
    "models/Model.dfy": "module M {}\n",
  });
  assert.deepEqual((await validate(good)).errors, []);

  const bad = await repo({
    "scripts/unlisted.ts": proved,
    "scripts/rules.dfy.gen": "function f(): int { 1 }\n",
    "scripts/rules.dfy": "function f(): int { 1 }\nlemma L() { assume false; }\n",
    "scripts/orphan.dfy": "method M() { expect true; }\n",
    "models/Model.dfy": "lemma {:axiom} A()\n",
    "models/links/link.dfy": "lemma {:verify false} B() {}\n",
    "plugins/demo/scripts/pane-rules.ts": proved,
    "plugins/demo/scripts/pane-rules.dfy": "lemma {:trusted} T() {}\n",
    "plugins/demo/skills/tool/scripts/tool-rules.ts": proved,
    "plugins/demo/skills/tool/scripts/tool-rules.dfy": "lemma {:axiom} S()\n",
  });
  assert.deepEqual((await validate(bad)).errors, [
    "Missing SKILL.md: plugins/demo/skills/tool/SKILL.md",
    "scripts/orphan.dfy escapes the proof: method M() { expect true; }",
    "scripts/rules.dfy escapes the proof: lemma L() { assume false; }",
    "scripts/unlisted.ts is proved but not listed in LemmaScript-files.txt",
    "plugins/demo/scripts/pane-rules.dfy escapes the proof: lemma {:trusted} T() {}",
    "plugins/demo/scripts/pane-rules.ts is proved but not listed in LemmaScript-files.txt",
    "plugins/demo/skills/tool/scripts/tool-rules.dfy escapes the proof: lemma {:axiom} S()",
    "plugins/demo/skills/tool/scripts/tool-rules.ts is proved but not listed in LemmaScript-files.txt",
    "models/Model.dfy escapes the proof: lemma {:axiom} A()",
    "models/links/link.dfy escapes the proof: lemma {:verify false} B() {}",
  ]);
});

test("CLAUDE.md warns past 180 lines, fails past 200, and may be absent", async () => {
  const lines = (count) => Array.from({ length: count }, (_, i) => `line ${i}`).join("\n");
  const near = await validate(await repo({ ".claude/CLAUDE.md": lines(190) }));
  assert.deepEqual(near.warnings, [".claude/CLAUDE.md is 190 lines (approaching 200 limit)"]);
  const over = await validate(await repo({ ".claude/CLAUDE.md": lines(210) }));
  assert.deepEqual(over.errors, [".claude/CLAUDE.md is 210 lines (Claude Code limit is 200)"]);
  const absent = await validate(await repo({ ".claude/CLAUDE.md": null }));
  assert.deepEqual(absent.errors, []);
});

test("shared blocks: two or more identical copies pass; differing, lone or stray fail", async () => {
  const block = (body) => `\n<!-- shared:git -->\n${body}\n<!-- /shared:git -->\n`;
  const alpha = "plugins/demo/skills/alpha/SKILL.md";
  const beta = "plugins/demo/skills/beta/SKILL.md";
  const same = await validate(
    await repo({ [alpha]: skill("alpha") + block("rule"), [beta]: skill("beta") + block("rule") }),
  );
  assert.deepEqual(same.errors, []);
  const differs = await validate(
    await repo({ [alpha]: skill("alpha") + block("rule"), [beta]: skill("beta") + block("other") }),
  );
  assert.deepEqual(differs.errors, [`Shared block "git" in ${beta} differs from ${alpha}`]);
  const lone = await validate(await repo({ [alpha]: skill("alpha") + block("rule") }));
  assert.deepEqual(lone.errors, [`Shared block "git" has only one copy (${alpha})`]);
  const unclosed = await validate(
    await repo({ [alpha]: skill("alpha") + "<!-- shared:git -->\n" }),
  );
  assert.deepEqual(unclosed.errors, [`Shared-block marker outside a matched block in ${alpha}`]);
  const stray = await validate(
    await repo({
      [alpha]: skill("alpha") + block("rule") + "<!-- /shared:git -->\n",
      [beta]: skill("beta") + block("rule"),
    }),
  );
  assert.deepEqual(stray.errors, [`Shared-block marker outside a matched block in ${alpha}`]);
});

test("an empty folder reports only the missing marketplace", async () => {
  const root = await mkdtemp(join(tmpdir(), "validate-empty-"));
  roots.push(root);
  assert.deepEqual(await validate(root), {
    errors: ["Missing or invalid .claude-plugin/marketplace.json"],
    warnings: [],
    skillCount: 0,
  });
});

test("report: pass, warnings, and failure with exit code 1", () => {
  assert.deepEqual(report({ errors: [], warnings: [], skillCount: 3 }), {
    text: "PASS: 3 skill(s) validated",
    exitCode: 0,
  });
  assert.deepEqual(report({ errors: [], warnings: ["w"], skillCount: 1 }), {
    text: "WARN (1):\n  - w\n\nPASS: 1 skill(s) validated",
    exitCode: 0,
  });
  assert.deepEqual(report({ errors: ["e1", "e2"], warnings: ["w"], skillCount: 1 }), {
    text: "WARN (1):\n  - w\n\nFAIL (2):\n  - e1\n  - e2",
    exitCode: 1,
  });
});

const MISSING = "FAIL (1):\n  - Missing or invalid .claude-plugin/marketplace.json\n";

test("run directly, it prints the report and sets the exit code", async () => {
  const pass = spawnSync(process.execPath, [SCRIPT], { cwd: await repo(), encoding: "utf8" });
  assert.equal(pass.status, 0);
  assert.equal(pass.stdout, "PASS: 1 skill(s) validated\n");
  const fail = spawnSync(process.execPath, [SCRIPT], {
    cwd: await repo({ ".claude-plugin/marketplace.json": null }),
    encoding: "utf8",
  });
  assert.equal(fail.status, 1);
  assert.equal(fail.stdout, MISSING);
});

test("run through a symlink, it still validates", async () => {
  const linkDir = await mkdtemp(join(tmpdir(), "validate-link-"));
  roots.push(linkDir);
  const link = join(linkDir, "validate.ts");
  await symlink(SCRIPT, link);
  const fail = spawnSync(process.execPath, [link], {
    cwd: await repo({ ".claude-plugin/marketplace.json": null }),
    encoding: "utf8",
  });
  assert.equal(fail.status, 1);
  assert.equal(fail.stdout, MISSING);
});
