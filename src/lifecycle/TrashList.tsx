import type { FieldValue } from "../core/index.ts";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import {
  FieldDisplay,
  ResourceGate,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { useRestore } from "./mutations.ts";
import { SYSTEM_FIELDS } from "./status.ts";

export interface TrashPanelProps {
  readonly ready: ReadyResource;
  readonly renderers?: RendererOverrides | undefined;
  /** Columns to show; default: the first three non-system fields. */
  readonly columns?: readonly string[] | undefined;
  /** Called after a record was restored. */
  readonly onRestored?: ((id: number) => void) | undefined;
}

/** The archived records of an already loaded resource, each with Restore. Hidden without `archive_restore`. */
export function TrashPanel(props: TrashPanelProps): ReactElement | null {
  return props.ready.capabilities.archive_restore ? (
    <TrashBody {...props} />
  ) : null;
}

function TrashBody({
  ready,
  renderers,
  columns,
  onRestored,
}: TrashPanelProps): ReactElement {
  const list = ready.hooks.useList({ includeArchived: true });
  const restore = useRestore(ready);
  const fields =
    columns === undefined
      ? ready.fields.filter((f) => !SYSTEM_FIELDS.includes(f.name)).slice(0, 3)
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
  const archived = list.data.filter(
    (row) => typeof row["archived_at"] === "string",
  );
  const error = restore.error;
  return (
    <>
      {error !== null && <Alert severity="error">{error.message}</Alert>}
      {archived.length === 0 ? (
        <Typography color="text.secondary">The trash is empty.</Typography>
      ) : (
        <Table size="small" aria-label="Trash">
          <TableHead>
            <TableRow>
              {fields.map((f) => (
                <TableCell key={f.name}>{f.label}</TableCell>
              ))}
              <TableCell>Archived</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {archived.map((row) => {
              const id = row[ready.resource.id_field] as number;
              return (
                <TableRow key={id}>
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
                  <TableCell>{String(row["archived_at"])}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      aria-label={`Restore record ${id}`}
                      disabled={restore.isPending}
                      onClick={() =>
                        restore.mutate(id, {
                          onSuccess: () => onRestored?.(id),
                        })
                      }
                    >
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}

export interface TrashListProps extends Omit<TrashPanelProps, "ready"> {
  readonly resource: string;
  readonly apiVersion?: string | undefined;
}

/** The trash: archived records with Restore. Renders nothing for a resource without an archive. */
export function TrashList({
  resource,
  apiVersion,
  ...rest
}: TrashListProps): ReactElement {
  return (
    <ResourceGate name={resource} apiVersion={apiVersion}>
      {(ready) => <TrashPanel ready={ready} {...rest} />}
    </ResourceGate>
  );
}
