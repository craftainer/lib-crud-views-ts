# docs/contracts/

Interfaces other code is written against, frozen so parallel work can
proceed. A contract changes only through a new ADR that supersedes the
decision behind it.

- [`I4-field-renderers.md`](I4-field-renderers.md) — the field model and the
  field-renderer registry that every view (list, filter, form, detail, stats)
  renders through.

## Do

- Name the contract's exported types and functions exactly as `src/` does.

## Don't

- Describe internals a consumer cannot reach.
