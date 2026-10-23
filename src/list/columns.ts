import type { FieldDescriptor, ReadyResource } from "../core/index.ts";

/** A column: a field name, or a name with a header and a size. */
export type ColumnSpec =
  | string
  | {
      readonly field: string;
      /** Header text. Default: the field's label. */
      readonly header?: string | undefined;
      /** Width in pixels (a number) for the table. */
      readonly width?: number | undefined;
    };

/** A resolved column. */
export interface Column {
  readonly field: FieldDescriptor;
  readonly header: string;
  readonly width: number | undefined;
}

/**
 * The columns to show. Default: every described field except JSON ones.
 * Names the resource does not have are skipped.
 */
export function resolveColumns(
  ready: ReadyResource,
  columns?: readonly ColumnSpec[],
): Column[] {
  if (columns === undefined)
    return ready.fields
      .filter((f) => f.kind !== "json")
      .map((field) => ({ field, header: field.label, width: undefined }));
  return columns.flatMap((spec): Column[] => {
    const {
      field: name,
      header,
      width,
    } = typeof spec === "string"
      ? { field: spec, header: undefined, width: undefined }
      : spec;
    const field = ready.field(name);
    return field === undefined
      ? []
      : [{ field, header: header ?? field.label, width }];
  });
}
