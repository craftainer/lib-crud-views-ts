# lib-crud-views-ts

> [!NOTE]
> This repository is vibe coded with [Claude](https://claude.com/product/claude-code).

`@craftainer/crud-views`: manifest-driven CRUD views for React on MUI. One
component renders any resource a craftainer CRUD server describes in its
manifest, using [`@craftainer/crud-sdk`](https://github.com/craftainer/lib-crud-sdk-ts)
for data and TanStack Query for caching. This version ships the **core**:

- `CrudProvider` (SDK client, `QueryClient`, optional MUI theme, renderers);
- `useResource(name, apiVersion?)`: manifest entry, capabilities, described
  fields, SDK handle and TanStack hooks, and `ResourceGate` for its loading and
  error states;
- the field-renderer registry (contract
  [I4](docs/contracts/I4-field-renderers.md)): display, input and filter
  renderers per field kind and format, overridable per field, per provider or
  process-wide;
- layout shells: `PageShell`, `DialogShell`, `DrawerShell`.

The views build on it, one directory per area under `src/`: list (table,
cards, load-more), filter (bar, builder, facets, URL query state), form
(create and edit, validation, auto-save, conflicts), delete (four delete
variants), detail (record page, field list), revisions (history and diff),
bulk (selection, publish, delete, export), lifecycle (drafts, archive, trash,
status filter) and stats (stats dashboard and predictions). The package is theme-agnostic (it reads only the MUI
theme it is given) and uses only the MIT tier of MUI X. It is an instance of
[`template-npm-package`](https://github.com/craftainer/template-npm-package);
the conventions shared with every instance are in
[`docs/TEMPLATE.md`](docs/TEMPLATE.md), the design in
[`docs/adrs/0002-core-design-and-field-renderers.md`](docs/adrs/0002-core-design-and-field-renderers.md).

## Install

Every library is a peer dependency:

```sh
pnpm add @craftainer/crud-views @craftainer/crud-sdk @tanstack/react-query \
  @mui/material @mui/x-data-grid @mui/x-charts @emotion/react @emotion/styled react react-dom
```

```tsx
import { createClient } from "@craftainer/crud-sdk";
import { CrudProvider, ResourceGate, PageShell } from "@craftainer/crud-views";

const client = createClient({ baseUrl: "https://api.example.com" });

<CrudProvider client={client} queryClient={queryClient} theme={theme}>
  <PageShell title="Heroes">
    <ResourceGate name="heroes">{(heroes) => /* a view */ null}</ResourceGate>
  </PageShell>
</CrudProvider>;
```

### Query keys

Every query is keyed `["crud", client, resource, scope, kind, ...]` (the
manifest: `["crud", client, "_manifest", scope]`), as in `@craftainer/crud-sdk`
0.4 to 0.6: `client` is `CrudClient.id` (default: its `baseUrl`) and `scope` the
caller, from `client.namespace()` (`"anon"` or a hash of the bearer token).
Two clients or callers on one `QueryClient` never share an entry. Give two
clients that share a `baseUrl` distinct `id`s, and remount `CrudProvider` (a
`key` of the token) when the caller changes. `scope` on `CrudProvider` names
the caller yourself instead. `useResource` stays pending until the namespace is
known. The key parts for your own SDK calls are on the ready resource:
`namespace` and `queryName`. `TrashList` has no SDK key builder, so it uses
`["crud", client, resource, scope, "trash"]` under the same prefix: invalidating
the resource refreshes it. It needs `@craftainer/crud-sdk` 0.3 or later
(`onlyArchived`).

### Supported `@craftainer/crud-sdk` versions

`^0.4.0 || ^0.5.0 || ^0.6.0`. Bulk delete of "all matching" honours drafts only from 0.6 (see "Bulk actions"). From 0.5 the SDK refuses to send an `Authorization` header
over plain `http` to a non-loopback host (`InsecureTransportError`): use
`https`, or pass `allowInsecureHttp: true` to `createClient` (0.5 only).

### Inline edit and ETags

The list endpoint returns no ETags, so the table's inline edit takes
`ifMatch(row)` from the app. It may return a string, `undefined` (the PATCH
goes without `If-Match`) or a promise of either, the same shape as
`ResourceForm`'s `etag`. `fetchEtagById` stands for the app's own lookup, for
example fetching the row through the SDK and reading its cached ETag:

```tsx
<ResourceList
  resource="heroes"
  editable
  ifMatch={async (row) =>
    (await fetchEtagById(row["id"] as number)) ?? undefined
  }
/>
```

The edit waits for the promise and stays in a saving state (the cell stays
in edit mode and the table is `aria-busy`); a rejection sends nothing and shows "Could not save: ..." like
any other save error.

While the table shows the previous page (the next one is still loading), its
cells are read-only; editing works again once the new rows arrive.

### URL state

A list keeps its filter, sort and paging state in the query string, through
`useQueryState` (which `ResourceList` uses). The parameters carry a prefix,
`l_` by default: `l_page`, `l_sort`, `l_qf`, `l_size`, `l_archived`,
`l_drafts`, `l_f` and `l_f.<field>.<op>`. The host app's own `page`, `sort`,
`q` and `size` are neither read nor deleted. Give each list on one page its own
`prefix`. The quick search is not a separate parameter: its text is the
`icontains` filter of the searched field (`l_f.<field>.icontains`), so the
filter bar and builder show it, and editing it there changes the search box.
There is one slot per field: switching "Search in" keeps the old field's
filter and shows the new field's own text. A link with an old `l_q` is read as
that filter. Links made before the `l_` default (for example `?page=3&q=ada`)
no longer set the list's state: the list starts at its defaults. To keep the unprefixed names (`page`, `sort`, `q`, `size`, ...) that
versions before the `l_` default used, opt out with `prefix=""`:

```tsx
<ResourceList resource="heroes" prefix="" />
```

### Key field

A record's id is read from the manifest's `resource.id_field`, so a resource
whose key is not called `id` works. The key is a filterable field in the
manifest, but it is not something a person filters by: `FilterBar`,
`FilterBuilder` and the URL decoder leave it out.

### Bulk actions

Bulk publish runs one request per draft, in order. If one fails, the toolbar
reports "Published N of M; failed at <id>: <reason>" and unticks the published
records on the current page, so a retry covers only the rest (under "all
matching" the drafts are refetched, so the published ones drop out by
themselves). The failure is a `PartialPublishError` (exported; `published`,
`total`, `failedId`, and the original error as `cause`). A bulk call that matches more records than the
manifest's `bulk.max_matched` is refused by the server with `400`; the toolbar
says to narrow the filter.

Bulk delete of "all matching" sends `include_unpublished` (crud-sdk 0.6, a
server with lib-crud-py 0.8): `false` when the panel hides drafts (the resource
has no `draft_publish`), `true` when it lists them, so it deletes exactly the
rows the list shows. Ticked ids are deleted by id. With an older SDK the flag
is not sent and the server deletes drafts too.

### Revision restore and ETags

Restore is a `PATCH` by record id. When the client uses the SDK cache's
`autoIfMatch` middleware and the record's ETag is cached, `If-Match` is sent; a
stale ETag answers `412`, shown as an alert (the dialog closes), and nothing is
restored. Without a cached ETag no `If-Match` is sent.

### CSV export

`toCsv` (bulk export) guards against
[CSV injection](https://owasp.org/www-community/attacks/CSV_Injection): a
string cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return
gets a leading `'`, so a spreadsheet does not read it as a formula. The
prefix is part of the exported value: the text `-5` in a text column exports
as `'-5`. Numbers are not strings and are never prefixed, so the number `-5`
exports as `-5`.

## Development

Open the repository in the devcontainer, then run
`prek run --all-files --hook-stage manual`. `pnpm storybook` starts Storybook;
`tests/visual/run.sh` runs the visual suite (arm64 hosts only, see
[`tests/visual/README.md`](tests/visual/README.md)).

## License

Licensed under the [GNU General Public License v3.0 or later](LICENSE).
