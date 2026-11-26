// The logic of `openapi-op.ts`: from an OpenAPI document's text, the one operation asked for, with
// the path's shared parameters and every local `$ref` resolved, so an agent reads one operation
// instead of a spec that can run to megabytes. It reads and writes no files; openapi-op.ts does.

export interface Result {
  code: number;
  output: string;
}

const USAGE = "usage: openapi-op.ts <openapi.json file> <METHOD> <path>";
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(code: number, message: string, extra: Record<string, Json> = {}): Result {
  return { code, output: JSON.stringify({ error: message, ...extra }) };
}

/** A local JSON pointer (`#/components/schemas/Item`), per RFC 6901; undefined when it leads nowhere. */
function pointTo(doc: Json, ref: string): Json | undefined {
  if (!ref.startsWith("#/")) return undefined;
  let node: Json | undefined = doc;
  for (const raw of ref.slice(2).split("/")) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(node)) node = node[Number(key)];
    else if (isRecord(node)) node = Object.hasOwn(node, key) ? node[key] : undefined;
    else return undefined;
  }
  return node;
}

/** Every local `$ref` replaced by what it points to; a ref already being expanded stays a ref, marked as a cycle. */
function resolve(doc: Json, node: Json, open: string[]): Json {
  if (Array.isArray(node)) return node.map((n) => resolve(doc, n, open));
  if (!isRecord(node)) return node;
  const ref = node.$ref;
  if (typeof ref === "string") {
    if (open.includes(ref)) return { $ref: ref, cycle: true };
    const target = pointTo(doc, ref);
    if (target === undefined) return { $ref: ref, unresolved: true };
    return resolve(doc, target, [...open, ref]);
  }
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) out[key] = resolve(doc, value, open);
  return out;
}

/** `openapi-op <file text> <METHOD> <path>`: the operation as JSON, exit 0; not found, exit 1; bad input, exit 2. */
export function runOpenapiOp(text: string, method: string, path: string): Result {
  let doc: Json;
  try {
    doc = JSON.parse(text) as Json;
  } catch {
    return fail(2, "the file is not JSON");
  }
  if (!isRecord(doc) || !isRecord(doc.paths)) return fail(2, "no paths: not an OpenAPI document");
  const verb = method.toLowerCase();
  if (!METHODS.includes(verb)) return fail(2, `not an HTTP method: ${method}`);
  const paths = doc.paths;
  const item = Object.hasOwn(paths, path) ? paths[path] : undefined;
  if (!isRecord(item)) {
    const near = Object.keys(paths).filter((p) => p.includes(path) || path.includes(p));
    return fail(1, `no path ${path}`, { near: near.slice(0, 20) });
  }
  const op = item[verb];
  if (!isRecord(op)) {
    const has = METHODS.filter((m) => isRecord(item[m])).map((m) => m.toUpperCase());
    return fail(1, `no ${method.toUpperCase()} on ${path}`, { methods: has });
  }
  const shared = Array.isArray(item.parameters) ? item.parameters : [];
  const result = {
    method: verb.toUpperCase(),
    path,
    sharedParameters: resolve(doc, shared, []),
    operation: resolve(doc, op, []),
  };
  return { code: 0, output: JSON.stringify(result, null, 2) };
}

/** The command line: three arguments, the first a file the caller has already read. */
export function checkArgs(args: string[]): Result | undefined {
  return args.length === 3 ? undefined : fail(2, USAGE);
}
