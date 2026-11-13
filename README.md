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

`^0.4.0 || ^0.5.0 || ^0.6.0` (tested with 0.6.0). `etags` needs the SDK cache's `cachedEtag`. The SDK keeps validators of `no-store` (BFF) responses only from 0.8, which is outside this range for now: widening it to 0.8 and 0.9 is a follow-up (0.9.0 had not passed `minimumReleaseAge` when this was written), so a BFF app on 0.6 must pass `etag`/`ifMatch` callbacks instead. From 0.5 the SDK refuses to send an `Authorization` header
over plain `http` to a non-loopback host (`InsecureTransportError`): use
`https`, or pass `allowInsecureHttp: true` to `createClient` (0.5 only).

Bulk delete of "all matching" honours drafts only from 0.6 (see "Bulk actions").

### Optimistic concurrency (If-Match)

A resource whose manifest declares `conditional_requests` needs an ETag for
every write the views make (the form's save and Overwrite, the table's inline
edit, revision Restore). The views do not send such a write unconditionally:
when no ETag is known the save is refused with a `MissingEtagError` ("its ETag
is unknown") and nothing is sent. Resources without `conditional_requests` are
unaffected.

Pass the SDK cache as `etags` and the views read each record's last validator
from it; `@craftainer/crud-sdk` 0.8 or later keeps it for every record it read,
also for `no-store` (BFF) responses:

```tsx
import { createClient } from "@craftainer/crud-sdk";
import { createCache, cachePolicyFromManifest } from "@craftainer/crud-sdk/cache";

const cache = createCache({ store, policies });
const client = createClient({ baseUrl, middleware: [cache.middleware] });

<CrudProvider client={client} queryClient={queryClient} etags={cache}>
```

(`middleware` is the SDK 0.4 to 0.8 shape. From 0.9 the cache is passed as
`createClient({ cache })` and a cookie client needs a `cacheScope`; pass the
same cache object as `etags`.) `etags` is structural (`cachedEtag(resource,
id, scope, apiVersion)`), so no runtime import of the SDK cache is needed.

- Form: without an `etag(id)` callback the form reads the record right before
  each save and compares it, field by field, with what it loaded or last saved;
  any change (also to a field the form does not show) is a conflict and nothing
  is sent, else the PATCH carries the ETag of that read. This costs one extra
  `GET` per save. A per-form `etag(id)` callback replaces this (it is the app's
  responsibility to return the ETag of the record as the user saw it).
- Inline edit: the list endpoint returns no ETags, so the table reads the
  record right before the edit and refuses it ("changed elsewhere") when the
  edited field no longer has the value the row showed. `ifMatch(row)` (a
  string, a promise, or `undefined` for "unknown") replaces this; `undefined` is
  now refused, not sent.
- Revision Restore: replaces the record on purpose, so it reads the record and
  sends its current ETag; a write that lands between that read and the PATCH
  still answers `412`, shown as an alert.
- Overwrite after a `412` re-reads the record and sends its current ETag.
- Delete (`DeleteAction`, and the archive and draft delete buttons) reads the
  record and deletes it with its strong ETag as `If-Match`, resolved when the
  request is made (so an `undo` delete, also one committed on unmount, uses the
  ETag of that moment); with none known it fails with `MissingEtagError` and
  sends nothing. Like Restore, it deletes whatever the record is by then (a
  stale read is the cache caveat below).
- Weak validators (`W/"..."`) are treated as unknown everywhere: `If-Match` uses
  strong comparison, so a weak one could never match.
- Not covered: `publish`, trash restore, `clone` and bulk calls go through SDK
  methods without an `If-Match` option, so they are not conditional. The
  server's own checks apply to them.
- The "read" goes through the SDK cache: with a cache policy whose `max_age` or
  `stale_while_revalidate` is above 0 it can be answered from the cache without
  the network (the body and the validator are then the cached pair, so a changed
  record answers `412`), and a stale-while-revalidate refresh landing between the
  read and the PATCH can pair the old body with the new validator. For
  conditional resources use a policy with both at 0, or a BFF (`no-store`).
- The SDK cache keeps only the newest validator per record, so a read of the
  same record by another view in the instant between the view's read and its
  PATCH can replace it; the server's atomic `If-Match` check is the last line.

The inline edit waits for the lookup and stays in a saving state (the cell
stays in edit mode and the table is `aria-busy`); a rejection sends nothing and
shows "Could not save: ..." like any other save error.

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

Bulk delete of "all matching" first counts the matching records (reading at
most `bulk.max_matched + 1` rows with the filters as the dialog opened them) and
the confirmation says "N records match the filter and are deleted"; the Delete
button stays disabled while counting, when the count cannot be read, or when
the filter matches more than `bulk.max_matched`. The delete then uses those
same filters. It sends `include_unpublished` (crud-sdk 0.6, a
server with lib-crud-py 0.8): `false` when the panel hides drafts (the resource
has no `draft_publish`), `true` when it lists them, so it deletes exactly the
rows the list shows. Ticked ids are deleted by id. With an older SDK the flag
is not sent and the server deletes drafts too.

### Revision restore and ETags

Restore is a `PATCH` by record id with the record's ETag (see "Optimistic
concurrency"). A stale ETag answers `412`, shown as an alert (the dialog
closes), and nothing is restored.

### Links and flags in the URL

`l_archived=1` and `l_drafts=1` are honoured only when the resource declares
`archive_restore` / `draft_publish` for the caller; otherwise they are
ignored. Filter operators in a link are limited to those the manifest lists for
the field.

### `mailto:` and `uri` values

A field with `format: "email"` becomes a `mailto:` link only when the value is
one plain address (no `?`, `&`, `#`, `%`, `,`, `;`, whitespace, quotes or
brackets, so it cannot add a `bcc` or `body`); any other value is plain text.
`format: "uri"` links only `http` and `https` values.

### CSV export

`toCsv` (bulk export) guards against
[CSV injection](https://owasp.org/www-community/attacks/CSV_Injection): a
string cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return
gets a leading `'`, so a spreadsheet does not read it as a formula. The
prefix is part of the exported value: the text `-5` in a text column exports
as `'-5`. Numbers are not strings and are never prefixed, so the number `-5`
exports as `-5`.

## Security notes

- **Capabilities are not authorization.** `capabilities` (and `readOnly`) only
  hide controls. Every mutation is sent to the server whatever the UI shows, so
  the crud server must enforce authorization and owner scope; never rely on a
  hidden button.
- **Host `display` overrides.** Built-in renderers show every value as text.
  A renderer you register or pass in `renderers` replaces them and is the one
  place a record value can reach `dangerouslySetInnerHTML` or an `href`/`src`.
  Sanitize there, allow only `https:`/`mailto:` schemes for links, and never
  render a value as HTML.
- **Emotion nonce.** MUI and Emotion inject `<style>` elements. Under a CSP
  with `style-src-elem 'nonce-...'` (the BFF's), give Emotion a cache with the
  nonce (`createCache({ key: "css", nonce })` from `@emotion/cache`, wrapped in
  `CacheProvider`) or the page renders unstyled. This library ships no inline
  script, no `eval` and no `<style>` of its own and never exports charts; if you
  add MUI X chart image/print export, it needs its own `nonce` option and
  `data:`/`blob:` in the CSP.
- **Scope and logout cache clearing.** Queries (manifest, lists, records) are
  cached per `{client, scope}`; the default scope is `client.namespace()`,
  which is `"anon"` for a cookie/BFF session with no bearer token, so a second
  user signed in without a full page load would be served the first user's
  cache. For cookie auth set `scope` on `CrudProvider` to the user (for
  example the `sub`) and, on logout or any user change, call
  `queryClient.clear()`, the SDK `cache.clear()` and tear down event streams
  (or navigate away with a full page load). A role change inside a session is
  not seen until the manifest is refetched.
- **Server error text.** `error.message` and Problem Details `title`/`detail`
  from the server are shown as text; keep stack traces and internals out of
  them on the server.
- **`undo` delete commits on unmount.** In the `undo` variant a pending delete
  is committed when the component unmounts (leaving the page, or a row remount
  from a refetch that changes keys) inside `undoMs`, because dropping a delete
  the user was told about would be worse. A host that remounts rows must keep
  the row mounted (a stable `key`) or use the `confirm` variant.
- **Other defaults.** Export and Publish read unpublished rows
  (`includeUnpublished`); the server decides what the caller may see.
  `pattern` from the manifest is compiled and run on every keystroke, so the
  manifest is trusted input.

## Migrating to 0.7 (breaking)

- Conditional resources need an ETag for every write. Add
  `etags={cache}` to `CrudProvider` (SDK 0.8+ cache) or pass `etag` /
  `ifMatch`. Without one the views refuse the save with `MissingEtagError`
  instead of sending it unconditionally; an `ifMatch` that returns `undefined`
  is refused too. If you relied on `autoIfMatch` for Restore, add `etags`.
- Overwrite after a `412` now sends the re-read ETag (no longer no header).
- The form and inline edit read the record before each save (one extra `GET`).
- `QueryContext` (exported from the filter area, used by `decodeState`) has
  two new required members, `archiveRestore` and `draftPublish`.
- `l_archived` / `l_drafts` links no longer take effect without the matching
  capability.
- A single delete on a conditional resource needs an ETag too (see above); a
  weak `W/` ETag counts as unknown.
- Delete-all-matching needs a readable count within `bulk.max_matched` before
  Delete is enabled.
- `format: "email"` values that are not a single plain address render as text.
- New exports: `MissingEtagError`, `StaleRecordError`, `useEtagResolver`,
  `EtagStore`, `EtagSource`, `EtagResolver`.
- Decision record:
  [`docs/adrs/0003-required-if-match-for-conditional-resources.md`](docs/adrs/0003-required-if-match-for-conditional-resources.md).

## Development

Open the repository in the devcontainer, then run
`prek run --all-files --hook-stage manual`. `pnpm storybook` starts Storybook;
`tests/visual/run.sh` runs the visual suite (arm64 hosts only, see
[`tests/visual/README.md`](tests/visual/README.md)).

## License

Licensed under the [GNU General Public License v3.0 or later](LICENSE).
