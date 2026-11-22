// Rewrite the body of work/README.md as a digest that leads with where you are the bottleneck.
// Rules: wiki Work-Pane. Every decision about a value is a proved rule in ../work-rules.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  compareText,
  earlierPresent,
  holdsUp,
  impactOrder,
  isBotName,
  isDueSoon,
  isMine,
  isOverdue,
  isStale,
  isUnfetched,
  lastMineIndex,
  lower,
  rowsLeftOut,
  shortRef,
  splitSegments,
  waitsOn,
} from "../work-rules.ts";
import type { Data } from "./frontmatter.ts";
import { readYaml, serializeYaml, splitFrontmatter } from "./frontmatter.ts";
import { repoOf } from "./follow.ts";
import { writeList } from "./list.ts";
import type { Doc } from "./tree.ts";
import { list, listHubs, listWorkFiles, loadWorkFile, text, workOrg } from "./tree.ts";

const DAY = 86_400_000;

const day = (when: string) => when.slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY);
const unique = <T>(values: T[]) => [...new Set(values)];
const cell = (value: string | number) => String(value).replace(/\|/g, "\\|");

/** Who an item belongs to: its assignees, else its author. */
const owners = (data: Data) => {
  const assignees = list(data.assignees);
  return assignees.length ? assignees : [text(data.author)];
};

interface Ctx {
  org: string;
  me: Set<string>;
  canon: (person: string) => string;
  known: Set<string>;
  open: Set<string>;
  ownedRepos: Set<string>;
  dependents: Map<string, { id: string; people: string[] }[]>;
}

interface Waiting {
  people: string[];
  since: string;
  sinceByPerson: Map<string, string>;
}

/** Everyone other than you, not a bot, who wrote after your last word, from their first unanswered message. */
function waitingForReply(segments: { author: string; at: string }[], me: Set<string>): Waiting {
  const last = lastMineIndex(segments.map((segment) => me.has(segment.author)));
  const after = segments
    .slice(last + 1)
    .filter((s) => waitsOn(s.author !== "", me.has(s.author), isBotName(s.author)));
  const sinceByPerson = new Map<string, string>();
  for (const segment of after)
    if (!sinceByPerson.has(segment.author)) sinceByPerson.set(segment.author, day(segment.at));
  const first = after[0];
  return { people: [...sinceByPerson.keys()], since: first ? day(first.at) : "", sinceByPerson };
}

/** Open items owned by someone else, indexed by the item ids they reference. */
function dependentsByTarget(items: Doc[], me: Set<string>, canon: (p: string) => string) {
  const byTarget = new Map<string, { id: string; people: string[] }[]>();
  for (const item of items) {
    const people = unique(
      owners(item.data)
        .filter((p) => !isBotName(p))
        .map(canon),
    );
    if (
      !holdsUp(
        people.length,
        people.some((p) => me.has(p)),
      )
    )
      continue;
    for (const target of list(item.data.related)) {
      const entry = byTarget.get(target) ?? [];
      entry.push({ id: text(item.data.id), people });
      byTarget.set(target, entry);
    }
  }
  return byTarget;
}

interface Fact {
  id: string;
  title: string;
  file: string;
  hub: string;
  mine: boolean;
  due: string;
  touched: string;
  waiting: Waiting;
  dependents: { id: string; people: string[] }[];
  blocked: string[];
  openLinks: string[];
  unfetched: string[];
}

/** Facts per item that the sections filter on. */
function describe(item: Doc, root: string, ctx: Ctx): Fact {
  const segments = splitSegments(item.body, text(item.data.author), text(item.data.created)).map(
    (s) => ({
      at: s.at,
      author: ctx.canon(s.author),
    }),
  );
  const id = text(item.data.id);
  const ownedRepo = item.data.source === "github" && ctx.ownedRepos.has(repoOf(id, ctx.org));
  const people = [text(item.data.author), ...list(item.data.assignees)];
  const waiting = waitingForReply(segments, ctx.me);
  const dependents = ctx.dependents.get(id) ?? [];
  const related = list(item.data.related);
  return {
    id,
    title: text(item.data.title),
    file: relative(root, item.file),
    hub: text(item.data.hub),
    mine: isMine(
      ownedRepo,
      people.some((person) => ctx.me.has(person)),
    ),
    due: day(text(item.data.due)),
    // The description is always the first segment, so there is a last one
    touched: day(segments[segments.length - 1]!.at || text(item.data.updated)),
    waiting,
    dependents,
    blocked: unique([...waiting.people, ...dependents.flatMap((d) => d.people)]),
    openLinks: related.filter((r) => ctx.open.has(r)),
    unfetched: related.filter((r) => isUnfetched(r, ctx.known.has(r))),
  };
}

function section(
  title: string,
  explain: string,
  header: string[],
  rows: (string | number)[][],
): string[] {
  const total = rows.length;
  if (!total) return [];
  const left = rowsLeftOut(total);
  return [
    `## ${title} (${total})`,
    "",
    explain,
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.slice(0, 15).map((r) => `| ${r.join(" | ")} |`),
    ...(left ? ["", `…and ${left} more.`] : []),
    "",
  ];
}

const byImpact = (a: Fact, b: Fact) =>
  impactOrder(
    a.blocked.length,
    b.blocked.length,
    a.dependents.length,
    b.dependents.length,
    a.waiting.since,
    b.waiting.since,
  );

function blockingSection(
  blocking: Fact[],
  itemCell: (f: Fact) => string,
  ref: (id: string) => string,
): string[] {
  const rows = blocking.map((f) => [
    itemCell(f),
    f.hub,
    cell(f.blocked.join(", ")),
    f.waiting.since,
    f.dependents.map((d) => ref(d.id)).join(", "),
  ]);
  return section(
    "Bottleneck: work these first",
    "Your open items someone else is waiting on: they wrote after your last word, or their open work references it. Most people held up first. Work elsewhere does not move the team until these do.",
    ["Item", "Hub", "Waiting", "Since", "Their work that depends on it"],
    rows,
  );
}

function peopleSection(blocking: Fact[]): string[] {
  const byPerson = new Map<string, { items: number; since: string }>();
  for (const fact of blocking) {
    for (const person of fact.blocked) {
      const entry = byPerson.get(person) ?? { items: 0, since: "" };
      const since = fact.waiting.sinceByPerson.get(person) ?? "";
      byPerson.set(person, { items: entry.items + 1, since: earlierPresent(entry.since, since) });
    }
  }
  const rows = [...byPerson]
    .sort(([, a], [, b]) => b.items - a.items || impactOrder(0, 0, 0, 0, a.since, b.since))
    .map(([person, entry]) => [cell(person), entry.items, entry.since]);
  return section(
    "Who is waiting on you",
    "People held up by your items, and the oldest unanswered wait.",
    ["Person", "Items", "Oldest wait"],
    rows,
  );
}

function hubTable(hubs: (Doc & { rel: string })[], facts: Fact[]): string[] {
  const rows = hubs
    .map((hub) => ({ hub, inHub: facts.filter((f) => f.hub === hub.data.id) }))
    .filter(({ inHub }) => inHub.length)
    .map(({ hub, inHub }) => [
      `[${cell(text(hub.data.title))}](${hub.rel})`,
      inHub.length,
      inHub.filter((f) => f.mine && f.blocked.length).length || "",
      unique(inHub.flatMap((f) => f.unfetched)).length || "",
    ]);
  return [
    "## By hub",
    "",
    "| Hub | Open | Blocking others | Linked Basecamp not fetched |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.join(" | ")} |`),
    "",
  ];
}

function headline(
  me: Set<string>,
  mine: Fact[],
  blocking: Fact[],
  facts: Fact[],
  hubs: Doc[],
): string {
  if (!me.size)
    return "Set `me` in the frontmatter (your Basecamp name and GitHub login) to see what is yours.";
  const people = unique(blocking.flatMap((f) => f.blocked)).length;
  return `You are holding up ${people} people on ${blocking.length} items. ${mine.length} of ${facts.length} open items in ${hubs.length} hubs are yours.`;
}

/** `login=Name` aliases as a lookup from either spelling to the Basecamp name. */
function aliasMap(aliases: string[]): Map<string, string> {
  return new Map(
    aliases.map((alias) => {
      const [login = "", name = ""] = alias.split("=").map((p) => p.trim());
      return [login, name] as const;
    }),
  );
}

function referenceSections(
  mine: Fact[],
  today: string,
  itemCell: (f: Fact) => string,
  ref: (id: string) => string,
) {
  const rows = (facts: Fact[], why: (f: Fact) => string) =>
    facts.map((f) => [itemCell(f), f.hub, why(f)]);
  const byDate = (key: "due" | "touched") => (a: Fact, b: Fact) => compareText(a[key], b[key]);
  const header = ["Item", "Hub", "Why"];
  return [
    ...section(
      "Overdue",
      "Past their due date.",
      header,
      rows(mine.filter((f) => isOverdue(f.due, today)).sort(byDate("due")), (f) => `due ${f.due}`),
    ),
    ...section(
      "Due soon",
      "Due within 7 days.",
      header,
      rows(
        mine.filter((f) => isDueSoon(f.due, today, daysBetween(today, f.due))).sort(byDate("due")),
        (f) => `due ${f.due}`,
      ),
    ),
    ...section(
      "Linked to open work",
      "Your items that reference something still open; often a dependency.",
      header,
      rows(mine.filter((f) => f.openLinks.length).sort(byDate("touched")), (f) =>
        f.openLinks.map(ref).join(", "),
      ),
    ),
    ...section(
      "Going stale",
      "No activity for 30+ days.",
      header,
      rows(
        mine
          .filter((f) => isStale(f.touched, daysBetween(f.touched, today)))
          .sort(byDate("touched")),
        (f) => `last activity ${f.touched}`,
      ),
    ),
  ];
}

/** The digest, given today's date (YYYY-MM-DD), who you are, and `login=Name` aliases. */
export function buildSummary(root: string, today: string, me: string[], aliases: string[]): string {
  const org = workOrg(root);
  const all = listWorkFiles(root)
    .map(loadWorkFile)
    .filter((doc) => doc.data.type === "item");
  const items = all.filter((doc) => doc.data.status === "open");
  const hubs = listHubs(root).map((hub) => ({ ...hub, rel: relative(root, hub.file) }));
  const lookup = aliasMap(aliases);
  const canon = (person: string) => lookup.get(person) ?? person;
  const meSet = new Set([...me, ...me.map(canon)]);
  const ctx: Ctx = {
    org,
    me: meSet,
    canon,
    known: new Set(all.map((item) => text(item.data.id))),
    open: new Set(items.map((item) => text(item.data.id))),
    ownedRepos: new Set(hubs.flatMap((hub) => list(hub.data.repos)).map(lower)),
    dependents: dependentsByTarget(items, meSet, canon),
  };
  const ref = (id: string) => shortRef(id, org);
  const itemCell = (f: Fact) => `[${ref(f.id)}](${f.file}) ${cell(f.title)}`;
  const facts = items.map((item) => describe(item, root, ctx));
  const mine = facts.filter((f) => f.mine);
  // Without `me` nothing is known to be yours, so nobody can be waiting on you
  const blocking = meSet.size ? mine.filter((f) => f.blocked.length).sort(byImpact) : [];
  return [
    `Generated by \`work summary\` on ${today}; do not edit below the frontmatter.`,
    "",
    headline(meSet, mine, blocking, facts, hubs),
    "",
    ...blockingSection(blocking, itemCell, ref),
    ...peopleSection(blocking),
    "---",
    "",
    "Below: reference only. None of it is the bottleneck unless it also appears above.",
    "",
    ...referenceSections(mine, today, itemCell, ref),
    ...hubTable(hubs, facts),
    "Refresh: Sync in the Work pane (`/work sync`). Chart: [chart.md](chart.md).",
    "",
  ].join("\n");
}

/** Replace the README body, keeping its frontmatter text as written (comments included). Returns the `me` list used. */
export function writeSummary(root: string, today: string): string[] {
  const file = join(root, "README.md");
  const parts = splitFrontmatter(readFileSync(file, "utf8"));
  const data: Data = parts
    ? readYaml(parts.yaml).data
    : { id: "work", title: "Work", type: "index", summary: "My work." };
  const yaml = parts ? parts.yaml.join("\n") : serializeYaml(data, Object.keys(data));
  const me = list(data.me);
  const body = buildSummary(root, today, me, list(data.aliases));
  writeFileSync(file, `---\n${yaml}\n---\n\n# ${text(data.title)}\n\n${body}`);
  writeList(root, today, me, list(data.watch_repos));
  return me;
}
