import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { ReadyResource, RendererOverrides } from "../core/index.ts";
import type { QueryStateApi } from "../filter/index.ts";
import type { ColumnSpec } from "./columns.ts";
import { CardList } from "./CardList.tsx";
import { LoadError } from "./LoadError.tsx";
import type { Row } from "./RecordCard.tsx";

export interface CardGridListProps {
  readonly ready: ReadyResource;
  readonly state: QueryStateApi;
  readonly columns?: readonly ColumnSpec[] | undefined;
  readonly titleField?: string | undefined;
  readonly onRowClick?: ((row: Row) => void) | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

/** A page of cards in a responsive grid, with Previous and Next (the server reports no total). */
export function CardGridList({
  ready,
  state,
  columns,
  titleField,
  onRowClick,
  renderers,
}: CardGridListProps): ReactElement {
  const { page, pageSize } = state.state;
  const list = ready.hooks.useList(state.pagedQuery);
  if (list.isError)
    return (
      <LoadError
        title={ready.resource.title}
        error={list.error}
        onRetry={() => void list.refetch()}
      />
    );
  if (list.isPending) return <CircularProgress aria-label="Loading" />;
  const rows = list.data.slice(0, pageSize) as Row[];
  return (
    <Stack spacing={2}>
      <CardList
        ready={ready}
        rows={rows}
        columns={columns}
        titleField={titleField}
        layout="grid"
        onRowClick={onRowClick}
        renderers={renderers}
      />
      <Stack
        direction="row"
        spacing={1}
        component="nav"
        aria-label="Pages"
        sx={{ alignItems: "center" }}
      >
        <Button disabled={page <= 1} onClick={() => state.setPage(page - 1)}>
          Previous
        </Button>
        <Typography variant="body2">{`Page ${page}`}</Typography>
        <Button
          disabled={list.data.length <= pageSize}
          onClick={() => state.setPage(page + 1)}
        >
          Next
        </Button>
      </Stack>
    </Stack>
  );
}
