import type { FieldDescriptor, FieldValue } from "./types.ts";

/** What a cleared input emits: `null` for a nullable field, else `undefined`. */
export const emptyValue = (field: FieldDescriptor): FieldValue =>
  field.nullable ? null : undefined;
