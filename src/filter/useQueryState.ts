import type { CrudQuery } from "@craftainer/crud-sdk/tanstack";
import { useMemo, useState, useSyncExternalStore } from "react";
import type {
  FieldDescriptor,
  FieldFilters,
  ReadyResource,
} from "../core/index.ts";
import {
  decodeState,
  encodeState,
  searchableFields,
  toCrudQuery,
  type QueryContext,
  type QueryDefaults,
  type QueryState,
  type SortKey,
} from "./queryState.ts";
import { defaultUrlAdapter, type UrlAdapter } from "./urlAdapter.ts";

const DEFAULT_PREFIX = "l_";

export interface QueryStateOptions {
  /** Where the state lives. Default: the window's query string. */
  readonly adapter?: UrlAdapter | undefined;
  /**
   * Prefix of this list's URL parameters; give each list on a page its own.
   * Default `l_` (`l_page`, `l_sort`, `l_q`, `l_size`, ...), so the list never
   * reads or deletes the host app's own `page`, `sort`, `q` or `size`. Pass
   * `""` for unprefixed names.
   */
  readonly prefix?: string | undefined;
  readonly defaults?: QueryDefaults | undefined;
  /** The field the quick search targets first. Default: the first string field with `icontains`. */
  readonly searchField?: string | undefined;
}

/** The URL-synced state of one list plus the setters and the SDK queries derived from it. */
export interface QueryStateApi {
  readonly state: QueryState;
  readonly fields: readonly FieldDescriptor[];
  /** Fields the quick search can target. */
  readonly searchFields: readonly FieldDescriptor[];
  /** The query of a paged view: `skip` and `limit` (page size + 1, to detect a next page). */
  readonly pagedQuery: CrudQuery;
  /** The query of an infinite view: filters and sort only. */
  readonly feedQuery: CrudQuery;
  /** Any change but the page itself returns to page 1. */
  setFilters(filters: FieldFilters): void;
  setQuickSearch(q: string): void;
  setQuickSearchField(field: string): void;
  setSort(sort: readonly SortKey[]): void;
  setPage(page: number): void;
  setPageSize(pageSize: number): void;
  setIncludeArchived(on: boolean): void;
  setIncludeUnpublished(on: boolean): void;
  /** Back to the defaults. */
  reset(): void;
}

/**
 * Filter, sort and paging state for `ready`, kept in the URL through the
 * adapter. Operands are validated against the manifest, so a stale or
 * hand-edited link degrades to the defaults instead of failing the request.
 */
export function useQueryState(
  ready: ReadyResource,
  options: QueryStateOptions = {},
): QueryStateApi {
  const { adapter = defaultUrlAdapter(), prefix = DEFAULT_PREFIX } = options;
  const fields = ready.fields;
  const searchFields = useMemo(() => searchableFields(fields), [fields]);
  const searchField = options.searchField ?? searchFields[0]?.name;
  // Callers pass `defaults` as a literal; hold the first value of each distinct content.
  const given = options.defaults ?? {};
  const givenKey = JSON.stringify([given.pageSize, given.sort, given.filters]);
  const [held, setHeld] = useState({ key: givenKey, value: given });
  if (held.key !== givenKey) setHeld({ key: givenKey, value: given });
  const defaults = held.value;
  const ctx = useMemo<QueryContext>(
    () => ({
      fields,
      defaults,
      prefix,
      searchField,
      maxPageSize: ready.resource.pagination.max_limit - 1,
    }),
    [
      fields,
      defaults,
      prefix,
      searchField,
      ready.resource.pagination.max_limit,
    ],
  );
  const search = useSyncExternalStore(
    adapter.subscribe,
    adapter.read,
    () => "",
  );
  const state = useMemo(() => decodeState(search, ctx), [search, ctx]);
  const pagedQuery = useMemo(() => toCrudQuery(state, true), [state]);
  const feedQuery = useMemo(() => toCrudQuery(state, false), [state]);

  return useMemo<QueryStateApi>(() => {
    // Setters read the URL at call time, so two changes in one tick both land.
    const change = (
      patch: (current: QueryState) => Partial<QueryState>,
      mode: "push" | "replace" = "push",
    ): void => {
      const current = decodeState(adapter.read(), ctx);
      adapter.write(
        encodeState({ ...current, ...patch(current) }, ctx, adapter.read()),
        mode,
      );
    };
    const first = { page: 1 };
    return {
      state,
      fields,
      searchFields,
      pagedQuery,
      feedQuery,
      setFilters: (filters) => change(() => ({ filters, ...first })),
      setQuickSearch: (q) => change(() => ({ q, ...first }), "replace"),
      setQuickSearchField: (qField) => change(() => ({ qField, ...first })),
      setSort: (sort) => change(() => ({ sort, ...first })),
      setPage: (page) => change(() => ({ page })),
      setPageSize: (pageSize) => change(() => ({ pageSize, ...first })),
      setIncludeArchived: (includeArchived) =>
        change(() => ({ includeArchived, ...first })),
      setIncludeUnpublished: (includeUnpublished) =>
        change(() => ({ includeUnpublished, ...first })),
      reset: () => change(() => decodeState("", ctx)),
    };
  }, [state, fields, searchFields, pagedQuery, feedQuery, adapter, ctx]);
}
