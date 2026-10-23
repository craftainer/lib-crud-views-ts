import { BadRequest } from "@craftainer/crud-sdk";

/** More records than the server will touch in one call (`bulk.max_matched`). */
export class BulkLimitError extends Error {
  constructor(max: number) {
    super(limitMessage(max));
    this.name = "BulkLimitError";
  }
}

function limitMessage(max: number): string {
  return `More than ${max} records match. Narrow the filter or select fewer records.`;
}

/**
 * A message for a failed bulk call. The server answers `400` when a filter
 * matches more than `bulk.max_matched` records.
 */
export function describeBulkError(error: Error, max: number): string {
  return error instanceof BadRequest ? limitMessage(max) : error.message;
}
