// The list endpoint of the stub: filters, sort, paging and the archive flag,
// as the server applies them to the in-memory rows (lib-crud-py's crud_query).
import type { JsonObject } from "@craftainer/crud-sdk";

const RESERVED = new Set([
  "id",
  "skip",
  "limit",
  "sort",
  "include_archived",
  "only_archived",
  "include_unpublished",
]);

const cmp = (a: unknown, b: unknown): number =>
  a === b
    ? 0
    : a === null || a === undefined
      ? 1
      : b === null || b === undefined
        ? -1
        : a < b
          ? -1
          : 1;

function matches(value: unknown, op: string, operand: string): boolean {
  const text = value === null || value === undefined ? "" : String(value);
  switch (op) {
    case "min":
      return (
        value !== null &&
        value !== undefined &&
        text >= operand &&
        (typeof value !== "number" || value >= Number(operand))
      );
    case "max":
      return (
        value !== null &&
        value !== undefined &&
        text <= operand &&
        (typeof value !== "number" || value <= Number(operand))
      );
    case "in":
      return operand.split(",").includes(text);
    case "contains":
      return text.includes(operand);
    case "icontains":
      return text.toLowerCase().includes(operand.toLowerCase());
    case "regex":
      return new RegExp(operand).test(text);
    default:
      return text === operand;
  }
}

/** The rows a list request selects: filter, sort, then `skip` and `limit`. */
export function listPage(
  params: URLSearchParams,
  rows: readonly JsonObject[],
): JsonObject[] {
  // `only_archived=true` returns just the archived rows and implies
  // `include_archived` (the SDK refuses it with `include_archived=false`).
  const only = params.get("only_archived") === "true";
  let out = rows.filter((row) => {
    const archived =
      row["archived_at"] !== null && row["archived_at"] !== undefined;
    if (
      only ? !archived : archived && params.get("include_archived") !== "true"
    )
      return false;
    if (
      params.get("include_unpublished") !== "true" &&
      row["is_draft"] === true
    )
      return false;
    for (const [key, operand] of params) {
      if (RESERVED.has(key)) continue;
      const at = key.lastIndexOf("__");
      const [name, op] =
        at < 0 ? [key, "eq"] : [key.slice(0, at), key.slice(at + 2)];
      if (!matches(row[name as string], op as string, operand)) return false;
    }
    return true;
  });
  for (const key of (params.get("sort") ?? "")
    .split(",")
    .filter(Boolean)
    .reverse()) {
    const desc = key.startsWith("-");
    const name = desc ? key.slice(1) : key;
    out = [...out].sort((a, b) => (desc ? -1 : 1) * cmp(a[name], b[name]));
  }
  const skip = Number(params.get("skip") ?? 0);
  const limit = Number(params.get("limit") ?? out.length);
  return out.slice(skip, skip + limit);
}

/** `count` heroes with varied names, powers and levels, for paging stories. */
export function manyHeroes(count: number): JsonObject[] {
  const names = [
    "Atlas",
    "Beacon",
    "Cipher",
    "Delta",
    "Ember",
    "Flux",
    "Gale",
    "Helix",
  ];
  return Array.from({ length: count }, (_, i) => ({
    owner_id: "stub-owner",
    is_draft: i % 7 === 3,
    archived_at: null,
    publish_at: null,
    unpublish_at: null,
    is_locked: i % 5 === 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T09:30:00Z`,
    id: i + 1,
    name: `${names[i % names.length]} ${i + 1}`,
    powers: ["Foresight"],
    power_level: (i * 17) % 100,
  }));
}
