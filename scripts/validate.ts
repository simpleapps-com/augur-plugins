#!/usr/bin/env node

// Plugin validator for the augur marketplace. Catches what `claude plugin validate` does not:
//   - marketplace.json: no `version` anywhere; every entry's source is ./plugins/<name> and exists
//   - plugin.json: name matches its folder, CalVer YYYY.M.seq version, no privacyPolicyUrl
//     (claude.ai's sync rejects it), and every plugin folder is listed in the marketplace
//   - no top-level bin/ in a plugin (chat and Cowork refuse the whole plugin)
//   - SKILL.md: only the six frontmatter keys claude.ai accepts, name rules, description
//     length, name/directory match, 5K-token budget
//   - Skill("X") references in commands resolve to a real skill
//   - .mcp.json: http servers on augur-mcp.com, keyed by their title, with a description,
//     and no headers, headersHelper, or oauth
//   - hooks/hooks.json parses, has hooks or modules, and every ${CLAUDE_PLUGIN_ROOT} file exists
//   - .lsp.json parses; each server has a binary `command` and an `extensionToLanguage` map, and
//     no key anywhere holds a secret (a licence key would ship to every installer)
//   - proofs: every proved file is listed in LemmaScript-files.txt, and no hand-written Dafny
//     uses assume, {:axiom}, {:verify false}, {:trusted} or expect
//   - CLAUDE.md under 200 lines
//   - shared blocks (`<!-- shared:<name> -->` … `<!-- /shared:<name> -->`) in SKILL.md files are
//     closed, and every copy of a name is identical, so safeguards copied between skills cannot drift
//
// Rules: wiki/Plugin-Format.md and wiki/Skill-Authoring.md. Every decision about a value is a
// proved function in `rules.ts` (model: models/Marketplace.dfy); this file only reads files and
// reports. Run with Node's type stripping: `node scripts/validate.ts`, from the repo root.
// `validate(root)` is exported for scripts/validate.test.ts.

import { realpathSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

const CONNECTOR_BANNED = ["headers", "headersHelper", "oauth"];

/** Proof escapes a hand-written line MUST NOT use: each makes Dafny accept what it did not prove. */
const PROOF_ESCAPES = /\bassume\b|\{:axiom\}|\{:verify false\}|\{:trusted\}|\bexpect\b/;

/** A shared block, and any marker at all (to find markers outside a matched block). */
const SHARED_BLOCK = /<!-- shared:([a-z-]+) -->([\s\S]*?)<!-- \/shared:\1 -->/g;
const SHARED_MARKER = /<!--\s*\/?shared:/g;

/** Parsed JSON whose shape is checked field by field. */
type Json = Record<string, unknown>;

/** One validation run: the paths it reads and what it found. */
interface Run {
  root: string;
  pluginsDir: string;
  errors: string[];
  warnings: string[];
  shared: { name: string; rel: string; block: string }[];
}

export interface Result {
  errors: string[];
  warnings: string[];
  skillCount: number;
}

function parseFrontmatter(text: string): Record<string, string> | null {
  const m = text.match(/^---\n(?<body>[\s\S]*?)\n---/);
  if (!m?.groups) return null;
  const fm: Record<string, string> = {};
  for (const line of String(m.groups.body).split("\n")) {
    const kv = line.match(/^(?<key>[a-zA-Z_-]+):\s*(?<value>.*)$/);
    if (kv?.groups)
      fm[String(kv.groups.key)] = String(kv.groups.value)
        .replace(/^["']|["']$/g, "")
        .trim();
  }
  return fm;
}

/** A JSON file under the root; null when missing or invalid. */
async function readJson(run: Run, relPath: string): Promise<Json | null> {
  try {
    return JSON.parse(await readFile(join(run.root, relPath), "utf8")) as Json;
  } catch {
    return null;
  }
}

/** A directory's entries, sorted so reports are stable on every filesystem; [] when it does not exist. */
async function listDir(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

/** A file's text; null when it does not exist. */
async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** True when `path` exists. */
async function exists(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null)) !== null;
}

/** The plugin folders under plugins/. */
async function listPlugins(run: Run): Promise<string[]> {
  const plugins: string[] = [];
  for (const name of await listDir(run.pluginsDir)) {
    if ((await stat(join(run.pluginsDir, name))).isDirectory()) plugins.push(name);
  }
  return plugins;
}

/**
 * marketplace.json: no versions, every entry points at an existing ./plugins/<name>.
 * Returns the listed names; null when the file is missing or invalid.
 */
async function checkMarketplace(run: Run): Promise<Set<string> | null> {
  const rel = ".claude-plugin/marketplace.json";
  const marketplace = await readJson(run, rel);
  if (!marketplace) {
    run.errors.push(`Missing or invalid ${rel}`);
    return null;
  }
  if ("version" in marketplace)
    run.errors.push(`${rel} MUST NOT set version (versions live in plugin.json)`);
  const names = new Set<string>();
  const entries = (marketplace.plugins ?? []) as Json[];
  for (const [i, entry] of entries.entries()) {
    names.add(String(entry.name));
    await checkEntry(run, `${rel} plugins[${i}] (${String(entry.name)})`, entry);
  }
  return names;
}

/** One marketplace entry: no version; source is ./plugins/<name> and exists. */
async function checkEntry(run: Run, where: string, entry: Json): Promise<void> {
  if ("version" in entry) run.errors.push(`${where} MUST NOT set version`);
  const expected = `./plugins/${String(entry.name)}`;
  if (entry.source !== expected)
    run.errors.push(`${where} source is ${String(entry.source)}, expected ${expected}`);
  else if (!(await exists(join(run.root, expected))))
    run.errors.push(`${where} source ${expected} does not exist`);
}

/** One plugin's plugin.json, its marketplace listing, and its top level. */
async function checkPlugin(run: Run, plugin: string, listed: Set<string> | null): Promise<void> {
  const rel = `plugins/${plugin}/.claude-plugin/plugin.json`;
  const pj = await readJson(run, rel);
  if (!pj) run.errors.push(`Missing or invalid ${rel}`);
  else checkPluginJson(run, rel, plugin, pj);
  if (listed && !listed.has(plugin))
    run.errors.push(`plugins/${plugin} is not listed in .claude-plugin/marketplace.json`);
  if (await exists(join(run.pluginsDir, plugin, "bin")))
    run.errors.push(`plugins/${plugin}/bin/ makes chat and Cowork refuse the plugin`);
}

/** name matches the folder, CalVer version, no privacyPolicyUrl. */
function checkPluginJson(run: Run, rel: string, plugin: string, pj: Json): void {
  if (pj.name !== plugin)
    run.errors.push(`${rel} name="${String(pj.name)}" but folder="${plugin}"`);
  if (!isCalVer(String(pj.version)))
    run.errors.push(`${rel} version="${String(pj.version)}" is not CalVer YYYY.M.seq`);
  if ("privacyPolicyUrl" in pj)
    run.errors.push(
      `${rel} MUST NOT set privacyPolicyUrl (claude.ai's sync rejects it; use a README Privacy section)`,
    );
}

async function checkPlugins(run: Run, plugins: string[]): Promise<void> {
  const listed = await checkMarketplace(run);
  for (const plugin of plugins) await checkPlugin(run, plugin, listed);
}

/**
 * Frontmatter `name`/`description` present; `name` equals `expected`. Null when there is none.
 * `shown` is how a mismatch names the source (`directory="x"`, `file="x.md"`).
 */
function checkFrontmatter(
  run: Run,
  text: string,
  rel: string,
  expected: string,
  shown: string,
): Record<string, string> | null {
  const fm = parseFrontmatter(text);
  if (!fm) {
    run.errors.push(`No frontmatter: ${rel}`);
    return null;
  }
  if (!fm.name) run.errors.push(`Missing name in frontmatter: ${rel}`);
  if (!fm.description) run.errors.push(`Missing description in frontmatter: ${rel}`);
  if (fm.name && fm.name !== expected)
    run.errors.push(`Name mismatch: ${rel} frontmatter name="${fm.name}" but ${shown}`);
  return fm;
}

/** Keys claude.ai rejects, name rules, and description length. */
function checkSkillFields(run: Run, fm: Record<string, string>, rel: string): void {
  for (const key of Object.keys(fm)) {
    if (!isSkillKey(key))
      run.errors.push(`Frontmatter key "${key}" in ${rel} is rejected by claude.ai`);
  }
  if (fm.name && !isSkillName(fm.name))
    run.errors.push(
      `Invalid name "${fm.name}" in ${rel} (must be kebab-case, start with a letter, <=64 chars)`,
    );
  if (fm.name && isReservedName(fm.name))
    run.errors.push(`Invalid name "${fm.name}" in ${rel} (must not contain anthropic or claude)`);
  if (fm.description && !descriptionFits(fm.description.length))
    run.errors.push(`Description in ${rel} is ${fm.description.length} characters (limit 1024)`);
}

/** One SKILL.md: frontmatter, fields, token budget. True when it counts as a skill. */
async function checkSkill(
  run: Run,
  skillDir: string,
  rel: string,
  skillName: string,
): Promise<boolean> {
  const text = await readText(join(skillDir, "SKILL.md"));
  if (text === null) {
    run.errors.push(`Missing SKILL.md: ${rel}`);
    return false;
  }

  const fm = checkFrontmatter(run, text, rel, skillName, `directory="${skillName}"`);
  if (!fm) return false;
  checkSkillFields(run, fm, rel);
  collectShared(run, rel, text);

  const words = text.split(/\s+/).filter(Boolean).length;
  const budget = budgetOf(words);
  if (budget === "over")
    run.errors.push(
      `Token budget exceeded: ${rel} is ${words} words (5K-token limit ~= 3750 words)`,
    );
  else if (budget === "near")
    run.warnings.push(`Approaching token limit: ${rel} is ${words} words (limit 3750)`);
  return true;
}

/** Record a SKILL.md's shared blocks; every marker MUST belong to a matched block. */
function collectShared(run: Run, rel: string, text: string): void {
  const blocks = [...text.matchAll(SHARED_BLOCK)];
  if (blocks.length * 2 !== [...text.matchAll(SHARED_MARKER)].length)
    run.errors.push(`Shared-block marker outside a matched block in ${rel}`);
  for (const match of blocks)
    run.shared.push({ name: String(match[1]), rel, block: String(match[2]) });
}

/** Every shared block has at least two copies, and every copy matches the first one found. */
function checkShared(run: Run): void {
  const first = new Map<string, { rel: string; block: string; copies: number }>();
  for (const copy of run.shared) {
    const seen = first.get(copy.name);
    if (!seen) first.set(copy.name, { ...copy, copies: 1 });
    else {
      seen.copies += 1;
      if (seen.block !== copy.block)
        run.errors.push(`Shared block "${copy.name}" in ${copy.rel} differs from ${seen.rel}`);
    }
  }
  for (const [name, seen] of first)
    if (seen.copies < 2) run.errors.push(`Shared block "${name}" has only one copy (${seen.rel})`);
}

async function checkSkills(run: Run, plugins: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (const plugin of plugins) {
    const skillsDir = join(run.pluginsDir, plugin, "skills");
    for (const skillName of await listDir(skillsDir)) {
      const skillDir = join(skillsDir, skillName);
      if (!(await stat(skillDir)).isDirectory()) continue;
      const rel = `plugins/${plugin}/skills/${skillName}/SKILL.md`;
      if (await checkSkill(run, skillDir, rel, skillName)) known.add(skillName);
    }
  }
  return known;
}

/** One command file: frontmatter, and every `Skill("X")` in its prose resolves. */
function checkCommand(
  run: Run,
  text: string,
  rel: string,
  file: string,
  knownSkills: Set<string>,
): void {
  if (!checkFrontmatter(run, text, rel, file.replace(/\.md$/, ""), `file="${file}"`)) return;

  // Strip fenced code blocks and inline code spans before scanning:
  // those are illustrative documentation, not operative skill loads.
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  for (const match of prose.matchAll(/Skill\(["'](?<ref>[^"']+)["']\)/g)) {
    const ref = String(match.groups?.ref);
    // `plugin:skill` → `skill` (the second segment); a bare name is the skill itself
    const [first, second] = ref.split(":");
    const skillName = String(second ?? first);
    if (!knownSkills.has(skillName)) run.errors.push(`Unknown Skill("${ref}") in ${rel}`);
  }
}

async function checkCommands(run: Run, plugins: string[], knownSkills: Set<string>): Promise<void> {
  for (const plugin of plugins) {
    const cmdDir = join(run.pluginsDir, plugin, "commands");
    for (const file of await listDir(cmdDir)) {
      if (!file.endsWith(".md")) continue;
      const text = await readFile(join(cmdDir, file), "utf8");
      checkCommand(run, text, `plugins/${plugin}/commands/${file}`, file, knownSkills);
    }
  }
}

/** One connector entry: http on augur-mcp.com, keyed by its title, described, no auth fields. */
function checkConnector(run: Run, where: string, key: string, value: unknown): void {
  const server = (value ?? {}) as Json;
  if (server.type !== "http") run.errors.push(`${where} type MUST be "http"`);
  if (!isConnectorUrl(String(server.url)))
    run.errors.push(`${where} url MUST be https://<service>.augur-mcp.com/...`);
  if (server.title !== key) run.errors.push(`${where} title MUST equal its key "${key}"`);
  if (!server.description) run.errors.push(`${where} MUST have a description`);
  for (const field of CONNECTOR_BANNED.filter((f) => f in server))
    run.errors.push(`${where} MUST NOT set ${field}`);
}

/** The parsed JSON at `rel`, or undefined (with an error) when it does not parse. */
function parseJson(run: Run, rel: string, text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json;
  } catch {
    run.errors.push(`${rel} is not valid JSON`);
    return undefined;
  }
}

async function checkConnectors(run: Run, plugins: string[]): Promise<void> {
  for (const plugin of plugins) {
    const rel = `plugins/${plugin}/.mcp.json`;
    const text = await readText(join(run.root, rel));
    if (text === null) continue;
    const config = parseJson(run, rel, text);
    if (config === undefined) continue;
    const servers = config?.mcpServers;
    if (typeof servers !== "object" || servers === null) {
      run.errors.push(`${rel} MUST have an "mcpServers" object`);
      continue;
    }
    for (const [key, server] of Object.entries(servers))
      checkConnector(run, `${rel} "${key}"`, key, server);
  }
}

/**
 * hooks/hooks.json: valid JSON with a `hooks` object or a `modules` list, and every
 * `${CLAUDE_PLUGIN_ROOT}/<file>` it runs exists, so a typo cannot ship a hook that fails on every event.
 */
async function checkHooks(run: Run, plugins: string[]): Promise<void> {
  for (const plugin of plugins) {
    const rel = `plugins/${plugin}/hooks/hooks.json`;
    const text = await readText(join(run.root, rel));
    if (text !== null && checkHooksShape(run, rel, text))
      await checkHookFiles(run, plugin, rel, text);
  }
}

/** True when `text` parses; errors for bad JSON or a config with neither hooks nor modules. */
function checkHooksShape(run: Run, rel: string, text: string): boolean {
  const config = parseJson(run, rel, text);
  if (config === undefined) return false;
  if (typeof config?.hooks !== "object" && !Array.isArray(config?.modules)) {
    run.errors.push(`${rel} MUST have a "hooks" object or a "modules" list`);
  }
  return true;
}

/** Every `${CLAUDE_PLUGIN_ROOT}/<file>` the hooks run exists in the plugin. */
async function checkHookFiles(run: Run, plugin: string, rel: string, text: string): Promise<void> {
  for (const match of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/(?<file>[^"\s]+)/g)) {
    const file = String(match.groups?.file);
    if ((await readText(join(run.pluginsDir, plugin, file))) === null) {
      run.errors.push(`${rel} runs plugins/${plugin}/${file}, which does not exist`);
    }
  }
}

/**
 * .lsp.json (an LSP plugin, Claude Code only): valid JSON; each server has a binary `command`
 * (proved `isLspCommand`) and an `extensionToLanguage` map; and no key anywhere holds a secret
 * (proved `isSecretKey`), since the file ships to every installer.
 */
async function checkLspServers(run: Run, plugins: string[]): Promise<void> {
  for (const plugin of plugins) {
    const rel = `plugins/${plugin}/.lsp.json`;
    const text = await readText(join(run.root, rel));
    if (text === null) continue;
    const config = parseJson(run, rel, text);
    if (config === undefined) continue;
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      run.errors.push(`${rel} MUST be an object of servers`);
      continue;
    }
    for (const [name, server] of Object.entries(config))
      checkLspServer(run, `${rel} "${name}"`, server);
    for (const key of secretKeys(config))
      run.errors.push(`${rel} MUST NOT hold a secret: "${key}"`);
  }
}

function checkLspServer(run: Run, where: string, server: unknown): void {
  const s = (typeof server === "object" && server !== null ? server : {}) as Record<
    string,
    unknown
  >;
  if (typeof s.command !== "string" || !isLspCommand(s.command))
    run.errors.push(
      `${where} MUST have a "command" naming a binary (no spaces unless an absolute path)`,
    );
  const map = s.extensionToLanguage;
  if (typeof map !== "object" || map === null || Array.isArray(map))
    run.errors.push(`${where} MUST have an "extensionToLanguage" object`);
}

/** Every key, at any depth, that holds a secret. */
function secretKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) => [
    ...(isSecretKey(key) ? [key] : []),
    ...secretKeys(inner),
  ]);
}

/** The lines of `text` that `base` lacks: what was added by hand to a generated file. */
function addedLines(text: string, base: string): string[] {
  const generated = new Set(base.split("\n"));
  return text.split("\n").filter((line) => !generated.has(line));
}

/**
 * Proofs: every `//@ backend dafny` file is listed in LemmaScript-files.txt, and no hand-written
 * Dafny (the models, the links, and what was added to a generated `.dfy`) escapes the proof.
 */
async function checkProofs(run: Run, plugins: string[]): Promise<void> {
  const listed = new Set(
    ((await readText(join(run.root, "LemmaScript-files.txt"))) ?? "")
      .split("\n")
      // The first word: the file (split always returns at least one item)
      .map((line) => String(line.trim().split(/\s+/)[0])),
  );
  for (const dir of await scriptDirs(run, plugins)) {
    for (const file of await listDir(join(run.root, dir)))
      await checkProofScript(run, `${dir}/${file}`, listed);
  }
  await checkModels(run);
}

/** The repo's own scripts, each plugin's (a mod's proved rules ship with it), and each skill's. */
async function scriptDirs(run: Run, plugins: string[]): Promise<string[]> {
  const dirs = ["scripts"];
  for (const plugin of plugins) {
    dirs.push(`plugins/${plugin}/scripts`);
    for (const skill of await listDir(join(run.root, "plugins", plugin, "skills")))
      dirs.push(`plugins/${plugin}/skills/${skill}/scripts`);
  }
  return dirs;
}

/** One script: a proved `.ts` is listed; a `.dfy` adds no escape to its `.dfy.gen`. */
async function checkProofScript(run: Run, rel: string, listed: Set<string>): Promise<void> {
  const path = join(run.root, rel);
  if (rel.endsWith(".ts") && !listed.has(rel)) {
    if ((await readFile(path, "utf8")).startsWith("//@ backend dafny"))
      run.errors.push(`${rel} is proved but not listed in LemmaScript-files.txt`);
  }
  if (rel.endsWith(".dfy")) {
    const base = (await readText(`${path}.gen`)) ?? "";
    checkEscapes(run, rel, addedLines(await readFile(path, "utf8"), base));
  }
}

/** The models and links are hand-written throughout: no line may escape the proof. */
async function checkModels(run: Run): Promise<void> {
  for (const dir of ["models", "models/links"]) {
    for (const file of await listDir(join(run.root, dir))) {
      if (!file.endsWith(".dfy")) continue;
      const text = await readFile(join(run.root, dir, file), "utf8");
      checkEscapes(run, `${dir}/${file}`, text.split("\n"));
    }
  }
}

function checkEscapes(run: Run, rel: string, lines: string[]): void {
  for (const line of lines) {
    if (PROOF_ESCAPES.test(line.replace(/\/\/.*$/, "")))
      run.errors.push(`${rel} escapes the proof: ${line.trim()}`);
  }
}

async function checkClaudeMd(run: Run): Promise<void> {
  const rel = ".claude/CLAUDE.md";
  const text = await readText(join(run.root, rel));
  if (text === null) return;
  const lines = text.split("\n").length;
  if (lines > 200) run.errors.push(`${rel} is ${lines} lines (Claude Code limit is 200)`);
  else if (lines > 180) run.warnings.push(`${rel} is ${lines} lines (approaching 200 limit)`);
}

/** Validate the repo at `root`. */
export async function validate(root: string): Promise<Result> {
  const run: Run = {
    root,
    pluginsDir: join(root, "plugins"),
    errors: [],
    warnings: [],
    shared: [],
  };
  const plugins = await listPlugins(run);
  await checkPlugins(run, plugins);
  const skills = await checkSkills(run, plugins);
  checkShared(run);
  await checkCommands(run, plugins, skills);
  await checkConnectors(run, plugins);
  await checkHooks(run, plugins);
  await checkLspServers(run, plugins);
  await checkProofs(run, plugins);
  await checkClaudeMd(run);
  return { errors: run.errors, warnings: run.warnings, skillCount: skills.size };
}

/** The report `pnpm validate` prints, and its exit code. */
export function report({ errors, warnings, skillCount }: Result): {
  text: string;
  exitCode: number;
} {
  const lines: string[] = [];
  if (warnings.length) {
    lines.push(`WARN (${warnings.length}):`, ...warnings.map((w) => `  - ${w}`), "");
  }
  if (errors.length) {
    lines.push(`FAIL (${errors.length}):`, ...errors.map((e) => `  - ${e}`));
    return { text: lines.join("\n"), exitCode: 1 };
  }
  lines.push(`PASS: ${skillCount} skill(s) validated`);
  return { text: lines.join("\n"), exitCode: 0 };
}

// Run only when executed directly, not when imported by the tests. Node resolves symlinks for
// import.meta.url, so resolve argv[1] too, or a run through a symlink would silently validate nothing
if (import.meta.url === pathToFileURL(realpathSync(String(process.argv[1]))).href) {
  const { text, exitCode } = report(await validate(process.cwd()));
  console.log(text);
  process.exitCode = exitCode;
}
