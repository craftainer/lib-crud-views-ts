import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";
import type { ReadyResource, RendererOverrides } from "../core/index.ts";
import type { QueryStateApi } from "../filter/index.ts";
import type { ColumnSpec } from "./columns.ts";
import { CardList } from "./CardList.tsx";
import { LoadError } from "./LoadError.tsx";
import type { Row } from "./RecordCard.tsx";

export interface LoadMoreListProps {
  readonly ready: ReadyResource;
  readonly state: QueryStateApi;
  readonly columns?: readonly ColumnSpec[] | undefined;
  readonly titleField?: string | undefined;
  /** `list`: one card per row; `grid`: cards side by side. Default `list`. */
  readonly layout?: "list" | "grid" | undefined;
  readonly onRowClick?: ((row: Row) => void) | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

/** A growing list: the first page, then "Load more" appends the next (`useInfiniteList`). The page number is not used. */
export function LoadMoreList({
  ready,
  state,
  columns,
  titleField,
  layout = "list",
  onRowClick,
  renderers,
}: LoadMoreListProps): ReactElement {
  const query = ready.hooks.useInfiniteList(state.feedQuery, {
    limit: state.state.pageSize,
  });
  if (query.isError)
    return (
      <LoadError
        title={ready.resource.title}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <CircularProgress aria-label="Loading" />;
  const rows = query.data.pages.flat() as Row[];
  return (
    <Stack spacing={2}>
      <CardList
        ready={ready}
        rows={rows}
        columns={columns}
        titleField={titleField}
        layout={layout}
        onRowClick={onRowClick}
        renderers={renderers}
      />
      {query.hasNextPage && (
        <Box>
          <Button
            variant="outlined"
            disabled={query.isFetchingNextPage}
            aria-busy={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Load more
          </Button>
        </Box>
      )}
    </Stack>
  );
}
