// Maps SDK errors onto the form: 422 problem details onto fields, 412 to a conflict.
import { PreconditionFailed, ProblemError } from "@craftainer/crud-sdk";

/** What a failed save shows. */
export interface SaveFailure {
  /** 412: the record changed since it was loaded. */
  readonly conflict: boolean;
  /** Messages by field name, from 422 `errors`. */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** Text for an alert: everything not tied to a visible field. */
  readonly message: string | null;
}

/**
 * Normalises `loc` (`["body", "name", 0]`) to its field name. Only the first
 * element names where the error is (`body`, `query`); a field called `body` is
 * `["body", "body"]`.
 */
function fieldOf(loc: readonly (string | number)[]): string | undefined {
  const [head, ...rest] = loc;
  const first = head === "body" || head === "query" ? rest[0] : head;
  return first === undefined ? undefined : String(first);
}

/** Splits a mutation error into field messages, a conflict flag and an alert message. */
export function describeFailure(
  error: unknown,
  fieldNames: readonly string[],
): SaveFailure {
  if (error instanceof PreconditionFailed) {
    return { conflict: true, fieldErrors: {}, message: null };
  }
  const fieldErrors: Record<string, string> = {};
  const general: string[] = [];
  if (error instanceof ProblemError && error.errors.length > 0) {
    for (const entry of error.errors) {
      const name = fieldOf(entry.loc);
      if (name !== undefined && fieldNames.includes(name)) {
        fieldErrors[name] ??= entry.msg;
      } else {
        general.push(name === undefined ? entry.msg : `${name}: ${entry.msg}`);
      }
    }
    return {
      conflict: false,
      fieldErrors,
      message: general.length === 0 ? null : general.join("; "),
    };
  }
  const message =
    error instanceof ProblemError
      ? `${error.title}${error.detail === undefined ? "" : `: ${error.detail}`}`
      : error instanceof Error
        ? error.message
        : "The record could not be saved";
  return { conflict: false, fieldErrors, message };
}
