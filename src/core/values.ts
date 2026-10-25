import type { FieldDescriptor, FieldValue } from "./types.ts";

/** What a cleared input emits: `null` for a nullable field, else `undefined`. */
export const emptyValue = (field: FieldDescriptor): FieldValue =>
  field.nullable ? null : undefined;

/**
 * Parses a wire timestamp. The server's datetimes are UTC (naive-UTC storage,
 * contract I4), so a value without a zone designator is read as UTC rather
 * than as the browser's local time; a trailing RFC 9557 `[UTC]` suffix is
 * ignored. `YYYY-MM-DD` is UTC midnight. `null` when it does not parse.
 */
export function parseInstant(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\[UTC\]$/, "");
  // A bare date is UTC already; check it first, as `-05` would pass for an offset.
  const bare = /^\d{4}(?:-\d\d){0,2}$/.test(text);
  const zoned = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(text);
  const date = new Date(bare || zoned ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
