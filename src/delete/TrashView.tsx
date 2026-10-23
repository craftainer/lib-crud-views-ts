// <TrashView>: the archived records of a resource, each with a Restore button.
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
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { useRestore } from "./restore.ts";

export interface TrashViewProps {
  readonly name: string;
  readonly apiVersion?: string | undefined;
  /** Fields shown, in order. Default the first three besides `id`, then `archived_at`. */
  readonly fields?: readonly string[] | undefined;
  /** What one record is called in labels. Default "record". */
  readonly recordLabel?: string | undefined;
  readonly onRestored?: ((id: number) => void) | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

/** Archived records with Restore; renders nothing for a resource without `archive_restore`. */
export function TrashView(props: TrashViewProps): ReactElement {
  return (
    <ResourceGate name={props.name} apiVersion={props.apiVersion}>
      {(ready) =>
        ready.capabilities.archive_restore ? (
          <Trash ready={ready} {...props} />
        ) : null
      }
    </ResourceGate>
  );
}

function Trash({
  ready,
  ...props
}: TrashViewProps & { readonly ready: ReadyResource }): ReactElement {
  const label = props.recordLabel ?? "record";
  const list = ready.hooks.useList({ includeArchived: true, limit: 200 });
  const restore = useRestore(ready, props.name, props.apiVersion);
  const byName = new Map(ready.fields.map((f) => [f.name, f]));
  const names = props.fields ?? [
    ...ready.fields
      .map((f) => f.name)
      .filter((name) => name !== "id" && name !== "archived_at")
      .slice(0, 3),
    "archived_at",
  ];
  const shown = names.flatMap((name) => byName.get(name) ?? []);
  const rows = (list.data ?? []).filter(
    (row) => row["archived_at"] !== null && row["archived_at"] !== undefined,
  ) as Record<string, FieldValue>[];

  if (list.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  if (list.isError) return <Alert severity="error">{list.error.message}</Alert>;
  return (
    <Box>
      {restore.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {restore.error.message}
        </Alert>
      )}
      {rows.length === 0 ? (
        <Typography sx={{ color: "text.secondary", p: 2 }}>
          The trash is empty.
        </Typography>
      ) : (
        <Table size="small" aria-label="Trash">
          <TableHead>
            <TableRow>
              {shown.map((field) => (
                <TableCell key={field.name}>{field.label}</TableCell>
              ))}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const id = row["id"] as number;
              return (
                <TableRow key={id}>
                  {shown.map((field) => (
                    <TableCell key={field.name}>
                      <FieldDisplay
                        field={field}
                        resource={ready.resource.name}
                        value={row[field.name]}
                        record={row}
                        renderers={props.renderers}
                      />
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Button
                      size="small"
                      disabled={restore.isPending}
                      aria-label={`Restore ${label} ${id}`}
                      onClick={() =>
                        restore.mutate(id, {
                          onSuccess: () => props.onRestored?.(id),
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
    </Box>
  );
}
