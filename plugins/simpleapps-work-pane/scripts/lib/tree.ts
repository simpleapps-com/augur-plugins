// work/: the schema of each file, loading and validating them, and the reference graph.
// Rules: wiki Work-Pane. Every decision about a value is a proved rule in ../work-rules.ts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { extractRefs, orgOf, refContext, splitSegments } from "../work-rules.ts";
import type { Data, Schema } from "./frontmatter.ts";
import {
  expectedId,
  readYaml,
  serializeYaml,
  splitFrontmatter,
  validateFields,
} from "./frontmatter.ts";

const base: Schema = {
  id: { required: true, format: "id" },
  title: { required: true },
};

const ITEM_SCHEMA: Schema = {
  ...base,
  type: { required: true, enum: ["item"] },
  source: { required: true, enum: ["github", "basecamp"] },
  kind: { required: true, enum: ["issue", "pull", "todo", "message"] },
  ref: { required: true },
  url: { required: true, format: "url" },
  hub: { required: true, format: "id" },
  status: { required: true, enum: ["open", "closed"] },
  author: { required: true },
  assignees: { list: true, format: "text" },
  created: { required: true, format: "when" },
  updated: { required: true, format: "when" },
  closed: { format: "when" },
  due: { format: "when" },
  related: { list: true, format: "id" },
};

const SCHEMAS: Record<string, Schema> = {
  // The one index is work/README.md, so its id is fixed rather than taken from the folder name
  index: {
    ...base,
    id: { required: true, enum: ["work"] },
    type: { required: true, enum: ["index"] },
    summary: { required: true },
    // Your Basecamp name and GitHub login, so the digest knows which items are yours
    me: { list: true, format: "text" },
    // One person under two names: `<github login>=<Basecamp name>`
    aliases: { list: true, format: "alias" },
    // The GitHub org a bare repo name is in; SimpleApps' when not set
    org: { format: "repo" },
    // Repos whose open issues the Work pane counts: `<repo>` in the org, or `<owner>/<repo>`
    watch_repos: { list: true, format: "watch-repo" },
    // Work pane: sync by itself when it sees a change, and how often it checks
    auto_sync: { enum: ["true", "false"] },
    sync_minutes: { format: "minutes" },
  },
  hub: {
    ...base,
    type: { required: true, enum: ["client", "project"] },
    status: { required: true, enum: ["active", "inactive"] },
    summary: { required: true },
    sites: { list: true, format: "id" },
    repos: { list: true, format: "repo" },
    followed_repos: { list: true, format: "repo" },
    basecamp_projects: { list: true, format: "digits" },
    // P21 company the client's site uses
    company_id: {},
    tags: { list: true, format: "id" },
  },
  item: ITEM_SCHEMA,
  // A living site brief in work/briefs/; see brief.ts
  brief: {
    ...base,
    type: { required: true, enum: ["brief"] },
    hub: { required: true, format: "id" },
    written: { format: "when" },
    updated: { required: true, format: "stamp" },
  },
};

const SCHEMA_FOR_TYPE: Record<string, string> = {
  index: "index",
  client: "hub",
  project: "hub",
  item: "item",
  brief: "brief",
};

/** The keys an item's frontmatter is written in. */
const ITEM_KEYS = Object.keys(ITEM_SCHEMA);

/** One file of work/, loaded. */
export interface Doc {
  file: string;
  text: string;
  data: Data;
  body: string;
  errors: string[];
}

/** A field read as text: a scalar as it is, a list or nothing as "". */
export const text = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

/** A field read as a list: a list as it is, anything else as []. */
export const list = (value: string | string[] | undefined): string[] =>
  Array.isArray(value) ? value : [];

const isHub = (doc: Doc) => SCHEMA_FOR_TYPE[text(doc.data.type)] === "hub";

/** Generated at the root of work/ by the chart and the digest; never loaded or validated. */
export const CHART_FILE = "chart.md";
export const LIST_FILE = "LIST.md";

export function renderItem(data: Record<string, unknown>, body: string): string {
  return `---\n${serializeYaml(data, ITEM_KEYS)}\n---\n${body}`;
}

export function listWorkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".md") && entry !== CHART_FILE && entry !== LIST_FILE)
    .map((entry) => join(root, entry))
    .sort();
}

export function loadWorkFile(file: string): Doc {
  const fileText = readFileSync(file, "utf8");
  const parts = splitFrontmatter(fileText);
  if (!parts)
    return {
      file,
      text: fileText,
      data: {},
      body: fileText,
      errors: ["missing frontmatter (file MUST start with ---)"],
    };
  const { data, errors } = readYaml(parts.yaml);
  const schema = SCHEMAS[SCHEMA_FOR_TYPE[text(data.type)] ?? ""];
  if (schema) errors.push(...validateFields(data, schema));
  else errors.push(`"type" must be one of: ${Object.keys(SCHEMA_FOR_TYPE).join(", ")}`);
  if (data.type !== "index" && data.id && data.id !== expectedId(file))
    errors.push(`"id" must be "${expectedId(file)}" (from the file name)`);
  return { file, text: fileText, data, body: parts.body, errors };
}

/** work/README.md's frontmatter, or {} when it has none. */
export function readIndex(root: string): Data {
  const file = join(root, "README.md");
  const parts = existsSync(file) ? splitFrontmatter(readFileSync(file, "utf8")) : null;
  return parts ? readYaml(parts.yaml).data : {};
}

/** The GitHub org of work/: `org` in work/README.md, or SimpleApps'. */
export const workOrg = (root: string): string => orgOf(text(readIndex(root).org));

function checkItemPlace(doc: Doc, root: string, hubs: Map<string, Doc>): string[] {
  const hub = hubs.get(text(doc.data.hub));
  if (!hub) return [`"hub" "${text(doc.data.hub)}" does not exist`];
  const folder = join(dirname(hub.file), "items");
  return dirname(doc.file) === folder ? [] : [`item MUST live in ${relative(root, folder)}/`];
}

/** A Basecamp project listed by two hubs files its todos under the first (path order); flag the rest. */
function checkSharedProjects(hubDocs: Doc[]): void {
  const firstHub = new Map<string, string>();
  for (const doc of hubDocs) {
    for (const project of list(doc.data.basecamp_projects)) {
      const first = firstHub.get(project);
      if (first)
        doc.errors.push(
          `basecamp project "${project}" is also listed by hub "${first}"; remove it from one hub`,
        );
      else firstHub.set(project, text(doc.data.id));
    }
  }
}

function checkDoc(doc: Doc, root: string, hubs: Map<string, Doc>, seen: Map<string, Doc>): void {
  const id = text(doc.data.id);
  const prior = seen.get(id);
  if (prior) doc.errors.push(`duplicate id "${id}" (also ${relative(root, prior.file)})`);
  else if (id) seen.set(id, doc);
  if (doc.data.type === "item") doc.errors.push(...checkItemPlace(doc, root, hubs));
  if (doc.data.type === "brief" && !hubs.has(text(doc.data.hub)))
    doc.errors.push(`"hub" "${text(doc.data.hub)}" does not exist`);
}

export function validateWork(root: string): { count: number; problems: string[] } {
  const docs = listWorkFiles(root).map(loadWorkFile);
  checkSharedProjects(docs.filter(isHub));
  const hubs = new Map(docs.filter(isHub).map((doc) => [text(doc.data.id), doc]));
  const seen = new Map<string, Doc>();
  for (const doc of docs) checkDoc(doc, root, hubs, seen);
  const problems = docs.flatMap((doc) =>
    doc.errors.map((message) => `${relative(root, doc.file)}: ${message}`),
  );
  return { count: docs.length, problems };
}

/** One reference from an item: who referenced what, and when. */
export interface Edge {
  from: string;
  to: string;
  kind: "closes" | "mention";
  author: string | null;
  at: string | null;
  project?: string;
}

/** One edge per reference per segment of the item's body. */
export function itemEdges(item: Doc, org: string): Edge[] {
  const ctx = refContext(item.data.source === "github", text(item.data.ref), org);
  const id = text(item.data.id);
  return splitSegments(item.body, text(item.data.author), text(item.data.created)).flatMap(
    (segment, i) =>
      extractRefs(segment.text, ctx)
        .filter((ref) => ref.id !== id)
        .map((ref) => ({
          from: id,
          to: ref.id,
          kind: ref.closes ? ("closes" as const) : ("mention" as const),
          // The description's author and time are the item's own, and may be missing
          author: i === 0 && segment.author === "" ? null : segment.author,
          at: i === 0 && segment.at === "" ? null : segment.at,
          ...(ref.project !== "" && { project: ref.project }),
        })),
  );
}

/** A node of graph.json. */
export interface Node {
  id: string;
  title: string;
  source: string;
  kind: string;
  hub: string;
  status: string;
  author: string;
  created: string;
  closed: string | null;
}

const nodeOf = ({ data }: Doc): Node => ({
  id: text(data.id),
  title: text(data.title),
  source: text(data.source),
  kind: text(data.kind),
  hub: text(data.hub),
  status: text(data.status),
  author: text(data.author),
  created: text(data.created),
  closed: data.closed === undefined ? null : text(data.closed),
});

const sameList = (a: string[], b: string | string[] | undefined) =>
  Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);

/** The reference graph of work/'s items. */
export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

/** Set each item's `related` from the references in its text; write `graph.json`. */
export function linkWork(root: string, write = true) {
  const org = workOrg(root);
  const items = listWorkFiles(root)
    .map(loadWorkFile)
    .filter((doc) => doc.data.type === "item");
  const known = new Set(items.map((item) => text(item.data.id)));
  const graph: Graph = { nodes: [], edges: [] };
  const missing = new Set<string>();
  let changed = 0;
  for (const item of items) {
    const edges = itemEdges(item, org);
    graph.nodes.push(nodeOf(item));
    graph.edges.push(...edges);
    for (const edge of edges) if (!known.has(edge.to)) missing.add(edge.to);
    const related = [...new Set(edges.map((edge) => edge.to))].sort();
    if (sameList(related, item.data.related)) continue;
    changed++;
    if (write) writeFileSync(item.file, renderItem({ ...item.data, related }, item.body));
  }
  if (write) writeFileSync(join(root, "graph.json"), `${JSON.stringify(graph, null, 2)}\n`);
  return { items: items.length, changed, missing: [...missing].sort(), graph };
}

export function listHubs(root: string): Doc[] {
  return listWorkFiles(root)
    .filter((file) => basename(file) === "README.md")
    .map(loadWorkFile)
    .filter(isHub);
}
