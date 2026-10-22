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

The list, filter, form, detail, revision, bulk and stats views build on it and
land in later releases. The package is theme-agnostic (it reads only the MUI
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

## Development

Open the repository in the devcontainer, then run
`prek run --all-files --hook-stage manual`. `pnpm storybook` starts Storybook;
`tests/visual/run.sh` runs the visual suite (arm64 hosts only, see
[`tests/visual/README.md`](tests/visual/README.md)).

## License

Licensed under the [GNU General Public License v3.0 or later](LICENSE).
