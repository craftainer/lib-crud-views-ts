import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { ReadyResource, RendererOverrides } from "../core/index.ts";
import type { ColumnSpec } from "./columns.ts";
import { RecordCard, type Row } from "./RecordCard.tsx";

export interface CardListProps {
  readonly ready: ReadyResource;
  readonly rows: readonly Row[];
  readonly columns?: readonly ColumnSpec[] | undefined;
  readonly titleField?: string | undefined;
  /** `list`: one card per row; `grid`: as many as fit. */
  readonly layout: "list" | "grid";
  readonly onRowClick?: ((row: Row) => void) | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

/** The cards of the card views (and their empty state). */
export function CardList({
  ready,
  rows,
  columns,
  titleField,
  layout,
  onRowClick,
  renderers,
}: CardListProps): ReactElement {
  if (rows.length === 0)
    return <Typography color="text.secondary">No records.</Typography>;
  return (
    <Box
      component="ul"
      aria-label={ready.resource.title}
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gap: 2,
        gridTemplateColumns:
          layout === "grid" ? "repeat(auto-fill, minmax(16rem, 1fr))" : "1fr",
      }}
    >
      {rows.map((row) => (
        <li key={String(row[ready.resource.id_field])}>
          <RecordCard
            ready={ready}
            row={row}
            columns={columns}
            titleField={titleField}
            renderers={renderers}
            onClick={onRowClick}
          />
        </li>
      ))}
    </Box>
  );
}
