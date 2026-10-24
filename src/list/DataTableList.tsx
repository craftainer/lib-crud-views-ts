import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import {
  DataGrid,
  useGridApiContext,
  type DataGridProps,
  type GridColDef,
  type GridRenderCellParams,
  type GridRenderEditCellParams,
  type GridSortModel,
} from "@mui/x-data-grid";
import { PreconditionFailed } from "@craftainer/crud-sdk";
import { useMemo, useState, type ReactElement } from "react";
import {
  FieldDisplay,
  FieldInput,
  type FieldDescriptor,
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import type { QueryStateApi } from "../filter/index.ts";
import { LoadError } from "./LoadError.tsx";
import { ColumnsMenu } from "./ColumnsMenu.tsx";
import { resolveColumns, type ColumnSpec } from "./columns.ts";

type Row = Readonly<Record<string, FieldValue>>;

/** DataGrid props a caller may pass through (not the ones this view controls). */
export type GridOptions = Partial<
  Omit<DataGridProps, "onRowClick" | "rows" | "columns">
>;

export interface DataTableListProps {
  readonly ready: ReadyResource;
  /** Filter, sort and paging state; see `useQueryState`. */
  readonly state: QueryStateApi;
  /** Columns in order. Default: every field but JSON ones. */
  readonly columns?: readonly ColumnSpec[] | undefined;
  /** Show only columns the server can sort by. */
  readonly sortableOnly?: boolean | undefined;
  /** Let the user hide columns (a "Columns" button). Default true. */
  readonly configurableColumns?: boolean | undefined;
  /** Edit cells in place (double-click or Enter; Enter saves, Escape cancels). Read-only fields stay read-only. */
  readonly editable?: boolean | undefined;
  /**
   * The ETag of a row, sent as `If-Match` on an inline edit (a stale one fails
   * with 412 and the view reloads the row). The list endpoint returns no ETags,
   * so the app supplies them (for example from its SDK cache); without this
   * prop the edit is unconditional. May return a promise (same shape as
   * `ResourceFormProps.etag`): the edit waits for it, stays in a saving state
   * meanwhile, and is not sent if it rejects (the error is shown like any save
   * error). `undefined` sends the PATCH without `If-Match`.
   */
  readonly ifMatch?:
    | ((row: Row) => string | undefined | Promise<string | undefined>)
    | undefined;
  readonly pageSizeOptions?: readonly number[] | undefined;
  readonly onRowClick?: ((row: Row) => void) | undefined;
  readonly renderers?: RendererOverrides | undefined;
  /** Passed to the DataGrid last (a way to reach options this view does not expose). */
  readonly gridProps?: GridOptions | undefined;
}

interface EditCellProps extends GridRenderEditCellParams {
  readonly descriptor: FieldDescriptor;
  readonly resource: string;
  readonly renderers: RendererOverrides | undefined;
}

function EditCell({
  descriptor,
  resource,
  renderers,
  id,
  field,
  value,
}: EditCellProps): ReactElement {
  const apiRef = useGridApiContext();
  return (
    <FieldInput
      field={descriptor}
      resource={resource}
      size="small"
      value={value as FieldValue}
      autoFocus
      renderers={renderers}
      onChange={(next) =>
        void apiRef.current.setEditCellValue({ id, field, value: next })
      }
    />
  );
}

const canEdit = (
  f: FieldDescriptor,
  editable: boolean,
  idField: string,
): boolean => editable && !f.readOnly && f.name !== idField;

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** A paged data table (MUI X DataGrid): server-side sort and paging, optional inline editing. */
export function DataTableList({
  ready,
  state,
  columns,
  sortableOnly = false,
  configurableColumns = true,
  editable = false,
  ifMatch,
  pageSizeOptions = [10, 25, 50, 100],
  onRowClick,
  renderers,
  gridProps,
}: DataTableListProps): ReactElement {
  const { resource } = ready;
  const idField = resource.id_field;
  const { page, pageSize, sort } = state.state;
  const list = ready.hooks.useList(state.pagedQuery);
  const update = ready.hooks.useUpdate();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  // Edits in flight (several rows can save at once).
  const [saving, setSaving] = useState(0);
  const shown = useMemo(
    () =>
      resolveColumns(ready, columns).filter(
        (c) => !sortableOnly || c.field.sortable,
      ),
    [ready, columns, sortableOnly],
  );

  const gridColumns = useMemo<GridColDef[]>(
    () =>
      shown.map(({ field, header, width }) => ({
        field: field.name,
        headerName: header,
        sortable: field.sortable,
        filterable: false,
        editable: canEdit(field, editable, idField),
        ...(width === undefined ? { flex: 1, minWidth: 140 } : { width }),
        renderCell: (p: GridRenderCellParams) => (
          <FieldDisplay
            field={field}
            resource={resource.name}
            size="small"
            value={p.value as FieldValue}
            record={p.row as Row}
            renderers={renderers}
          />
        ),
        renderEditCell: (p: GridRenderEditCellParams) => (
          <EditCell
            {...p}
            descriptor={field}
            resource={resource.name}
            renderers={renderers}
          />
        ),
      })),
    [shown, resource.name, renderers, editable, idField],
  );

  // Keep showing the previous page while the next loads: with no rows the grid
  // would clamp to page 1 and undo the page change.
  const [previous, setPrevious] = useState(list.data);
  if (list.data !== undefined && list.data !== previous) setPrevious(list.data);
  const data = list.data ?? previous;
  const rows = (data ?? []).slice(0, pageSize) as Row[];
  const hasNextPage = (data?.length ?? 0) > pageSize;
  // The server reports no total, so the grid gets the least count that is true:
  // everything up to this page, plus one more row when a next page exists.
  const rowCount =
    data === undefined
      ? page * pageSize + 1
      : (page - 1) * pageSize + rows.length + (hasNextPage ? 1 : 0);
  // The grid treats a new model object as a sort change and returns to page 1,
  // so rebuild it only when the keys change, not when the URL is decoded again.
  const sortText = sort
    .map((k) => (k.desc ? `-${k.field}` : k.field))
    .join(",");
  const sortModel = useMemo<GridSortModel>(
    () =>
      sortText === ""
        ? []
        : sortText.split(",").map((key) => ({
            field: key.replace(/^-/, ""),
            sort: key.startsWith("-") ? "desc" : "asc",
          })),
    [sortText],
  );
  const visibility = Object.fromEntries([...hidden].map((n) => [n, false]));
  const sizes = [...new Set([...pageSizeOptions, pageSize])].sort(
    (a, b) => a - b,
  );

  async function save(next: Row, previous: Row): Promise<Row> {
    const patch: Record<string, FieldValue> = {};
    for (const { field } of shown) {
      const value = next[field.name];
      if (
        canEdit(field, editable, idField) &&
        value !== undefined &&
        !same(value, previous[field.name])
      )
        patch[field.name] = value;
    }
    if (Object.keys(patch).length === 0) return previous;
    setSaving((n) => n + 1);
    try {
      const tag = await ifMatch?.(previous);
      const saved = await update.mutateAsync({
        id: previous[idField] as number,
        patch,
        ...(tag === undefined ? {} : { ifMatch: tag }),
      });
      setNotice(null);
      return saved as Row;
    } finally {
      setSaving((n) => n - 1);
    }
  }

  function saveFailed(error: unknown): void {
    if (error instanceof PreconditionFailed) {
      setNotice("This row changed elsewhere. It was reloaded; edit it again.");
      void list.refetch();
    } else {
      setNotice(
        `Could not save: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (list.isError)
    return (
      <LoadError
        title={resource.title}
        error={list.error}
        onRetry={() => void list.refetch()}
      />
    );
  return (
    <Box aria-busy={saving > 0}>
      {configurableColumns && (
        <ColumnsMenu columns={shown} hidden={hidden} onChange={setHidden} />
      )}
      {notice !== null && (
        <Alert
          severity="warning"
          onClose={() => setNotice(null)}
          sx={{ mb: 1 }}
        >
          {notice}
        </Alert>
      )}
      <DataGrid
        aria-label={resource.title}
        autoHeight
        rows={rows}
        columns={gridColumns}
        getRowId={(row: Row) => row[idField] as number}
        loading={list.isFetching}
        columnVisibilityModel={visibility}
        paginationMode="server"
        sortingMode="server"
        filterMode="server"
        rowCount={rowCount}
        localeText={{
          paginationDisplayedRows: ({ from, to }) =>
            hasNextPage ? `${from}–${to}` : `${from}–${to} of ${rowCount}`,
        }}
        paginationModel={{ page: page - 1, pageSize }}
        pageSizeOptions={sizes}
        onPaginationModelChange={(model) =>
          model.pageSize === pageSize
            ? state.setPage(model.page + 1)
            : state.setPageSize(model.pageSize)
        }
        sortModel={sortModel}
        onSortModelChange={(model) =>
          state.setSort(
            model.map((m) => ({ field: m.field, desc: m.sort === "desc" })),
          )
        }
        disableColumnFilter
        disableColumnMenu
        disableRowSelectionOnClick
        processRowUpdate={save}
        onProcessRowUpdateError={saveFailed}
        onRowClick={(p) => onRowClick?.(p.row as Row)}
        {...gridProps}
      />
    </Box>
  );
}
