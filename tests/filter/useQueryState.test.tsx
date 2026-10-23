import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReadyResource } from "../../src/core/index.ts";
import {
  memoryUrlAdapter,
  useQueryState,
  type QueryDefaults,
} from "../../src/filter/index.ts";
import { field } from "../helpers.tsx";
import { renderReady } from "./renderReady.tsx";
import { ResourceGate } from "../../src/core/index.ts";
import { renderCrud } from "../helpers.tsx";

function Probe({
  ready,
  adapter,
  defaults,
}: {
  ready: ReadyResource;
  adapter: ReturnType<typeof memoryUrlAdapter>;
  defaults?: QueryDefaults;
}) {
  const q = useQueryState(ready, { adapter, defaults });
  const buttons: Record<string, () => void> = {
    filters: () => q.setFilters({ name: { eq: "x" } }),
    search: () => q.setQuickSearch("ada"),
    searchField: () => q.setQuickSearchField("owner_id"),
    sort: () => q.setSort([{ field: "name", desc: true }]),
    page: () => q.setPage(3),
    size: () => q.setPageSize(50),
    archived: () => q.setIncludeArchived(true),
    drafts: () => q.setIncludeUnpublished(true),
    reset: () => q.reset(),
  };
  return (
    <>
      <output>{JSON.stringify(q.pagedQuery)}</output>
      {Object.entries(buttons).map(([name, run]) => (
        <button key={name} onClick={run}>
          {name}
        </button>
      ))}
    </>
  );
}

describe("useQueryState", () => {
  it("writes every change to the adapter, page changes keep the rest, reset restores", async () => {
    const user = userEvent.setup();
    const adapter = memoryUrlAdapter("tab=1");
    renderReady((ready) => <Probe ready={ready} adapter={adapter} />);
    const click = (name: string) =>
      user.click(screen.getByRole("button", { name }));
    await screen.findByRole("button", { name: "page" });

    await click("page");
    expect(adapter.read()).toBe("tab=1&page=3");
    await click("filters");
    // A filter change returns to page 1.
    expect(adapter.read()).toBe("tab=1&f=&f.name.eq=x");
    await click("search");
    await click("searchField");
    await click("sort");
    await click("size");
    await click("archived");
    await click("drafts");
    const written = new URLSearchParams(adapter.read());
    expect(written.get("q")).toBe("ada");
    expect(written.get("qf")).toBe("owner_id");
    expect(written.get("sort")).toBe("-name");
    expect(written.get("size")).toBe("50");
    expect(written.get("archived")).toBe("1");
    expect(written.get("drafts")).toBe("1");
    expect(written.get("tab")).toBe("1");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "owner_id__icontains",
      ),
    );
    await click("reset");
    expect(adapter.read()).toBe("tab=1");
  });

  it("holds literal defaults steady and follows a change of their content", async () => {
    const adapter = memoryUrlAdapter();
    const ui = (pageSize: number) => (
      <ResourceGate name="heroes">
        {(ready) => (
          <Probe ready={ready} adapter={adapter} defaults={{ pageSize }} />
        )}
      </ResourceGate>
    );
    const { rerender } = renderCrud(ui(5));
    await screen.findByText(/"limit":6/);
    rerender(ui(5));
    await screen.findByText(/"limit":6/);
    rerender(ui(8));
    await screen.findByText(/"limit":9/);
  });

  it("renders on the server with an empty query string", () => {
    const ready = {
      fields: [field({ name: "name", filterOps: ["icontains"] })],
      resource: { pagination: { max_limit: 100 } },
    } as unknown as ReadyResource;
    const html = renderToString(
      <Probe ready={ready} adapter={memoryUrlAdapter("page=4")} />,
    );
    expect(html).toContain("skip");
    expect(html).toContain("&quot;skip&quot;:0");
  });
});
