// The state of a list (filters, quick search, sort, page) and its codecs: the
// URL query string (the page's own address, not an API URL) and the SDK's
// query object. API URLs are never built here: `toQueryFilters` and the SDK's
// query builder do that.
import type { CrudQuery } from "@craftainer/crud-sdk/tanstack";
import {
  isFilterable,
  toQueryFilters,
  withOp,
  type FieldDescriptor,
  type FieldFilter,
  type FieldFilters,
  type FilterOp,
  type FilterScalar,
} from "../core/index.ts";

/** One sort key: a sortable field and its direction. */
export interface SortKey {
  readonly field: string;
  readonly desc: boolean;
}

/** Everything a list view reads: filters, quick search, sort, paging and the visibility toggles. */
export interface QueryState {
  readonly filters: FieldFilters;
  /** Quick-search text (`icontains` on `qField`); empty means off. */
  readonly q: string;
  readonly qField: string | undefined;
  readonly sort: readonly SortKey[];
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly includeArchived: boolean;
  readonly includeUnpublished: boolean;
}

/** Values the state falls back to while the URL says nothing. */
export interface QueryDefaults {
  /** Default filter values; the user clears them and the URL remembers that. */
  readonly filters?: FieldFilters | undefined;
  readonly sort?: readonly SortKey[] | undefined;
  readonly pageSize?: number | undefined;
}

/** What the codecs need to know about the resource. */
export interface QueryContext {
  readonly fields: readonly FieldDescriptor[];
  /** The resource's key field (`id_field`): never filtered on, so a URL naming it is ignored. */
  readonly idField: string;
  readonly defaults: QueryDefaults;
  /** Prefix of every URL parameter, so several lists can share one page. */
  readonly prefix: string;
  /** Default quick-search field, from the `searchField` option or the first searchable one. */
  readonly searchField: string | undefined;
  /** The largest page size the server accepts, less one (the view asks for one extra row to learn whether a next page exists). */
  readonly maxPageSize: number;
}

export const DEFAULT_PAGE_SIZE = 25;

/** Fields the quick search can target: strings with `icontains`. */
export const searchableFields = (
  fields: readonly FieldDescriptor[],
): FieldDescriptor[] =>
  fields.filter(
    (f) => f.kind === "string" && f.filterOps.includes("icontains"),
  );

/** The sort a header click or dropdown can use. */
export const sortableFields = (
  fields: readonly FieldDescriptor[],
): FieldDescriptor[] => fields.filter((f) => f.sortable && f.inManifest);

/** The state with nothing in the URL. */
export function initialState(ctx: QueryContext): QueryState {
  return {
    filters: ctx.defaults.filters ?? {},
    q: "",
    qField: ctx.searchField,
    sort: ctx.defaults.sort ?? [],
    page: 1,
    pageSize: ctx.defaults.pageSize ?? DEFAULT_PAGE_SIZE,
    includeArchived: false,
    includeUnpublished: false,
  };
}

// ---- operands ---------------------------------------------------------

const NAIVE_DATETIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?$/;

function parseScalar(
  field: FieldDescriptor,
  text: string,
  keepEmpty = false,
): FilterScalar | undefined {
  switch (field.kind) {
    case "number":
    case "integer": {
      const n = Number(text);
      if (text.trim() === "" || !Number.isFinite(n)) return undefined;
      return field.kind === "integer" && !Number.isSafeInteger(n)
        ? undefined
        : n;
    }
    case "boolean":
      return text === "true" ? true : text === "false" ? false : undefined;
    case "datetime": {
      // A datetime filter is UTC: a bare local time is read as UTC.
      const d = new Date(NAIVE_DATETIME.test(text) ? `${text}Z` : text);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    default:
      return text === "" && !keepEmpty ? undefined : text;
  }
}

/** Splits on commas that are not escaped as `\,`; `\\` is a backslash. */
function splitList(text: string): string[] {
  const parts: string[] = [""];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const next = text.charAt(i + 1);
    if (ch === "\\" && (next === "," || next === "\\")) {
      parts[parts.length - 1] += next;
      i++;
    } else if (ch === ",") parts.push("");
    else parts[parts.length - 1] += ch;
  }
  return parts;
}

const escapeItem = (text: string): string =>
  text.replaceAll("\\", "\\\\").replaceAll(",", "\\,");

/**
 * `parseOperand` for one text, either typed (`exact` false: list items are
 * trimmed and empty ones dropped) or written by `formatOperand` (`exact`:
 * every item as it was, so a list round-trips).
 */
function readOperand(
  field: FieldDescriptor,
  op: FilterOp,
  text: string,
  exact: boolean,
): FilterScalar | readonly FilterScalar[] | undefined {
  if (op !== "in") return parseScalar(field, text);
  const items = splitList(text)
    .map((part) => parseScalar(field, exact ? part : part.trim(), exact))
    .filter((v): v is FilterScalar => v !== undefined);
  return items.length === 0 ? undefined : items;
}

/** Reads typed text as the operand of `op` on `field` (`in` takes a comma-separated list); `undefined` when it does not parse. */
export function parseOperand(
  field: FieldDescriptor,
  op: FilterOp,
  text: string,
): FilterScalar | readonly FilterScalar[] | undefined {
  return readOperand(field, op, text, false);
}

/** The text form of an operand: the inverse of `parseOperand`. */
export function formatOperand(
  operand: FilterScalar | readonly FilterScalar[],
): string {
  if (Array.isArray(operand))
    return (operand as readonly FilterScalar[])
      .map((item) => escapeItem(formatOperand(item)))
      .join(",");
  return operand instanceof Date ? operand.toISOString() : String(operand);
}

// ---- URL ---------------------------------------------------------------

const names = (prefix: string) => ({
  q: `${prefix}q`,
  qf: `${prefix}qf`,
  sort: `${prefix}sort`,
  page: `${prefix}page`,
  size: `${prefix}size`,
  archived: `${prefix}archived`,
  drafts: `${prefix}drafts`,
  f: `${prefix}f`,
});

const isOwned = (key: string, prefix: string): boolean =>
  key.startsWith(`${prefix}f.`) ||
  (Object.values(names(prefix)) as string[]).includes(key);

/** `f.<field>.<op>` -> text, sorted, for every operand that is set. */
function filterEntries(filters: FieldFilters): [string, string][] {
  const out: [string, string][] = [];
  for (const name of Object.keys(filters).sort()) {
    const byOp = filters[name] ?? {};
    for (const op of Object.keys(byOp).sort()) {
      const operand = byOp[op as FilterOp];
      if (
        operand === undefined ||
        (Array.isArray(operand) && operand.length === 0)
      )
        continue;
      out.push([`f.${name}.${op}`, formatOperand(operand)]);
    }
  }
  return out;
}

const sortText = (sort: readonly SortKey[]): string =>
  sort.map((k) => (k.desc ? `-${k.field}` : k.field)).join(",");

const sameEntries = (
  a: readonly (readonly [string, string])[],
  b: readonly (readonly [string, string])[],
): boolean =>
  a.length === b.length &&
  a.every(([k, v], i) => k === b[i]?.[0] && v === b[i]?.[1]);

/**
 * The query string for `state`, merged into `base` (other parameters of the
 * page survive). Values equal to the defaults are left out; a filter set that
 * differs from the defaults is written with an `f` marker, so clearing a
 * default filter sticks.
 */
export function encodeState(
  state: QueryState,
  ctx: QueryContext,
  base = "",
): string {
  const n = names(ctx.prefix);
  const params = new URLSearchParams(base);
  for (const key of new Set(params.keys()))
    if (isOwned(key, ctx.prefix)) params.delete(key);
  const base0 = initialState(ctx);
  const entries = filterEntries(state.filters);
  if (!sameEntries(entries, filterEntries(base0.filters))) {
    params.set(n.f, "");
    for (const [key, value] of entries)
      params.set(`${ctx.prefix}${key}`, value);
  }
  if (state.q !== "") params.set(n.q, state.q);
  if (state.qField !== undefined && state.qField !== base0.qField)
    params.set(n.qf, state.qField);
  if (sortText(state.sort) !== sortText(base0.sort))
    params.set(n.sort, sortText(state.sort));
  if (state.page > 1) params.set(n.page, String(state.page));
  if (state.pageSize !== base0.pageSize)
    params.set(n.size, String(state.pageSize));
  if (state.includeArchived) params.set(n.archived, "1");
  if (state.includeUnpublished) params.set(n.drafts, "1");
  return params.toString();
}

function positiveInt(text: string | null): number | undefined {
  const n = Number(text);
  return text !== null && Number.isInteger(n) && n >= 1 ? n : undefined;
}

/** The state a query string describes; anything invalid for the resource is ignored. */
export function decodeState(search: string, ctx: QueryContext): QueryState {
  const n = names(ctx.prefix);
  const params = new URLSearchParams(search);
  const base = initialState(ctx);

  let filters = base.filters;
  if (params.has(n.f)) {
    const next: Record<string, FieldFilter | undefined> = {};
    const lead = `${ctx.prefix}f.`;
    for (const [key, text] of params) {
      if (!key.startsWith(lead)) continue;
      const rest = key.slice(lead.length);
      const dot = rest.lastIndexOf(".");
      const field = ctx.fields.find((f) => f.name === rest.slice(0, dot));
      const op = rest.slice(dot + 1) as FilterOp;
      if (
        field === undefined ||
        !isFilterable(field) ||
        field.name === ctx.idField ||
        !field.filterOps.includes(op)
      )
        continue;
      const operand = readOperand(field, op, text, true);
      if (operand !== undefined)
        next[field.name] = withOp(next[field.name], op, operand);
    }
    filters = next;
  }

  let sort = base.sort;
  if (params.has(n.sort)) {
    const sortable = new Set(sortableFields(ctx.fields).map((f) => f.name));
    sort = (params.get(n.sort) as string)
      .split(",")
      .map((part) => ({
        field: part.replace(/^-/, ""),
        desc: part.startsWith("-"),
      }))
      .filter((k) => sortable.has(k.field));
  }

  const qField = params.get(n.qf);
  const searchable = searchableFields(ctx.fields).some(
    (f) => f.name === qField,
  );
  const size = positiveInt(params.get(n.size));
  return {
    filters,
    q: params.get(n.q) ?? "",
    qField: searchable ? (qField as string) : base.qField,
    sort,
    page: positiveInt(params.get(n.page)) ?? 1,
    pageSize: Math.min(size ?? base.pageSize, ctx.maxPageSize),
    includeArchived: params.get(n.archived) === "1",
    includeUnpublished: params.get(n.drafts) === "1",
  };
}

// ---- SDK query -----------------------------------------------------------

/** The filters including the quick search, as per-field state. */
export function effectiveFilters(state: QueryState): FieldFilters {
  if (state.q === "" || state.qField === undefined) return state.filters;
  return {
    ...state.filters,
    [state.qField]: withOp(state.filters[state.qField], "icontains", state.q),
  };
}

/**
 * The SDK query for `state`. `paged` adds `skip` and `limit` (one extra row,
 * to learn whether a next page exists); an infinite list pages itself.
 */
export function toCrudQuery(state: QueryState, paged: boolean): CrudQuery {
  const query: Record<string, unknown> = {
    filters: toQueryFilters(effectiveFilters(state)),
  };
  if (state.sort.length > 0) query["sort"] = sortText(state.sort).split(",");
  if (paged) {
    query["skip"] = (state.page - 1) * state.pageSize;
    query["limit"] = state.pageSize + 1;
  }
  if (state.includeArchived) query["includeArchived"] = true;
  if (state.includeUnpublished) query["includeUnpublished"] = true;
  return query;
}

/** Whether any filter or quick search narrows the list. */
export const isFiltered = (state: QueryState): boolean =>
  state.q !== "" || filterEntries(state.filters).length > 0;
