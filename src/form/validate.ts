// Client-side checks against the schema constraints, run before submit.
import type { FieldDescriptor, FieldValue } from "../core/index.ts";

const isEmpty = (value: FieldValue): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/** Compiled patterns by source; `null` for one JavaScript cannot compile. */
const compiled = new Map<string, RegExp | null>();

/**
 * JSON Schema patterns are ECMA-262 regular expressions, which SHOULD be built
 * with the `u` flag (2020-12 core, "Regular Expressions"). Escapes that only
 * the legacy grammar allows (`\_`, `\:`) throw under `u`, so those retry
 * without it. A pattern neither grammar compiles (Python flavour) is left to
 * the server, with one warning per pattern.
 */
function compile(pattern: string): RegExp | null {
  const known = compiled.get(pattern);
  if (known !== undefined) return known;
  let regex: RegExp | null = null;
  for (const flags of ["u", ""]) {
    try {
      regex = new RegExp(pattern, flags);
      break;
    } catch {
      // Try the next grammar.
    }
  }
  if (regex === null) {
    console.warn(
      `The pattern ${JSON.stringify(pattern)} is not a JavaScript regular expression: it is not checked here, only by the server.`,
    );
  }
  compiled.set(pattern, regex);
  return regex;
}

const matches = (pattern: string, value: string): boolean =>
  compile(pattern)?.test(value) ?? true;

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
