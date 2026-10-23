import type { JsonObject } from "@craftainer/crud-sdk";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { ReactElement } from "react";
import {
  FieldDisplay,
  ResourceGate,
  toQueryFilters,
  type FieldFilters,
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { SYSTEM_FIELDS } from "../lifecycle/status.ts";
import { BulkToolbar, type BulkToolbarProps } from "./BulkToolbar.tsx";
import { useBulkSelection } from "./selection.ts";

export interface BulkPanelProps extends Pick<
  BulkToolbarProps,
  "actions" | "onExport" | "onDone"
> {
  readonly ready: ReadyResource;
  readonly filters?: FieldFilters | undefined;
  /** Columns to show; default: the first four non-system fields. */
  readonly columns?: readonly string[] | undefined;
  /** Page size; default 25. */
  readonly limit?: number | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

/** A selectable table over one page of an already loaded resource, with the bulk toolbar above it. */
export function BulkPanel({
  ready,
  filters,
  columns,
  limit = 25,
  renderers,
  ...toolbar
}: BulkPanelProps): ReactElement {
  const selection = useBulkSelection();
  const list = ready.hooks.useList({
    filters: toQueryFilters(filters ?? {}),
    limit,
  });
  const fields =
    columns === undefined
      ? ready.fields.filter((f) => !SYSTEM_FIELDS.includes(f.name)).slice(0, 4)
      : ready.fields.filter((f) => columns.includes(f.name));
  if (list.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  if (list.error !== null) {
    return <Alert severity="error">{list.error.message}</Alert>;
  }
  const idOf = (row: JsonObject): number =>
    row[ready.resource.id_field] as number;
  const ids = list.data.map(idOf);
  const ticked = ids.filter(
    (id) => selection.allMatching || selection.isSelected(id),
  );
  return (
    <Stack spacing={2}>
      <BulkToolbar
        ready={ready}
        selection={selection}
        filters={filters}
        {...toolbar}
      />
      <Table size="small" aria-label={ready.resource.title}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={ids.length > 0 && ticked.length === ids.length}
                indeterminate={ticked.length > 0 && ticked.length < ids.length}
                onChange={(event) =>
                  selection.setPage(ids, event.target.checked)
                }
                slotProps={{
                  input: { "aria-label": "Select all on this page" },
                }}
              />
            </TableCell>
            {fields.map((f) => (
              <TableCell key={f.name}>{f.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {list.data.map((row) => {
            const id = idOf(row);
            const on = selection.allMatching || selection.isSelected(id);
            return (
              <TableRow key={id} hover selected={on}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={on}
                    onChange={() => selection.toggle(id)}
                    slotProps={{
                      input: { "aria-label": `Select record ${id}` },
                    }}
                  />
                </TableCell>
                {fields.map((f) => (
                  <TableCell key={f.name}>
                    <FieldDisplay
                      field={f}
                      resource={ready.resource.name}
                      value={row[f.name] as FieldValue}
                      renderers={renderers}
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Stack>
  );
}

export interface BulkRecordsProps extends Omit<BulkPanelProps, "ready"> {
  readonly resource: string;
  readonly apiVersion?: string | undefined;
}

/**
 * Records with checkboxes and the bulk toolbar: selection count, bulk delete,
 * export, bulk publish and filter-based select-all (no count preview). Bulk
 * calls respect `bulk.max_matched`.
 */
export function BulkRecords({
  resource,
  apiVersion,
  ...rest
}: BulkRecordsProps): ReactElement {
  return (
    <ResourceGate name={resource} apiVersion={apiVersion}>
      {(ready) => <BulkPanel ready={ready} {...rest} />}
    </ResourceGate>
  );
}
