import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactElement } from "react";
import { PageShell } from "../core/index.ts";
import { memoryUrlAdapter } from "../filter/index.ts";
import { manyHeroes } from "../../tests/fixtures/routes/list.ts";
import { ResourceList, type ResourceListProps } from "./ResourceList.tsx";

/** A list whose state lives in memory, seeded with `search`, so a story never touches the address bar. */
function Demo({
  search = "",
  ...props
}: Omit<ResourceListProps, "resource" | "urlAdapter"> & {
  search?: string;
}): ReactElement {
  const [adapter] = useState(() => memoryUrlAdapter(search));
  return (
    <PageShell title="Heroes" maxWidth="xl">
      <ResourceList resource="heroes" urlAdapter={adapter} {...props} />
    </PageShell>
  );
}

const meta = {
  title: "List/Resource list",
  parameters: { layout: "fullscreen", stub: { heroes: manyHeroes(30) } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const columns = ["name", "power_level", "is_locked", "updated_at"];

/** Paged data table: header-click sort, a Columns button, server paging. */
export const Table: Story = {
  render: () => (
    <Demo
      columns={columns}
      defaults={{ pageSize: 10 }}
      gridProps={{ disableVirtualization: true }}
    />
  ),
};

/** Sorted by power level, descending, with a filter from the URL state. */
export const TableSortedAndFiltered: Story = {
  render: () => (
    <Demo
      columns={columns}
      filters={["quick", "bar"]}
      barFields={["power_level", "created_at"]}
      search="l_sort=-power_level&l_f=&l_f.power_level.min=40&l_size=10"
      gridProps={{ disableVirtualization: true }}
    />
  ),
};

/** Cells edit in place: double-click or press Enter on a cell. */
export const TableEditable: Story = {
  render: () => (
    <Demo
      columns={["name", "power_level", "updated_at"]}
      editable
      defaults={{ pageSize: 10 }}
      gridProps={{ disableVirtualization: true }}
    />
  ),
};

/** Inline edit with an async `ifMatch`: the ETag is fetched (here after a short delay) before the PATCH. */
export const TableEditableAsyncIfMatch: Story = {
  render: () => (
    <Demo
      columns={["name", "power_level", "updated_at"]}
      editable
      ifMatch={() =>
        new Promise<string | undefined>((resolve) => {
          setTimeout(() => resolve(undefined), 300);
        })
      }
      defaults={{ pageSize: 10 }}
      gridProps={{ disableVirtualization: true }}
    />
  ),
};

/** Card grid with the sort dropdown (no header row to click). */
export const Cards: Story = {
  render: () => (
    <Demo
      variant="cards"
      columns={["name", "power_level", "is_locked"]}
      defaults={{ pageSize: 6 }}
    />
  ),
};

/** A growing list: "Load more" appends the next page. */
export const LoadMore: Story = {
  render: () => (
    <Demo
      variant="loadMore"
      columns={["name", "power_level"]}
      defaults={{ pageSize: 4 }}
    />
  ),
};

/** Every filter UI at once: quick search, bar, builder and facets. */
export const AllFilters: Story = {
  render: () => (
    <Demo
      variant="cards"
      columns={["name", "power_level"]}
      filters={["quick", "bar", "builder", "facets"]}
      barFields={["name", "power_level"]}
      search="l_f=&l_f.is_locked.in=true&l_f.power_level.max=90&l_f.name.contains=a&l_size=6"
    />
  ),
};
