import type {
  FieldDescriptor,
  FieldFilter,
  FilterOp,
  FilterScalar,
} from "./types.ts";

/** Sets `op` on `current`; an empty operand removes it, and no operators left is `undefined`. */
export function withOp(
  current: FieldFilter | undefined,
  op: FilterOp,
  operand: FilterScalar | readonly FilterScalar[] | undefined,
): FieldFilter | undefined {
  const next: Record<string, FilterScalar | readonly FilterScalar[]> = {
    ...current,
  };
  if (
    operand === undefined ||
    (Array.isArray(operand) && operand.length === 0)
  ) {
    delete next[op];
  } else {
    next[op] = operand;
  }
  return Object.keys(next).length === 0 ? undefined : (next as FieldFilter);
}

/**
 * Whether the manifest lets a client filter on this field at all. The
 * resource's key field (`resource.id_field`) is filterable too; the views that
 * offer filters leave it out themselves.
 */
export const isFilterable = (field: FieldDescriptor): boolean =>
  field.filterOps.length > 0;
