// Stub routes for detail, revisions, bulk and lifecycle (VW3): revisions,
// publish, restore, soft delete, bulk delete and filtered lists. Registered by
// one call in ../stub.ts. Only the heroes v2 resource has these capabilities.
import type { JsonObject } from "@craftainer/crud-sdk";

/** The manifest's `bulk.max_matched`. */
export const MAX_MATCHED = 1000;

const ARCHIVABLE = "/api/crud/v1/heroes/v2/json";
const RESERVED = new Set([
  "id",
  "skip",
  "limit",
  "sort",
  "include_archived",
  "include_unpublished",
]);
const LIST_PARAMS = new Set(["skip", "limit", "sort"]);

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const problem = (status: number, title: string): Response =>
  json(status, { title, status });

/** The history of a record, newest first, in the server's `RevisionView` shape. Ids above 50 have none. */
export function revisionRows(id: number): JsonObject[] {
  if (id > 50) return [];
  const revision = (
    n: number,
    action: string,
    actor: string,
    createdAt: string,
    snapshot: JsonObject,
  ): JsonObject => ({
    id: id * 100 + n,
    resource: "hero",
    record_id: id,
    action,
    actor,
    created_at: createdAt,
    snapshot,
  });
  return [
    revision(3, "update", "ada", "2026-01-02T09:30:00Z", {
      id,
      name: "Captain Ledger",
      powers: ["Foresight", "Filing"],
      power_level: 72,
    }),
    revision(2, "update", "grace", "2026-01-01T16:05:00Z", {
      id,
      name: "Captain Ledger",
      powers: ["Foresight"],
      power_level: 64,
    }),
    revision(1, "create", "ada", "2026-01-01T08:00:00Z", {
      id,
      name: "Lieutenant Ledger",
      powers: ["Foresight"],
      power_level: 64,
    }),
  ];
}

const withHistoryRows = new WeakSet<JsonObject>();

/**
 * Marks rows as having a revision history (the stub serves `/revisions` only
 * for those, so other tests keep seeing it unrouted), and returns them.
 */
export function withHistory<T extends JsonObject>(rows: readonly T[]): T[] {
  for (const row of rows) withHistoryRows.add(row);
  return [...rows];
}

const lifecycleSeed: readonly JsonObject[] = [
  {
    owner_id: "stub-owner",
    is_draft: false,
    archived_at: null,
    publish_at: null,
    unpublish_at: null,
    is_locked: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T09:30:00Z",
    id: 1,
    name: "Captain Ledger",
    powers: ["Foresight", "Filing"],
    power_level: 72,
  },
  {
    owner_id: "stub-owner",
    is_draft: true,
    archived_at: null,
    publish_at: null,
    unpublish_at: null,
    is_locked: false,
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T09:30:00Z",
    id: 2,
    name: "The Margin",
    powers: ["Annotation"],
    power_level: 41,
  },
  {
    owner_id: "stub-owner",
    is_draft: false,
    archived_at: "2026-02-01T12:00:00Z",
    publish_at: null,
    unpublish_at: null,
    is_locked: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T12:00:00Z",
    id: 3,
    name: "Old Stamp",
    powers: null,
    power_level: 18,
  },
];

/** A few live, draft and archived heroes, with histories, for the lifecycle stories (fresh copies each call). */
export const lifecycleHeroes = (): JsonObject[] =>
  withHistory(lifecycleSeed.map((row) => ({ ...row })));

/** `count` live heroes, for the over-the-limit story. */
export function manyHeroes(count: number): JsonObject[] {
  return Array.from({ length: count }, (_, index) => ({
    owner_id: "stub-owner",
    is_draft: false,
    archived_at: null,
    publish_at: null,
    unpublish_at: null,
    is_locked: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T09:30:00Z",
    id: index + 1,
    name: `Hero ${index + 1}`,
    powers: null,
    power_level: index % 100,
  }));
}

function matches(row: JsonObject, params: URLSearchParams): boolean {
  for (const [key, text] of params) {
    if (RESERVED.has(key)) continue;
    const at = key.lastIndexOf("__");
    const name = at < 0 ? key : key.slice(0, at);
    const op = at < 0 ? "eq" : key.slice(at + 2);
    const value = row[name];
    const asText = String(value);
    if (op === "eq" && asText !== text) return false;
    if (op === "in" && !text.split(",").includes(asText)) return false;
    if (op === "min" && !(Number(value) >= Number(text))) return false;
    if (op === "max" && !(Number(value) <= Number(text))) return false;
    if (op === "contains" && !asText.includes(text)) return false;
    if (
      op === "icontains" &&
      !asText.toLowerCase().includes(text.toLowerCase())
    )
      return false;
  }
  return true;
}

const filterCount = (params: URLSearchParams): number =>
  [...params.keys()].filter((key) => !RESERVED.has(key)).length;

/**
 * Answers the requests this area adds, or `undefined` for the base stub.
 * `tables` maps a resource path to its rows.
 */
export async function detailRoutes(
  request: Request,
  url: URL,
  tables: ReadonlyMap<string, JsonObject[]>,
): Promise<Response | undefined> {
  const base = [...tables.keys()].find(
    (key) => url.pathname === key || url.pathname.startsWith(`${key}/`),
  );
  if (base === undefined) return undefined;
  const rows = tables.get(base) as JsonObject[];
  const sub = url.pathname.slice(base.length);
  const params = url.searchParams;
  const id = params.get("id");
  const row = rows.find((r) => String(r["id"]) === id);
  const archivable = base === ARCHIVABLE;
  const archive = (target: JsonObject): void => {
    target["archived_at"] = "2026-03-01T10:00:00Z";
  };

  if (
    request.method === "GET" &&
    sub === "/revisions" &&
    row !== undefined &&
    withHistoryRows.has(row)
  ) {
    return json(200, revisionRows(Number(id)));
  }
  if (request.method === "POST" && sub === "/publish") {
    if (row === undefined) return problem(404, "Not found");
    row["is_draft"] = false;
    return json(200, row);
  }
  if (request.method === "POST" && sub === "/restore") {
    const targets =
      id === null
        ? filterCount(params) === 0
          ? undefined
          : rows.filter((r) => matches(r, params))
        : row === undefined
          ? []
          : [row];
    if (targets === undefined) return problem(422, "needs a filter");
    if (id !== null && targets.length === 0) return problem(404, "Not found");
    for (const target of targets) target["archived_at"] = null;
    return json(200, {
      matched: targets.length,
      ids: targets.map((t) => t["id"]),
    });
  }
  if (sub !== "") return undefined;

  if (request.method === "DELETE" && id === null) {
    if (filterCount(params) === 0) return problem(422, "needs a filter");
    const targets = rows.filter((r) => matches(r, params));
    if (targets.length > MAX_MATCHED) {
      return problem(400, "too many records match");
    }
    for (const target of targets) {
      if (archivable) archive(target);
      else rows.splice(rows.indexOf(target), 1);
    }
    return json(200, {
      matched: targets.length,
      ids: targets.map((t) => t["id"]),
    });
  }
  if (request.method === "DELETE" && archivable && row !== undefined) {
    archive(row);
    return new Response(null, { status: 204 });
  }
  const listed =
    request.method === "GET" &&
    id === null &&
    [...params.keys()].some((key) => !LIST_PARAMS.has(key));
  if (listed) {
    const skip = Number(params.get("skip") ?? 0);
    const limit = Number(params.get("limit") ?? rows.length);
    const visible = rows.filter(
      (r) =>
        (params.get("include_archived") === "true" ||
          typeof r["archived_at"] !== "string") &&
        (params.get("include_unpublished") === "true" ||
          r["is_draft"] !== true) &&
        matches(r, params),
    );
    return json(200, visible.slice(skip, skip + limit));
  }
  return undefined;
}
