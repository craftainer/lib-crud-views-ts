import type { JsonObject } from "@craftainer/crud-sdk";
import { useQuery } from "@tanstack/react-query";
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
import { useFormat } from "../core/context.ts";
import { parseInstant } from "../core/values.ts";
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

/** When a record was archived, in the viewer's locale and time zone. */
function ArchivedAt({ value }: { readonly value: string }): ReactElement {
  const { locale, timeZone } = useFormat();
  const date = parseInstant(value);
  if (date === null) return <>{value}</>;
  const text = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
  return <time dateTime={date.toISOString()}>{text}</time>;
}

function TrashBody({
  ready,
  renderers,
  columns,
  onRestored,
}: TrashPanelProps): ReactElement {
  // The server returns only the archived rows (`onlyArchived`, which implies
  // `includeArchived`). The SDK has no key builder for the trash, so this
  // follows its layout `["crud", client, resource, scope, kind]`: another
  // caller never sees these rows and invalidating the resource (a key prefix)
  // refreshes them. A resource without an archive ignores `onlyArchived`, but
  // `TrashPanel` renders nothing for it.
  const { namespace: ns, queryName } = ready;
  const list = useQuery({
    queryKey: ["crud", ns.client, queryName, ns.scope, "trash"],
    queryFn: async (): Promise<JsonObject[]> => {
      const rows: JsonObject[] = [];
      for await (const row of ready.handle.iterAll({
        onlyArchived: true,
        includeUnpublished: true,
      })) {
        rows.push(row);
      }
      return rows;
    },
  });
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
  if (list.isError) {
    return <Alert severity="error">{list.error.message}</Alert>;
  }
  const archived = list.data;
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
                  <TableCell>
                    <ArchivedAt value={row["archived_at"] as string} />
                  </TableCell>
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
