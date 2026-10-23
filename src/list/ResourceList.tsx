import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import type { ReactElement } from "react";
import {
  ResourceGate,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import {
  FacetSidebar,
  FilterBar,
  FilterBuilder,
  QuickSearch,
  useQueryState,
  type QueryDefaults,
  type UrlAdapter,
} from "../filter/index.ts";
import { CardGridList } from "./CardGridList.tsx";
import type { ColumnSpec } from "./columns.ts";
import { DataTableList, type GridOptions } from "./DataTableList.tsx";
import { LoadMoreList } from "./LoadMoreList.tsx";
import type { Row } from "./RecordCard.tsx";
import { SortDropdown } from "./SortDropdown.tsx";

/** `table`: paged data table; `loadMore`: growing list; `cards`: paged card grid. */
export type ListVariant = "table" | "loadMore" | "cards";
/** `quick`: search box; `bar`: a control per field; `builder`: field/operator/operand rows; `facets`: checkboxes for categorical fields. */
export type FilterVariant = "quick" | "bar" | "builder" | "facets";

export interface ResourceListProps {
  readonly resource: string;
  readonly apiVersion?: string | undefined;
  readonly variant?: ListVariant | undefined;
  /** Which filter UIs to show, in addition to default filter values. Default `["quick"]`. */
  readonly filters?: readonly FilterVariant[] | undefined;
  /** Fields of the filter bar, in order. Default: all filterable fields. */
  readonly barFields?: readonly string[] | undefined;
  /** Fields of the facet sidebar. Default: all categorical fields. */
  readonly facetFields?: readonly string[] | undefined;
  readonly columns?: readonly ColumnSpec[] | undefined;
  readonly titleField?: string | undefined;
  /** Table only: edit cells in place. */
  readonly editable?: boolean | undefined;
  readonly ifMatch?: ((row: Row) => string | undefined) | undefined;
  readonly sortableOnly?: boolean | undefined;
  /** Show the sort dropdown. Default: for the card variants, which have no header to click. */
  readonly sortDropdown?: boolean | undefined;
  /** Where the state lives. Default: the window's query string. */
  readonly urlAdapter?: UrlAdapter | undefined;
  /** Prefix of this list's URL parameters. */
  readonly prefix?: string | undefined;
  readonly defaults?: QueryDefaults | undefined;
  readonly searchField?: string | undefined;
  readonly renderers?: RendererOverrides | undefined;
  readonly onRowClick?: ((row: Row) => void) | undefined;
  readonly gridProps?: GridOptions | undefined;
}

type BodyProps = Omit<ResourceListProps, "resource" | "apiVersion"> & {
  readonly ready: ReadyResource;
};

function ResourceListBody({
  ready,
  variant = "table",
  filters = ["quick"],
  barFields,
  facetFields,
  columns,
  titleField,
  editable,
  ifMatch,
  sortableOnly,
  sortDropdown = variant !== "table",
  urlAdapter,
  prefix,
  defaults,
  searchField,
  renderers,
  onRowClick,
  gridProps,
}: BodyProps): ReactElement {
  const state = useQueryState(ready, {
    adapter: urlAdapter,
    prefix,
    defaults,
    searchField,
  });
  const { capabilities } = ready;
  const has = (f: (typeof filters)[number]): boolean => filters.includes(f);
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        useFlexGap
        sx={{ flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}
      >
        {has("quick") && (
          <QuickSearch
            fields={state.searchFields}
            value={state.state.q}
            field={state.state.qField}
            onChange={state.setQuickSearch}
            onFieldChange={state.setQuickSearchField}
          />
        )}
        {sortDropdown && (
          <SortDropdown
            ready={ready}
            sort={state.state.sort}
            onChange={state.setSort}
          />
        )}
        {capabilities.archive_restore && (
          <FormControlLabel
            label="Include archived"
            control={
              <Switch
                checked={state.state.includeArchived}
                onChange={(e) => state.setIncludeArchived(e.target.checked)}
              />
            }
          />
        )}
        {capabilities.draft_publish && (
          <FormControlLabel
            label="Include drafts"
            control={
              <Switch
                checked={state.state.includeUnpublished}
                onChange={(e) => state.setIncludeUnpublished(e.target.checked)}
              />
            }
          />
        )}
      </Stack>
      {has("bar") && (
        <FilterBar
          ready={ready}
          filters={state.state.filters}
          onChange={state.setFilters}
          fields={barFields}
          renderers={renderers}
        />
      )}
      {has("builder") && (
        <FilterBuilder
          ready={ready}
          filters={state.state.filters}
          onChange={state.setFilters}
          renderers={renderers}
        />
      )}
      <Stack
        direction="row"
        useFlexGap
        sx={{ gap: 3, alignItems: "flex-start" }}
      >
        {has("facets") && (
          <Box sx={{ flex: "none", minWidth: "12rem" }}>
            <FacetSidebar
              ready={ready}
              filters={state.state.filters}
              onChange={state.setFilters}
              fields={facetFields}
            />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {variant === "table" ? (
            <DataTableList
              ready={ready}
              state={state}
              columns={columns}
              editable={editable}
              ifMatch={ifMatch}
              sortableOnly={sortableOnly}
              onRowClick={onRowClick}
              renderers={renderers}
              gridProps={gridProps}
            />
          ) : variant === "loadMore" ? (
            <LoadMoreList
              ready={ready}
              state={state}
              columns={columns}
              titleField={titleField}
              onRowClick={onRowClick}
              renderers={renderers}
            />
          ) : (
            <CardGridList
              ready={ready}
              state={state}
              columns={columns}
              titleField={titleField}
              onRowClick={onRowClick}
              renderers={renderers}
            />
          )}
        </Box>
      </Stack>
    </Stack>
  );
}

/** A resource's list, ready to use: filters, sort and paging in the URL, one of three layouts. */
export function ResourceList({
  resource,
  apiVersion,
  ...props
}: ResourceListProps): ReactElement {
  return (
    <ResourceGate name={resource} apiVersion={apiVersion}>
      {(ready) => <ResourceListBody ready={ready} {...props} />}
    </ResourceGate>
  );
}
