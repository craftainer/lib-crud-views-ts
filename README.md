# lib-crud-views-ts

> [!NOTE]
> This repository is vibe coded with [Claude](https://claude.com/product/claude-code).

<<<<<<< /home/runner/work/lib-crud-views-ts/lib-crud-views-ts/README.md
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

`^0.4.0 || ^0.5.0 || ^0.6.0`. From 0.5 the SDK refuses to send an `Authorization` header
over plain `http` to a non-loopback host (`InsecureTransportError`): use
`https`, or pass `allowInsecureHttp: true` to `createClient` (0.5 only).

Bulk delete of "all matching" honours drafts only from 0.6 (see "Bulk actions").

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
=======
A template for a typed, tested and publishable ESM TypeScript npm package:
pnpm (via Corepack), a `tsdown` build with generated declarations, strict
`tsc`, `vitest` with a 100% coverage gate, `oxlint`, `prettier`, `publint`
and `arethetypeswrong`, and a release that publishes to npm through trusted
publishing with provenance. It is itself an instance of
[`template-base`](https://github.com/craftainer/template-base) (so it gets
the devcontainer, CI, release workflow and template sync from there) and is
itself a template: a package created from it receives fixes through template
sync. See [`docs/TEMPLATE.md`](docs/TEMPLATE.md) for the conventions shared
by every instance, and
[`docs/adrs/0001-npm-package-template.md`](docs/adrs/0001-npm-package-template.md)
for why it exists.

## Creating a package from this template

1. On GitHub, use "Use this template" on this repository (or
   `gh repo create <org>/<name> --template craftainer/template-npm-package`).
2. Rename the package: `package.json`'s `name` to `@craftainer/<name>`, its
   description, and this file's title and description. Edit `src/`,
   `tests/`, and the `exports` map together with `tsdown.config.ts`'s
   `entry`. Point `repository.url` (`git+https://github.com/<owner>/<repo>.git`),
   `homepage` and `bugs.url` at the new repository: `package.json` is
   instance-owned, and `make publish-packages` refuses a mismatch (npm rejects
   provenance otherwise). Then run `pnpm install` to refresh `pnpm-lock.yaml`.
3. Point template sync at this template. `.github/template-sync-state.json`
   here records the `template-base` tag this template itself last synced
   from; the copy in a new package must instead name this repository and
   the tag it was created at (the latest release of
   `craftainer/template-npm-package`):

   ```json
   {
     "template_repo": "craftainer/template-npm-package",
     "synced_tag": "vX.Y.Z"
   }
   ```

   Add a `TEMPLATE_SYNC_TOKEN` secret too (see `.github/workflows/README.md`,
   "Template sync"). Files the package owns beyond the manifest's `ignore`
   tier go in `.github/template-sync-manifest.local.yml` under `ignore:`.

4. Open the repository in the devcontainer, then run
   `prek run --all-files --hook-stage manual`; everything should pass before
   you write any code.
5. Keep `LICENSE` (GPL-3.0) or replace it with the license you choose.

## Publishing to npm

`make publish-packages` is a no-op (with a `::warning::` in the log) until you opt
in by setting the repository variable `NPM_PUBLISH` (any non-empty value). npm has no pending publishers,
so the first release is bootstrapped with a token and every later one uses
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub
OIDC, with provenance), with no token stored:

1. Create the `NPM_TOKEN` secret: a granular token for the `@craftainer`
   scope with "Read and write (stage only)". Set `NPM_PUBLISH`.
2. Run the first release. `make publish-packages` runs `npm stage publish`, which
   stages the tarball without 2FA. Approve it with 2FA: `npm stage list`,
   then `npm stage approve <stage-id>` (or on npmjs.com). Until then the
   version is not installable, and `make verify-published` (the release
   workflow's last job, after the GitHub release exists) fails saying so;
   re-run that job after approving.
3. On npmjs.com, add the package's trusted publisher: this repository,
   workflow `release.yml`, environment `release`. The environment field is
   the binding control: it limits OIDC publishing to jobs that declare
   `environment: release`, which template-base's `release.yml` does for its
   privileged jobs (with a deployment-branch rule allowing only the default
   branch). Then take the repository out of the `NPM_TOKEN` secret's reach.
   A present `NPM_TOKEN` is preferred over OIDC (`release-publish.sh` stages
   with it and never tries OIDC), so the token must not reach the repository
   for trusted publishing to engage. If `NPM_TOKEN` is an organization
   secret, you cannot delete it from here: change its repository access
   (organization Settings > Secrets and variables > Actions) to exclude this
   repository, or delete a repository-level copy. Later releases publish
   directly through OIDC; npm expires a trusted-publisher configuration that
   has not published within 48 hours, so do this just before the next
   release.

The version lives only in the git tag `release.yml` computes;
`package.json` stays at `0.0.0` and `make build` stamps `RELEASE_VERSION`
into the build without committing it. Details: `docs/TEMPLATE.md`, "Package
template notes".
>>>>>>> /tmp/template-new/README.md

## License

Licensed under the [GNU General Public License v3.0 or later](LICENSE).
