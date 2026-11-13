# 0003. Require If-Match for resources that declare conditional requests

## Status

Proposed

## Context

A resource whose manifest says `capabilities.conditional_requests` accepts
`If-Match` on `PATCH` and answers `412` when the record changed. Until now the
views sent the header only when the app wired it: `ResourceForm`'s `etag`
callback, `ResourceList`'s `ifMatch` prop, or the SDK cache's `autoIfMatch`
middleware for revision Restore. With none of them, every save was
unconditional, so a form open for an hour, an inline edit or a Restore of
revision 3 silently overwrote a colleague's newer edit and the conflict UI was
unreachable (OWASP review OW-lib-crud-views-ts, Medium, A06).

The server side is settled: lib-crud-py 0.10 applies `If-Match` atomically as
the expected version and answers `412` on a mismatch (no `428`: a request
without the header stays valid for non-browser clients). The SDK's record read
does not return the ETag, but since `@craftainer/crud-sdk` 0.8 (SD2) its cache
keeps the last validator of every record it read, also for `no-store`
responses, for `If-Match` only, readable with `cache.cachedEtag(resource, id,
scope, apiVersion)`. The optimistic-concurrency decision (2026-10-31) is
breaking for integrators and ships as a 0.x minor.

## Decision

We will make a conditional write fail closed:

- `CrudProvider` takes `etags`, the SDK cache (anything with `cachedEtag`).
  The views resolve a record's ETag from the view's own `etag` / `ifMatch` prop
  first, then from `etags`.
- When the resource declares `conditional_requests` and no ETag is known, the
  save is refused with `MissingEtagError` and nothing is sent. The same holds
  for the form, the table's inline edit and revision Restore. Resources
  without `conditional_requests` are unchanged.
- Without an app-supplied `etag` / `ifMatch`, the form, the table's inline
  edit and revision Restore read the record through the SDK right before the
  write (`GET`), so the validator in the SDK cache is the one of what was just
  read. The form compares the read with what it loaded or last saved (all
  fields) and the inline edit compares the edited fields with the row; a
  difference rejects with `StaleRecordError` (shown as a conflict, nothing
  sent). Restore replaces the record on purpose and uses the fresh validator
  without that comparison. We chose "read, compare, send" over "capture the
  validator at load" because the SDK cache holds only the newest validator per
  record and drops it on every write, and a background refetch (window focus)
  would otherwise replace the one the user's edit was based on.
- "Overwrite" after a `412` re-reads the record and sends its current ETag
  instead of sending no `If-Match`: a third writer still gets a `412`.
- `publish`, trash restore, `clone` and bulk calls are not made conditional:
  the SDK methods take no `If-Match`. `delete` takes only the id.

We will not read the ETag from a response header ourselves (the SDK owns the
transport) and will not depend on `@craftainer/crud-sdk/cache` at runtime: the
store is structural, so any SDK version with `cachedEtag` works.

## Consequences

- Breaking: an app on a conditional resource that wired nothing now gets
  "its ETag is unknown" on save. It must pass `etags={cache}` (or `etag` /
  `ifMatch`). An app that relied on `autoIfMatch` for Restore must also pass
  `etags`. Migration notes are in the README.
- A conflict is now reachable by default, so the `412` UI is exercised.
- Every form save, inline edit and Restore costs one extra `GET`.
- Between the read and the PATCH there is a window (and the cache keeps only
  the newest validator, so another view's read of the same record can replace
  it) that only the server's atomic check closes; the views cannot do better
  without the list endpoint returning ETags or the SDK returning the validator
  with the read.
- The `@craftainer/crud-sdk` peer range is unchanged (0.4 to 0.6): validator
  retention for `no-store` responses needs 0.8. Widening to 0.8/0.9 is a
  follow-up once 0.9.0 passes `minimumReleaseAge`.
- The `undo` delete variant is unchanged: `delete` takes only the id, so a
  delete is not conditional.
