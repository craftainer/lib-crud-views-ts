import type { JsonObject } from "@craftainer/crud-sdk";

export type RecordStatus = "published" | "draft" | "archived";

/** Fields the server maintains (lifecycle and audit); the detail view shows them in its metadata panel. */
export const SYSTEM_FIELDS: readonly string[] = [
  "id",
  "owner_id",
  "created_at",
  "updated_at",
  "is_draft",
  "archived_at",
  "publish_at",
  "unpublish_at",
  "is_locked",
];

/** `archived` wins over `draft`; a record with neither marker is `published`. */
export function recordStatus(record: JsonObject): RecordStatus {
  if (typeof record["archived_at"] === "string") return "archived";
  return record["is_draft"] === true ? "draft" : "published";
}

export type StatusFilterValue = "published" | "draft" | "all";

/** What a list query needs for a status choice: spread into `useList`'s query. */
export interface StatusQuery {
  readonly includeUnpublished: boolean;
  readonly filters: Readonly<Record<string, unknown>>;
}

/**
 * The list query for a status choice. The server hides drafts unless
 * `include_unpublished` is set; `draft` also filters on `is_draft`.
 */
export function statusQuery(value: StatusFilterValue): StatusQuery {
  return {
    includeUnpublished: value !== "published",
    filters: value === "draft" ? { is_draft: true } : {},
  };
}
