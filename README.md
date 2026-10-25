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

### URL state

A list keeps its filter, sort and paging state in the query string, through
`useQueryState` (which `ResourceList` uses). The parameters carry a prefix,
`l_` by default: `l_page`, `l_sort`, `l_q`, `l_qf`, `l_size`, `l_archived`,
`l_drafts`, `l_f` and `l_f.<field>.<op>`. The host app's own `page`, `sort`,
`q` and `size` are neither read nor deleted. Give each list on one page its own
`prefix`. Links made before the `l_` default (for example `?page=3&q=ada`)
no longer set the list's state: the list starts at its defaults. To keep the unprefixed names (`page`, `sort`, `q`, `size`, ...) that
versions before the `l_` default used, opt out with `prefix=""`:

```tsx
<ResourceList resource="heroes" prefix="" />
```

## Development

Open the repository in the devcontainer, then run
`prek run --all-files --hook-stage manual`. `pnpm storybook` starts Storybook;
`tests/visual/run.sh` runs the visual suite (arm64 hosts only, see
[`tests/visual/README.md`](tests/visual/README.md)).

## License

Licensed under the [GNU General Public License v3.0 or later](LICENSE).
