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
  prefix,
}: {
  ready: ReadyResource;
  adapter: ReturnType<typeof memoryUrlAdapter>;
  defaults?: QueryDefaults;
  prefix?: string;
}) {
  const q = useQueryState(ready, { adapter, defaults, prefix });
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
    expect(adapter.read()).toBe("tab=1&l_page=3");
    await click("filters");
    // A filter change returns to page 1.
    expect(adapter.read()).toBe("tab=1&l_f=&l_f.name.eq=x");
    await click("search");
    await click("searchField");
    await click("sort");
    await click("size");
    await click("archived");
    await click("drafts");
    const written = new URLSearchParams(adapter.read());
    expect(written.get("l_q")).toBe("ada");
    expect(written.get("l_qf")).toBe("owner_id");
    expect(written.get("l_sort")).toBe("-name");
    expect(written.get("l_size")).toBe("50");
    expect(written.get("l_archived")).toBe("1");
    expect(written.get("l_drafts")).toBe("1");
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

  it("keeps the host app's page, sort, q and size apart by default", async () => {
    const user = userEvent.setup();
    const host = "page=7&sort=title&q=mine&size=9";
    const adapter = memoryUrlAdapter(host);
    renderReady((ready) => <Probe ready={ready} adapter={adapter} />);
    // The host's parameters are not the list's: the list starts at its defaults.
    await screen.findByText(/"skip":0/);
    await user.click(screen.getByRole("button", { name: "search" }));
    await user.click(screen.getByRole("button", { name: "page" }));
    const written = new URLSearchParams(adapter.read());
    expect(written.get("l_page")).toBe("3");
    expect(written.get("l_q")).toBe("ada");
    for (const [key, value] of new URLSearchParams(host))
      expect(written.get(key)).toBe(value);
    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(adapter.read()).toBe(host);
  });

  it("reads unprefixed names when the prefix is empty", async () => {
    const adapter = memoryUrlAdapter("page=3");
    renderReady((ready) => <Probe ready={ready} adapter={adapter} prefix="" />);
    // `page=3` is the list's own page: skip = 2 * the default page size (25).
    await screen.findByText(/"skip":50\b/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "search" }));
    expect(adapter.read()).toBe("q=ada");
  });

  it("renders on the server with an empty query string", () => {
    const ready = {
      fields: [field({ name: "name", filterOps: ["icontains"] })],
      resource: { pagination: { max_limit: 100 } },
    } as unknown as ReadyResource;
    const html = renderToString(
      <Probe ready={ready} adapter={memoryUrlAdapter("l_page=4")} />,
    );
    expect(html).toContain("skip");
    expect(html).toContain("&quot;skip&quot;:0");
  });
});
