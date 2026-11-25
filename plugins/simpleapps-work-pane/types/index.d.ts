/** count_my_todos; `fingerprint` changes on any add, close, reassign or edit of an open todo. */
export type Count = { open: number; complete: boolean; fingerprint?: string };

/** Open Basecamp todos assigned to you and open issues in watched repos. */
export type Tracked = { basecamp: number; github: number };

/** What changed since the last sync, as the timer last saw it. */
export type Pending = { basecamp: number; github: number; neverSynced: boolean };

/** The outcome of the last Sync, in words for the pane. */
export type SyncResult = { at: number; ok: boolean; detail: string };

export type Snapshot = {
  count?: Count;
  // One entry per watched repo; null when its count could not be read
  issues?: Record<string, number | null>;
  tracked?: Tracked;
  pending?: Pending;
  checkedAt?: number;
  sync?: SyncResult;
  syncing: boolean;
  isError: boolean;
  // What the last check could not read: "Basecamp count", "Basecamp index (…)", a repo, "GitHub changes", "work status"
  failed?: string[];
  // The pane's `needs:` lines: what this machine lacks (node, a signed-in gh), then what the
  // project's config gets in the way of (a .mcp.json server that hides the Basecamp connector)
  setup?: string[];
  // A failed check over a work/ with no ok check or sync in 3 × sync_minutes (GH #34), and that span
  stale?: boolean;
  staleMinutes?: number;
  // work/list.json, read after each check; unset when it is missing or unreadable
  list?: WorkList;
};

/** One item on the list: its link label (`BC<n>`, `<repo>#<n>`, what ⧉ copies), page, title. */
export type ListRow = { ref: string; url: string; title: string };

/** work/list.json (GH #47): LIST.md's list in its order, todos by site and issues by repo. */
export type WorkList = {
  basecamp: { key: string; rows: ListRow[] }[];
  github: { key: string; rows: ListRow[] }[];
};

/** Which of the pane's two views shows. */
export type View = "summary" | "list";

/** A Basecamp todo to fetch with get_todo, with the names get_todo doesn't return. */
export type Target = { id: number; project_id: number; project_name: string; list: string };

/** list_my_todo_index: every open todo of yours, grouped by list. */
export type TodoIndex = {
  lists?: {
    project_id?: number;
    project_name?: string;
    todolist_id?: number;
    todolist_name?: string;
    todos?: { id: number; title?: string; updated_at: string; due_at?: string | null }[];
  }[];
  count?: number;
  fingerprint?: string;
  complete?: boolean;
};

/** `work status --json`: settings plus every item in work/. */
export type Status = {
  org: string;
  watch_repos: string[];
  auto_sync: boolean;
  sync_minutes: number;
  last_sync: string | null;
  // The last work/check.log line, and whether work/ has no ok check or sync in 3 × sync_minutes
  last_check?: string | null;
  stale?: boolean;
  items: {
    id: string;
    source: string;
    kind: string;
    status?: string;
    updated: string;
    project: string | null;
    mine: boolean;
  }[];
  // Site briefs in work/briefs/ and their hubs' Basecamp projects
  briefs?: { hub: string; projects: string[] }[];
};

/** `work refresh --json`. */
export type RefreshReport = {
  ok: boolean;
  locked: boolean;
  failed: { step: string; detail: string } | null;
  basecamp: { id: string; project: string | null }[];
};

declare module "claude-code" {
  interface PluginState {
    "simpleapps-work-pane": { snapshot: Snapshot; view: View; filter: string };
  }
}
