import { BadRequest } from "@craftainer/crud-sdk";

/** More records than the server will touch in one call (`bulk.max_matched`). */
export class BulkLimitError extends Error {
  constructor(max: number) {
    super(limitMessage(max));
    this.name = "BulkLimitError";
  }
}

/**
 * A sequential bulk publish that stopped partway: `published` went through,
 * the record `failedId` did not (`cause` says why), of `total` drafts.
 */
export class PartialPublishError extends Error {
  readonly published: readonly number[];
  readonly total: number;
  readonly failedId: number;
  constructor(
    published: readonly number[],
    total: number,
    failedId: number,
    cause: Error,
  ) {
    super(cause.message, { cause });
    this.name = "PartialPublishError";
    this.published = published;
    this.total = total;
    this.failedId = failedId;
  }
}

function limitMessage(max: number): string {
  return `More than ${max} records match. Narrow the filter or select fewer records.`;
}

/**
 * Drops trailing dots and whitespace in one linear scan (a `/[.\s]+$/` regex
 * backtracks quadratically on long whitespace runs that don't end the string).
 */
function trimTrailingStops(text: string): string {
  let end = text.length;
  while (end > 0 && (text[end - 1] === "." || text[end - 1]!.trim() === ""))
    end--;
  return text.slice(0, end);
}

/**
 * A message for a failed bulk call. The server answers `400` when a filter
 * matches more than `bulk.max_matched` records (or the request is bad for
 * another reason, which its own message then says). A publish that stopped
 * partway says how far it got: "Published N of M; failed at <id>: <reason>".
 */
export function describeBulkError(error: Error, max: number): string {
  if (error instanceof PartialPublishError)
    return `Published ${error.published.length} of ${error.total}; failed at ${error.failedId}: ${error.message}`;
  return error instanceof BadRequest
    ? `${trimTrailingStops(error.message)}. A bulk call touches at most ${max} records; if the filter matches more, narrow it.`
    : error.message;
}
