import type { JsonObject } from "@craftainer/crud-sdk";
import type { FieldDescriptor } from "../core/index.ts";

/** One entry of a record's history (`GET revisions?id=`, newest first). */
export interface Revision {
  readonly id: number;
  readonly action: string;
  readonly actor: string;
  /** ISO-8601 UTC. */
  readonly createdAt: string;
  /** The record as it was after the action. */
  readonly snapshot: JsonObject;
}

/** Reads the server's revision rows. A row without a snapshot gets an empty one. */
export function toRevisions(rows: readonly JsonObject[]): Revision[] {
  return rows.map((row) => ({
    id: Number(row["id"]),
    action: String(row["action"]),
    actor: String(row["actor"]),
    createdAt: String(row["created_at"]),
    snapshot: (row["snapshot"] ?? {}) as JsonObject,
  }));
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Names of the `fields` whose value differs between two snapshots. */
export function changedFields(
  fields: readonly FieldDescriptor[],
  before: JsonObject,
  after: JsonObject,
): string[] {
  return fields
    .filter((f) => !same(before[f.name], after[f.name]))
    .map((f) => f.name);
}

/**
 * The `PATCH` body that puts a record back to `snapshot`: the writable fields
 * the snapshot has. A `null` for a field that does not take `null` is left out,
 * as a cleared optional field is everywhere else.
 */
export function restorePatch(
  fields: readonly FieldDescriptor[],
  snapshot: JsonObject,
): JsonObject {
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.readOnly || !(f.name in snapshot)) continue;
    const value = snapshot[f.name];
    if (value === null && !f.nullable) continue;
    patch[f.name] = value;
  }
  return patch;
}

/** A descriptor for the revision timestamp, so it renders like any datetime. */
export const CREATED_AT_FIELD: FieldDescriptor = {
  name: "created_at",
  label: "When",
  kind: "datetime",
  format: "date-time",
  nullable: false,
  readOnly: true,
  required: false,
  choices: null,
  itemKind: null,
  constraints: {
    minLength: undefined,
    maxLength: undefined,
    minimum: undefined,
    maximum: undefined,
    pattern: undefined,
  },
  inManifest: false,
  sortable: false,
  filterOps: [],
  numeric: false,
  categorical: false,
};
