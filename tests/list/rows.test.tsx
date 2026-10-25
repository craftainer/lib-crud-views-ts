import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { memoryUrlAdapter } from "../../src/filter/index.ts";
import { ResourceList } from "../../src/list/index.ts";
import { renderCrud } from "../helpers.tsx";

// Records the `rows` prop of every DataGrid render; everything else is the real grid.
const seen = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@mui/x-data-grid", async (importOriginal) => {
  const real = await importOriginal<typeof import("@mui/x-data-grid")>();
  return {
    ...real,
    DataGrid: (props: React.ComponentProps<typeof real.DataGrid>) => {
      seen.rows.push(props.rows);
      return <real.DataGrid {...props} />;
    },
  };
});

describe("DataTableList rows", () => {
  it("hands the grid the same rows array while the data is unchanged", async () => {
    const user = userEvent.setup();
    renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={{ disableVirtualization: true }}
        columns={["id", "name"]}
      />,
    );
    await screen.findByText("Captain Ledger");
    // Any state change re-renders the list: here, toggling a column.
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("checkbox", { name: "Name" }));
    const loaded = seen.rows.filter((rows) => (rows as unknown[]).length > 0);
    expect(loaded.length).toBeGreaterThan(1);
    expect(new Set(loaded).size).toBe(1);
  });
});
