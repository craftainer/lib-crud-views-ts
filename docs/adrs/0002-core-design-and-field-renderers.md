# 0002. Core design: provider, resource hook, layered field-renderer registry

## Status

Accepted

## Context

`@craftainer/crud-views` renders any CRUD resource from the manifest
(`@craftainer/crud-sdk`). Four parallel items (VW1 list/filter/sort, VW2
forms, VW3 detail/revisions/bulk, VW4 stats) must agree on how a field is
displayed, edited and filtered before any of them starts, and the package
must work in apps with different MUI themes. Forces:

- The manifest's `fields` list holds only scalar, filterable fields. Arrays
  (`powers`), nullability, formats and `readOnly` live in the JSON Schemas.
- Consumers differ: an app wants one override for every `email` field, another
  wants a special `heroes.power_level` input, a test wants none.
- The SDK's `./tanstack` factories return plain options (no React); the React
  wrappers belong here. `ResourceClient` is only built by `CrudClient`.
- template-react (UI3) fixed a visual-regression workflow and the Field Ledger
  design direction; MUI is the component library (P-D4) and only MIT-tier MUI X
  is used (`@mui/x-data-grid`, `@mui/x-charts`).

## Decision

We will:

- Ship the core in `src/core/` behind one entry point (`.`). All runtime
  libraries are **peer** dependencies (react, react-dom, MUI, MUI X, Emotion,
  TanStack Query, `@craftainer/crud-sdk`); the package has no dependencies.
  View areas add their exports to `src/index.ts`; tree-shaking (`sideEffects:
false`) keeps unused areas out of an app.
- Provide `CrudProvider` (client, `QueryClient`, optional MUI `Theme`,
  renderers, locale, time zone, caller scope) and `useResource`, which loads
  the manifest through TanStack Query (cached forever per client and scope; the
  SDK cache owns revalidation) and returns a discriminated
  `pending | error | ready` result with capabilities, `FieldDescriptor`s, the
  SDK handle and hooks bound to the resource. Two `api_version`s never share a
  query key.
- Derive `FieldDescriptor`s from `fields` plus the read/create/update schemas
  (`$ref`, `anyOf: [X, null]`, formats, enums), so arrays and JSON members the
  manifest does not list still render.
- Define contract **I4** (`docs/contracts/I4-field-renderers.md`): wire values,
  three renderer roles (display, input, filter), selectors
  (`resource.field`, `kind:format`, `kind`), and four layers (component,
  provider, process-wide `registerFieldRenderer`, built-ins) where the nearest
  layer wins and, inside a layer, the most specific selector. The plan's
  `registerFieldRenderer(type, component)` becomes `(selector, { display?,
input?, filter? })`, since one component per type cannot express three roles.
- Be theme-agnostic: components style only through MUI theme tokens, enforced
  by `scripts/check-design-tokens.sh` over `src/` (stories included). The
  Field-Ledger-like demo theme lives in `.storybook/`, outside the package.
- Copy UI3's visual setup unchanged in policy: Storybook 10, Playwright run
  only inside the pinned image (tag and digest in `tests/visual/run.sh` and
  `.github/workflows/visual.yml`, equal to the `@playwright/test` version),
  arm64 baselines, zero pixel tolerance, axe on every story. Stories run
  against a real SDK client over a fake `fetch` (`tests/fixtures/stub.ts`),
  with the manifest fixture copied from `lib-crud-py`'s conformance fixtures.
- Keep the template's 100% coverage gate, widened to `.tsx`; stories are
  excluded from coverage and covered by the visual suite.

## Consequences

- VW1-VW4 can start in parallel, touching only their own directory and one
  line in `src/index.ts`.
- A renderer override is one declaration at any scope; the layer-first rule is
  easy to explain but means a global `heroes.name` registration loses to a
  provider-level `string` override. Apps wanting the reverse set both at one
  layer.
- `datetime` inputs are read as UTC (a `datetime-local` field has no zone);
  `date` values are never shifted. No date-picker package is needed.
- Peers are many; apps must install each (and Emotion). Version ranges follow
  MUI 9.4+, MUI X 9.16+, React 19.2+.
- Fonts, motion and the Field Ledger tokens are not bundled: the demo theme
  approximates the direction with system fonts so baselines stay stable.
- Release is staged (`npm stage publish`) through the template's contract; the
  first version waits on the user's 2FA approval.

## Addendum (2026-10-22): `onInvalid` and `$ref` chains

Found while building the form views (VW2); both are additive to the I4
contract.

- `InputRendererProps` gains an optional `onInvalid(reason | null)`. A draft
  that cannot become a valid value (unparsable number, bad JSON) never reaches
  `onChange`, so a form could not otherwise tell that the field holds text it
  would silently drop. Built-in inputs report the reason, and `null` when the
  draft is valid again or the input unmounts; forms block submit meanwhile.
  Custom renderers may ignore it.
- `describeFields` follows `$ref` chains and JSON-pointer escapes (`~0`, `~1`,
  percent-encoding), as Pydantic's `$defs` produce them; a cyclic or dangling
  ref leaves the node unresolved (kind `json`).
