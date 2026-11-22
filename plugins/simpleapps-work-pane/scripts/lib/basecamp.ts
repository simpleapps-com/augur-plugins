// Import Basecamp todos (fetched by the Work pane through the Basecamp connector, saved as JSON)
// into work/ items. The scripts never call the connector themselves.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { basecampId, hubIdFor, laterText, orUnknown, plainText, statusOf } from "../work-rules.ts";
import { serializeYaml } from "./frontmatter.ts";
import { writeIfChanged } from "./github.ts";
import type { Doc } from "./tree.ts";
import { list, listHubs, listWorkFiles, loadWorkFile, text } from "./tree.ts";

/** A comment on a todo, in the import format. */
interface TodoComment {
  author: string;
  at: string;
  body?: string;
}

/** A todo in the import format: what `fromBasecamp` makes of a `get_todo` record. */
export interface Todo {
  id: number | string;
  project_id: number | string;
  project_name?: string;
  list?: string;
  title: string;
  url: string;
  status?: string;
  author?: string;
  assignees?: string[];
  created: string;
  updated?: string;
  due?: string;
  description?: string;
  comments?: TodoComment[];
}

function todoBody(todo: Todo): string {
  const header = [todo.list && `List: ${todo.list}`, todo.description].filter(Boolean).join("\n\n");
  const thread = (todo.comments ?? []).map((c) => `### ${c.author} · ${c.at}\n\n${c.body ?? ""}`);
  const discussion = thread.length ? `\n## Comments\n\n${thread.join("\n\n")}\n` : "";
  return `\n# ${todo.title}\n\n${header}\n${discussion}`;
}

/** The latest comment time, as `sort().at(-1)` picks it; undefined with no comments. */
function latestComment(todo: Todo): string | undefined {
  const times = (todo.comments ?? []).map((c) => c.at);
  return times.length ? times.reduce(laterText) : undefined;
}

function todoItem(todo: Todo, hub: string) {
  const data = {
    id: basecampId(false, String(todo.id)),
    title: todo.title,
    type: "item",
    source: "basecamp",
    kind: "todo",
    ref: `basecamp:${todo.project_id}/todos/${todo.id}`,
    url: todo.url,
    hub,
    status: statusOf(todo.status === "closed"),
    author: orUnknown(todo.author ?? ""),
    assignees: todo.assignees ?? [],
    created: todo.created,
    updated: todo.updated ?? latestComment(todo) ?? todo.created,
    due: todo.due || undefined,
  };
  return { data, body: todoBody(todo) };
}

function createHub(root: string, id: string, todo: Todo): Doc {
  const data = {
    id,
    // A linked todo can arrive with an empty project name; a blank title fails validation
    title: todo.project_name || `Basecamp project ${todo.project_id}`,
    type: "project",
    status: "active",
    summary: `Auto-created by work import-bc for Basecamp project ${todo.project_id}. Set type and sites`,
    basecamp_projects: [String(todo.project_id)],
  };
  const file = join(root, "hubs", id, "README.md");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `---\n${serializeYaml(data, Object.keys(data))}\n---\n\n# ${data.title}\n`);
  return loadWorkFile(file);
}

/** The hub listing this todo's project, else a hub named after the project (created if needed). */
function hubForProject(root: string, hubs: Doc[], todo: Todo, created: string[]): Doc {
  const project = String(todo.project_id);
  const listed = hubs.find((hub) => list(hub.data.basecamp_projects).includes(project));
  if (listed) return listed;
  const id = hubIdFor(todo.project_name ?? "", project);
  const named = hubs.find((hub) => hub.data.id === id);
  if (named) return named;
  const hub = createHub(root, id, todo);
  hubs.push(hub);
  created.push(id);
  return hub;
}

export function importBasecamp(root: string, todos: Todo[]) {
  const hubs = listHubs(root);
  const existing = new Map(listWorkFiles(root).map((file) => [basename(file, ".md"), file]));
  const report = { written: 0, unchanged: 0, moved: 0, removed: 0, hubsCreated: [] as string[] };
  for (const todo of todos) {
    const id = basecampId(false, String(todo.id));
    const prior = existing.get(id);
    // work/ is open-only: a closed todo leaves, and is never written
    if (todo.status === "closed") {
      if (prior) {
        rmSync(prior);
        report.removed++;
      }
      continue;
    }
    const hub = hubForProject(root, hubs, todo, report.hubsCreated);
    const { data, body } = todoItem(todo, text(hub.data.id));
    const file = join(dirname(hub.file), "items", `${id}.md`);
    if (prior && prior !== file) {
      rmSync(prior);
      report.moved++;
    }
    mkdirSync(dirname(file), { recursive: true });
    if (writeIfChanged(file, data, body)) report.written++;
    else report.unchanged++;
  }
  return report;
}

/** A raw `get_todo` record with the names it lacks, as the Work pane writes it. */
export interface FetchedTodo {
  basecamp: {
    id: number;
    content: string;
    app_url: string;
    completed?: boolean;
    creator?: { name?: string };
    assignee?: { name?: string } | null;
    created_at: string;
    updated_at?: string;
    due_on?: string | null;
    comments?: { creator?: { name?: string }; created_at: string; content?: string }[];
  };
  project_id: number;
  project_name: string;
  list?: string;
}

/** The import format for a raw Basecamp record from `get_todo`. */
function fromBasecamp({
  basecamp: todo,
  project_id,
  project_name,
  list: listName,
}: FetchedTodo): Todo {
  return {
    id: todo.id,
    project_id,
    project_name,
    list: listName ?? "",
    title: todo.content,
    url: todo.app_url,
    status: statusOf(todo.completed === true),
    author: todo.creator?.name ?? "",
    assignees: todo.assignee?.name ? [todo.assignee.name] : [],
    created: todo.created_at,
    ...(todo.updated_at !== undefined && { updated: todo.updated_at }),
    due: todo.due_on ?? "",
    comments: (todo.comments ?? []).map((c) => ({
      author: c.creator?.name ?? "unknown",
      at: c.created_at,
      body: plainText(String(c.content ?? "")),
    })),
  };
}

/** Todos from a JSON file: one object or an array, each in the import format or a raw `basecamp` record. */
export const readTodos = (path: string): Todo[] =>
  [JSON.parse(readFileSync(path, "utf8")) as Todo | FetchedTodo | (Todo | FetchedTodo)[]]
    .flat()
    .map((todo) => ("basecamp" in todo ? fromBasecamp(todo) : todo));
