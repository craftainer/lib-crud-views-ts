import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import {
  FieldDisplay,
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { resolveColumns, type ColumnSpec } from "./columns.ts";

export type Row = Readonly<Record<string, FieldValue>>;

export interface RecordCardProps {
  readonly ready: ReadyResource;
  readonly row: Row;
  readonly columns?: readonly ColumnSpec[] | undefined;
  /** The field shown as the card's heading. Default: the first column. */
  readonly titleField?: string | undefined;
  readonly renderers?: RendererOverrides | undefined;
  readonly onClick?: ((row: Row) => void) | undefined;
}

/** One record as a card: a heading and a label/value pair per other column. */
export function RecordCard({
  ready,
  row,
  columns,
  titleField,
  renderers,
  onClick,
}: RecordCardProps): ReactElement {
  const all = resolveColumns(ready, columns);
  const head = all.find((c) => c.field.name === titleField) ?? all[0];
  const rest = all.filter((c) => c !== head);
  const resource = ready.resource.name;
  const display = (c: (typeof all)[number]): ReactElement => (
    <FieldDisplay
      field={c.field}
      resource={resource}
      size="small"
      value={row[c.field.name]}
      record={row}
      renderers={renderers}
    />
  );
  return (
    <Card variant="outlined" component="article">
      <CardContent>
        {head !== undefined && (
          <Typography component="h3" variant="h6" gutterBottom>
            {display(head)}
          </Typography>
        )}
        <Stack component="dl" spacing={0.5} sx={{ m: 0 }}>
          {rest.map((c) => (
            <Stack
              key={c.field.name}
              direction="row"
              spacing={1}
              sx={{ alignItems: "baseline" }}
            >
              <Typography
                component="dt"
                variant="body2"
                color="text.secondary"
                sx={{ minWidth: "8rem" }}
              >
                {c.header}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, minWidth: 0 }}
              >
                {display(c)}
              </Typography>
            </Stack>
          ))}
        </Stack>
        {onClick !== undefined && (
          <Button size="small" sx={{ mt: 1 }} onClick={() => onClick(row)}>
            Open
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
