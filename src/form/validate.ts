// Client-side checks against the schema constraints, run before submit.
import type { FieldDescriptor, FieldValue } from "../core/index.ts";

const isEmpty = (value: FieldValue): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

function matches(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    // A pattern JavaScript cannot compile (Python flavour): the server checks it.
    return true;
  }
}

/**
 * The message for the first schema constraint `value` breaks, or `null`.
 * A missing value breaks only `required`; booleans are never missing.
 */
export function validateValue(
  field: FieldDescriptor,
  value: FieldValue,
): string | null {
  if (isEmpty(value)) {
    return field.required && field.kind !== "boolean" ? "Required" : null;
  }
  const { minimum, maximum, minLength, maxLength, pattern } = field.constraints;
  if (typeof value === "number") {
    if (field.kind === "integer" && !Number.isInteger(value)) {
      return "Enter a whole number";
    }
    if (minimum !== undefined && value < minimum) {
      return `Must be at least ${minimum}`;
    }
    if (maximum !== undefined && value > maximum) {
      return `Must be at most ${maximum}`;
    }
  }
  if (typeof value === "string") {
    // JSON Schema counts code points, not UTF-16 code units.
    const length =
      minLength === undefined && maxLength === undefined
        ? 0
        : [...value].length;
    if (minLength !== undefined && length < minLength) {
      return `Must be at least ${minLength} characters`;
    }
    if (maxLength !== undefined && length > maxLength) {
      return `Must be at most ${maxLength} characters`;
    }
    if (pattern !== undefined && !matches(pattern, value)) {
      return "Does not match the expected format";
    }
  }
  return null;
}

/** Errors by field name for every field whose value breaks a constraint. */
export function validateAll(
  fields: readonly FieldDescriptor[],
  values: Readonly<Record<string, FieldValue>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const message = validateValue(field, values[field.name]);
    if (message !== null) errors[field.name] = message;
  }
  return errors;
}
