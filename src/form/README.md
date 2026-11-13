# src/form/

`ResourceForm`: a create or edit form generated from a resource's `create` and
`update` schemas, through `FieldInput`.

- `ResourceForm.tsx` — the component and its state (values, validation,
  save, conflict, auto-save).
- `layout.tsx`, `sections.ts` — flat, sectioned, tabbed and stepper layouts;
  every panel stays mounted so drafts survive.
- `validate.ts` — required, integer, minimum, maximum, length and pattern
  checks before submit. A pattern is compiled with the `u` flag (JSON Schema
  2020-12), without it when only the legacy ECMA-262 grammar accepts the
  pattern; one neither accepts (Python flavour) is left to the server, with a
  `console.warn` once per pattern.
- `problem.ts` — maps SDK errors: 422 `errors` (`{loc, msg, type}`) onto
  fields, 412 to a conflict.

## Behaviour to know

- Presentations: `page`, `dialog`, `drawer`. Layouts: `flat`, `sections`,
  `tabs`, `stepper`. `autoSave` (edit only) saves after a pause while valid.
- Edit sends only changed fields. **Clearing a non-nullable optional field
  omits it from the PATCH** (nothing is sent for it); a nullable one sends
  `null`.
  So the user is not left thinking it was saved, the emptied field shows the
  helper text "Clearing this field is not saved; its value is kept." (through
  the input's `helperText`, as MUI's `TextField` shows it) until it has a value
  again. Create has no such hint: nothing was there to clear.
- Submit is blocked while a built-in input reports an invalid draft
  (`onInvalid`, I4 addendum).
- `If-Match`: on a resource with `conditional_requests` every edit save carries
  it, never an unconditional PATCH. With `etag(id)` (the app's callback) that
  value is used. Without it the form reads the record right before the save,
  compares it with what it loaded or last saved (every field; a difference is a
  conflict, `StaleRecordError`) and sends the ETag of that read, taken from
  `CrudProvider`'s `etags` (the SDK cache's `cachedEtag`); with no source at all
  the save is refused with `MissingEtagError`. On 412 the form offers Reload
  (discard edits) and Overwrite (re-reads the record, then saves with its
  current ETag). Rationale:
  `docs/adrs/0003-required-if-match-for-conditional-resources.md`.
- Writable fields are those in the `create` (or `update`) schema; relations
  do not exist in the manifest, so there are no nested rows.

## Don't

- Render inputs other than through `FieldInput`, and always pass `renderers`.
