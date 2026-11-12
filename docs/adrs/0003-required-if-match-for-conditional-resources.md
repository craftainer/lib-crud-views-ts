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
- The form uses the validator of the record as it loaded it. The SDK cache
  drops it on every write, so after the form's own save the record is read
  again, and the new validator is used only if the record still shows what the
  form saved (else the save is treated as a conflict, `StaleRecordError`).
- The table's inline edit and Restore read the record once through the SDK when
  the store holds no validator for it. Inline edit then also requires the
  edited fields to equal what the row showed (else `StaleRecordError`, shown as
  "changed elsewhere"). Restore replaces the record on purpose, so it uses the
  fresh validator without that comparison.
- "Overwrite" after a `412` re-reads the record and sends its current ETag
  instead of sending no `If-Match`: a third writer still gets a `412`.

We will not read the ETag from a response header ourselves (the SDK owns the
transport) and will not depend on `@craftainer/crud-sdk/cache` at runtime: the
store is structural, so any SDK version with `cachedEtag` works.

## Consequences

- Breaking: an app on a conditional resource that wired nothing now gets
  "its ETag is unknown" on save. It must pass `etags={cache}` (or `etag` /
  `ifMatch`). An app that relied on `autoIfMatch` for Restore must also pass
  `etags`. Migration notes are in the README.
- A conflict is now reachable by default, so the `412` UI is exercised.
- Inline edit and Restore cost one extra `GET` when no validator is cached.
- The fresh-read fallback has a window between the read and the PATCH that
  only the server's atomic check closes; the views cannot do better without
  the list endpoint returning ETags.
- The `undo` delete variant is unchanged: `delete` takes only the id, so a
  delete is not conditional.
