// Frontmatter: split a file at its `---` lines, read the YAML, and check fields against a schema.
// Every decision about a value is a proved rule in ../work-rules.ts; this file frames and reports.
import { basename, dirname } from "node:path";

import {
  formatList,
  formatScalar,
  holds,
  idFromFile,
  matchesFormat,
  parseYaml,
  repeatsAt,
  scalarProblem,
} from "../work-rules.ts";

/** Frontmatter values: a scalar or a list. */
export type Data = Record<string, string | string[] | undefined>;

/** A field's rule: required, a list, an enum, and a format (a rule name in work-rules.ts). */
interface Rule {
  required?: boolean;
  list?: boolean;
  enum?: string[];
  format?: string;
}

export type Schema = Record<string, Rule>;

/** The frontmatter lines and the body, or null when the text does not start with `---`. */
export function splitFrontmatter(text: string): { yaml: string[]; body: string } | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  return { yaml: lines.slice(1, end), body: lines.slice(end + 1).join("\n") };
}

/** The frontmatter as data, and its problems as messages. */
export function readYaml(lines: string[]): { data: Data; errors: string[] } {
  const yaml = parseYaml(lines);
  const data: Data = {};
  for (const { key, value } of yaml.entries) data[key] = value.isList ? value.items : value.scalar;
  const errors = yaml.problems.map((p) =>
    p.kind === "bad"
      ? `frontmatter line ${p.line + 2}: unsupported syntax "${p.text}"`
      : `frontmatter: duplicate key "${p.text}"`,
  );
  return { data, errors };
}

function checkList(key: string, value: string | string[], rule: Rule): string[] {
  if (!Array.isArray(value)) return [`"${key}" must be a list`];
  const format = rule.format ?? "";
  const bad = value
    .filter((v) => format !== "" && !matchesFormat(format, v))
    .map((v) => `"${key}" item "${v}" has invalid format`);
  const dupes = value
    .filter((_, i) => repeatsAt(value, i))
    .map((v) => `"${key}" lists "${v}" twice`);
  return [...bad, ...dupes];
}

function checkScalar(key: string, value: string | string[], rule: Rule): string[] {
  const text = Array.isArray(value) ? "" : value;
  const allowed = rule.enum ?? [];
  const problem = scalarProblem(
    Array.isArray(value),
    text,
    rule.enum !== undefined,
    allowed,
    rule.format ?? "",
  );
  if (problem === "empty") return [`"${key}" must be a non-empty string`];
  if (problem === "enum") return [`"${key}" must be one of: ${allowed.join(", ")}`];
  if (problem === "format") return [`"${key}" has invalid format "${text}"`];
  return [];
}

/** Unknown keys, missing required keys, then each field's own problems. */
export function validateFields(data: Data, schema: Schema): string[] {
  const keys = Object.keys(schema);
  const errors = Object.keys(data)
    .filter((key) => !holds(keys, key))
    .map((key) => `unknown key "${key}"`);
  for (const [key, rule] of Object.entries(schema)) {
    const value = data[key];
    if (value === undefined) {
      if (rule.required) errors.push(`missing required key "${key}"`);
      continue;
    }
    errors.push(...(rule.list ? checkList(key, value, rule) : checkScalar(key, value, rule)));
  }
  return errors;
}

/** A file's id from its name: `<name>.md`, or for a README.md its folder's name. */
export function expectedId(file: string): string {
  return idFromFile(basename(file, ".md"), basename(dirname(file)));
}

/** Frontmatter in the subset `readYaml` reads back. List items MUST NOT contain commas. */
export function serializeYaml(data: Record<string, unknown>, keys: string[]): string {
  return keys
    .filter((key) => data[key] !== undefined && data[key] !== null)
    .map((key) => {
      const value = data[key];
      return `${key}: ${Array.isArray(value) ? formatList(value.map(String)) : formatScalar(String(value))}`;
    })
    .join("\n");
}
