import type { Filters } from "@craftainer/crud-sdk";
import type { FieldFilters } from "./types.ts";

/**
 * Turns per-field filter state into the SDK's flat `Filters`: `eq` is the bare
 * field name, every other operator is `field__op`.
 */
export function toQueryFilters(filters: FieldFilters): Filters {
  const out: Record<string, unknown> = {};
  for (const [name, byOp] of Object.entries(filters)) {
    for (const [op, operand] of Object.entries(byOp ?? {})) {
      out[op === "eq" ? name : `${name}__${op}`] = operand;
    }
  }
  return out;
}
