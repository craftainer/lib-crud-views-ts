# I4. Field renderers

Frozen by VW0 (ADR [0002](../adrs/0002-core-design-and-field-renderers.md)).
VW1 (list, filter, sort), VW2 (create, edit, delete), VW3 (detail, revisions,
bulk) and VW4 (stats, predictions) render and edit values **only** through the
names below, all exported from `@craftainer/crud-views` (`src/core/`). Adding
an optional member or a new `FieldKind` is compatible; anything else needs a
new contract.

Source of truth: `src/core/types.ts`, `registry.ts`, `fieldComponents.tsx`.

## 1. Setup

```tsx
<CrudProvider
  client={client}
  queryClient={queryClient}
  theme={theme}
  renderers={overrides}
  locale="en-US"
  timeZone="UTC"
  scope={userId}
>
  <ResourceGate name="heroes">{(r) => <MyView ready={r} />}</ResourceGate>
</CrudProvider>
```

- `client` is a `@craftainer/crud-sdk` `CrudClient`; `queryClient` a TanStack
  `QueryClient`. `theme` (a MUI `Theme`) is optional: omit it to inherit the
  ambient theme. The library never creates a theme.
- `scope` is optional. Omit it and the provider resolves `client.namespace()`:
  `{ client: client.id, scope }` where `scope` is `"anon"` or a hash of the
  bearer token. Give a string to name the caller yourself (for example the
  user id); the client part stays `client.id`. `locale` and `timeZone` drive
  number and `datetime` formatting (`date` always UTC).
- `useCrud()` returns `{ client, queryClient, namespace, namespaceError,
locale, timeZone, renderers }` and throws outside a provider. `namespace` is
  `undefined` while `client.namespace()` is pending and `namespaceError` is set
  when it rejects (a token provider that threw); `useResource` stays
  `"pending"` for the first and is `"error"` for the second. The namespace is
  resolved once per client: after a login, logout or token refresh that
  changes the caller, remount the provider (give it a `key` of the token).

## 2. `useResource(name, apiVersion?)`

Returns one of:

| `status`    | Members                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"pending"` | `error: null`                                                                                                                                                                                                                                          |
| `"error"`   | `error: Error` (`UnknownResourceError`, `ManifestError`, a network `CrudError`)                                                                                                                                                                        |
| `"ready"`   | `resource` (the manifest entry), `capabilities` (= `resource.capabilities`), `fields: FieldDescriptor[]`, `field(name)`, `handle` (the SDK `ResourceClient`, for clone/publish/restore/bulk), `namespace`, `queryName`, `api` (`TanstackApi`), `hooks` |

`hooks` (stable while the resource is): `useList(query?)`,
`useInfiniteList(query?, { limit })`, `useRecord(id)`, `useStats(query?)`,
`usePredict(query?)`, `useRevisions(id)`, `useCreate()`, `useUpdate()`
(variables `{ id, patch, ifMatch? }`), `useDelete()`. Every query key is the
SDK's `["crud", client, resource, scope, kind, ...]` (`kind` is `list`,
`record`, `stats`, `predict`, `revisions`, or `trash` for `TrashList`), and the
manifest is `["crud", client, "_manifest", scope]`, where `client` and `scope`
are the provider's namespace and `resource` is the resource `name`, or
`name@apiVersion` when a version was requested. Two clients, two callers or two
versions on one `QueryClient` never share an entry. The ready result exposes
the pair as `namespace` and `queryName`, the first two arguments of the SDK's
`*Options` factories and `invalidate*` helpers. Mutations invalidate lists,
stats and predictions of the resource for every scope of the client, as the
SDK's `*MutationOptions` do. `useInvalidateResource(name)` (publish, restore,
bulk) invalidates every cached query of the resource on this client, across
versions and scopes. The resource handle is cached outside the SDK keys, under
`["crud-views", "handle", client, scope, name, apiVersion]`. Views gate every
optional feature on `capabilities`; the manifest is already filtered to what
the caller may read, and the server enforces writes.

`ResourceGate` is `useResource` with the shared pending (spinner) and error
(alert) states: `children(ready)` renders once ready.

## 3. Field model

`describeFields(resource)` (also `ready.fields`) returns one `FieldDescriptor`
per property of the read schema plus manifest fields the schema omits:

```ts
type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "array"
  | "json";
interface FieldDescriptor {
  name;
  label; // label: "power_level" -> "Power level"
  kind: FieldKind; // manifest value_type when the field is listed, else the schema type/format
  format: string | null; // JSON Schema format: email, uri, uuid, date, date-time, ...
  nullable: boolean; // the schema allows null
  readOnly: boolean; // neither create nor update accepts it
  required: boolean; // create requires it
  choices: string[] | null;
  itemKind: FieldKind | null; // enum / array items
  constraints: { minLength; maxLength; minimum; maximum; pattern }; // each number|string|undefined
  inManifest: boolean; // listed in resource.fields
  sortable: boolean;
  filterOps: FilterOp[];
  numeric: boolean;
  categorical: boolean;
}
```

`array` and `json` cover schema members the manifest `fields` list cannot
describe (the list holds scalars only); they have no filter operators.

## 4. Renderers

Three roles, each a React component, wire values in and out:

| Role    | Component type    | Props (besides `field`, `resource`, `size?`)                                                     |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| display | `DisplayRenderer` | `value: FieldValue`, `record?`                                                                   |
| input   | `InputRenderer`   | `value`, `onChange(value)`, `onBlur?`, `error?`, `helperText?`, `disabled?`, `autoFocus?`, `id?` |
| filter  | `FilterRenderer`  | `value: FieldFilter \| undefined`, `onChange(value \| undefined)`                                |

- **Values** are JSON wire values (`FieldValue`): strings for `string`,
  `enum`, `date` (`YYYY-MM-DD`) and `datetime` (ISO-8601 UTC); numbers;
  booleans; arrays; objects. A cleared input emits `null` when the field is
  `nullable`, else `undefined` (leave the member out of the request).
  `emptyValue(field)` gives that value. `datetime` inputs are read as UTC. A `datetime` value without a zone designator (the server stores naive UTC) is read as UTC, and a trailing RFC 9557 `[UTC]` suffix is ignored.
- **Filters** are per-field `FieldFilter`: operator -> operand
  (`{ min: 3, max: 9 }`, `{ icontains: "ada" }`, `{ in: ["a", "b"] }`).
  `datetime` operands are `Date`s and `date` operands `YYYY-MM-DD` strings,
  because that is what the SDK's query builder accepts. A whole resource's
  state is `FieldFilters` (field name -> `FieldFilter`);
  `toQueryFilters(filters)` turns it into the SDK's flat `Filters`
  (`eq` -> bare name, others -> `field__op`). `isFilterable(field)` says
  whether to show a filter at all (it has operators and is not `id`);
  `withOp(current, op, operand)` edits one operator.
- Renderers must not assume a theme, and must style only through MUI theme
  tokens (`sx`, `theme.vars`); no raw colors or `px` (the design-token lint
  enforces it in `src/`).
- A renderer that cannot apply (no usable operator) returns `null`.

Views never import a renderer directly. They render the three components,
which resolve the renderer for the field:

```tsx
<FieldDisplay field={f} resource="heroes" value={row[f.name]} record={row} />
<FieldInput   field={f} resource="heroes" value={v} onChange={set} error={msg} />
<FieldFilterInput field={f} resource="heroes" value={flt} onChange={setFlt} />
```

Each also takes `renderers?: RendererOverrides`, the highest-precedence layer
for that one element.

## 5. Registration and precedence

A **selector** names what an override applies to, most to least specific:

1. `"<resource>.<field>"`, e.g. `"heroes.power_level"`;
2. `"<kind>:<format>"`, e.g. `"string:email"` (only fields with a format);
3. `"<kind>"`, e.g. `"date"`.

`RendererOverrides` is `Record<selector, { display?, input?, filter? }>`; the
roles resolve independently.

**Layers**, nearest first: (1) the `renderers` prop of the field component;
(2) `CrudProvider`'s `renderers`; (3) process-wide registrations made with
`registerFieldRenderer(selector, renderers)` (returns an undo function; a later
registration wins per role; prefer the provider in apps); (4) the built-ins
(`builtinRenderers`: one entry per `FieldKind`, all three roles).

**Resolution:** for a role, walk the layers in order; inside a layer try the
selectors in order; the first renderer found wins. The nearest layer always
beats a farther one, even for a less specific selector. The built-ins cover
every kind, so resolution always succeeds. `resolveRenderer(role, field,
resource, layers)` and `selectorsFor(field, resource)` expose the algorithm
for tests and custom field components.

## 6. Consuming it: what VW1-VW4 may and may not do

- Build views from `useResource`/`ResourceGate`, `ready.fields`, `ready.hooks`
  and `Field*` components; wrap them in `PageShell`, `DialogShell` or
  `DrawerShell` (`{ title, actions?, children }`; dialog and drawer add `open`,
  `onClose`, `closeLabel?`).
- Accept a `renderers?: RendererOverrides` prop and pass it to every `Field*`
  component they render, so one override reaches a whole view.
- Show optional features only when `capabilities` says so.
- Do not read `schemas` directly to decide how a value looks or edits: that is
  what `FieldDescriptor` is for. Do not add a new `FieldKind` or renderer role
  without a new ADR; ask the orchestrator.
- Append the view area's `export * from "./<area>/index.ts"` line to
  `src/index.ts` (the only shared file), and add stories and tests in the
  area's own directory.

## 7. Addendum (2026-10-22): `onInvalid`

Additive, so compatible with the freeze (ADR
[0002](../adrs/0002-core-design-and-field-renderers.md), addendum). The input
role gains one optional prop:

```ts
onInvalid?: (reason: string | null) => void;
```

A built-in input calls it with a message while its own draft is invalid
(a number the browser cannot parse, a number outside `minimum`/`maximum` or
not whole for an `integer` field, malformed JSON, non-numeric array items)
and with `null` once it is valid again or unmounts. A form blocks submit while
any field reports a reason. Custom input renderers may ignore the prop; the
form still validates the values it holds.

`describeFields` resolves local `$ref`s through chains (`A` -> `B` -> schema),
cycles (left unresolved), JSON-pointer escapes (`~1` for `/`, `~0` for `~`) and
percent-encoded names (Pydantic's `Page[Hero]` as `Page%5BHero%5D`).

## 8. Addendum (2026-10-25): URL state prefix

`useQueryState` and `ResourceList` keep a list's filter, sort and paging state
in the query string. Its parameters now carry the prefix `l_` by default:
`l_page`, `l_sort`, `l_q`, `l_qf`, `l_size`, `l_archived`, `l_drafts`, `l_f`
and `l_f.<field>.<op>`. Before, the default prefix was empty, so a list read
and deleted the host app's own `page`, `sort`, `q` and `size`. This is a
breaking change to the default (the API shape is unchanged). Pass
`prefix: ""` (or `prefix=""` on `ResourceList`) for the old, unprefixed names;
an explicit `prefix` is unaffected. Give each list on one page its own prefix.
