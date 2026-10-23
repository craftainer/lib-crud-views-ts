import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { memoryUrlAdapter } from "../../src/filter/index.ts";
import { ResourceList } from "../../src/list/index.ts";
import { manyHeroes } from "../fixtures/routes/list.ts";
import { renderCrud } from "../helpers.tsx";

const wait = { timeout: 8000 };

describe("CardGridList", () => {
  it("pages with Previous and Next and sorts through the dropdown", async () => {
    const user = userEvent.setup();
    const adapter = memoryUrlAdapter();
    const onRowClick = vi.fn();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        variant="cards"
        urlAdapter={adapter}
        columns={["name", "power_level"]}
        defaults={{ pageSize: 5 }}
        onRowClick={onRowClick}
        renderers={{ "heroes.power_level": { display: () => <b>lvl</b> } }}
      />,
      { heroes: manyHeroes(12) },
    );
    expect(await screen.findByText("Atlas 1", {}, wait)).toBeInTheDocument();
    expect(screen.getAllByText("lvl")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Atlas 9", {}, wait);
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(adapter.read()).toBe("page=2");
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Atlas 1", {}, wait);

    await user.click(screen.getAllByRole("button", { name: "Open" })[0]!);
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));

    // Sort dropdown: field, then direction, then back to the default order.
    await user.click(screen.getByRole("combobox", { name: "Sort by" }));
    await user.click(screen.getByRole("option", { name: "Power level" }));
    await waitFor(() => expect(adapter.read()).toBe("sort=power_level"));
    await user.click(screen.getByRole("combobox", { name: "Direction" }));
    await user.click(screen.getByRole("option", { name: "Descending" }));
    await waitFor(() => expect(adapter.read()).toContain("sort=-power_level"));
    expect(stub.requests.at(-1)).toContain("sort=-power_level");
    await user.click(screen.getByRole("combobox", { name: "Direction" }));
    await user.click(screen.getByRole("option", { name: "Ascending" }));
    await waitFor(() => expect(adapter.read()).toBe("sort=power_level"));
    await user.click(screen.getByRole("combobox", { name: "Sort by" }));
    await user.click(screen.getByRole("option", { name: "Default order" }));
    await waitFor(() => expect(adapter.read()).toBe(""));
    expect(screen.queryByRole("combobox", { name: "Direction" })).toBeNull();
  }, 30_000);

  it("shows an empty state, a loading spinner and an error with retry", async () => {
    const user = userEvent.setup();
    const empty = renderCrud(
      <ResourceList
        resource="heroes"
        variant="cards"
        urlAdapter={memoryUrlAdapter()}
      />,
      { heroes: [] },
    );
    expect(
      await screen.findByText("No records.", {}, wait),
    ).toBeInTheDocument();
    empty.unmount();

    const loading = renderCrud(
      <ResourceList
        resource="heroes"
        variant="cards"
        urlAdapter={memoryUrlAdapter()}
      />,
      { list: "pending" },
    );
    expect(
      await screen.findByLabelText("Loading", {}, wait),
    ).toBeInTheDocument();
    loading.unmount();

    renderCrud(
      <ResourceList
        resource="heroes"
        variant="cards"
        urlAdapter={memoryUrlAdapter()}
      />,
      { list: "error" },
    );
    expect(await screen.findByRole("alert", {}, wait)).toHaveTextContent(
      "Could not load",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert", {}, wait)).toBeInTheDocument();
  });
});

describe("LoadMoreList", () => {
  it("appends the next page on Load more", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        variant="loadMore"
        urlAdapter={memoryUrlAdapter()}
        columns={["name"]}
        titleField="name"
        defaults={{ pageSize: 5 }}
      />,
      { heroes: manyHeroes(9) },
    );
    await screen.findByText("Atlas 1", {}, wait);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(
      () => expect(screen.getAllByRole("article")).toHaveLength(8),
      wait,
    );
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(stub.requests.some((r) => r.includes("skip=5"))).toBe(true);
  }, 30_000);

  it("shows loading and error states", async () => {
    const user = userEvent.setup();
    const loading = renderCrud(
      <ResourceList
        resource="heroes"
        variant="loadMore"
        urlAdapter={memoryUrlAdapter()}
      />,
      { list: "pending" },
    );
    expect(
      await screen.findByLabelText("Loading", {}, wait),
    ).toBeInTheDocument();
    loading.unmount();
    renderCrud(
      <ResourceList
        resource="heroes"
        variant="loadMore"
        urlAdapter={memoryUrlAdapter()}
      />,
      { list: "error" },
    );
    expect(await screen.findByRole("alert", {}, wait)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
  });
});

describe("SortDropdown", () => {
  it("renders nothing when no field is sortable", async () => {
    const { SortDropdown } = await import("../../src/list/index.ts");
    const { renderReady } = await import("../filter/renderReady.tsx");
    const { container } = renderReady((ready) => (
      <SortDropdown
        ready={{
          ...ready,
          fields: ready.fields.map((f) => ({ ...f, sortable: false })),
        }}
        sort={[]}
        onChange={() => {}}
      />
    ));
    await waitFor(() => expect(container).toBeEmptyDOMElement(), wait);
  });
});

describe("filters in ResourceList", () => {
  it("narrows through quick search, bar, builder and facets, in the URL", async () => {
    const user = userEvent.setup();
    const adapter = memoryUrlAdapter();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        variant="cards"
        urlAdapter={adapter}
        filters={["quick", "bar", "builder", "facets"]}
        barFields={["name"]}
        facetFields={["is_locked"]}
        columns={["name"]}
        prefix="h."
        searchField="owner_id"
      />,
      { heroes: manyHeroes(12) },
    );
    await screen.findByText("Atlas 1", {}, wait);

    await user.type(screen.getByLabelText("Search owner id"), "stub");
    await waitFor(() => expect(adapter.read()).toBe("h.q=stub"), wait);
    expect(stub.requests.at(-1)).toContain("owner_id__icontains=stub");

    await user.click(screen.getByRole("checkbox", { name: "Yes" }));
    await waitFor(
      () => expect(adapter.read()).toContain("h.f.is_locked.in=true"),
      wait,
    );
    expect(adapter.read()).toContain("h.f=");

    await user.type(screen.getByLabelText("Name"), "Beacon");
    await waitFor(
      () => expect(adapter.read()).toContain("h.f.name.icontains=Beacon"),
      wait,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(
      () => expect(adapter.read()).not.toContain("is_locked"),
      wait,
    );
    expect(
      screen.getByRole("region", { name: "Filter builder" }),
    ).toBeInTheDocument();
  }, 30_000);

  it("applies default filters and the quick-search field choice", async () => {
    const adapter = memoryUrlAdapter();
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        variant="cards"
        urlAdapter={adapter}
        defaults={{ filters: { power_level: { min: 50 } } }}
        columns={["name", "power_level"]}
      />,
    );
    await screen.findByText("Captain Ledger", {}, wait);
    expect(stub.requests.at(-1)).toContain("power_level__min=50");
    await user.click(screen.getByRole("combobox", { name: "Search in" }));
    await user.click(screen.getByRole("option", { name: "Owner id" }));
    expect(adapter.read()).toBe("qf=owner_id");
  });

  it("uses the window address by default", async () => {
    window.history.replaceState(null, "", "/?size=5");
    renderCrud(
      <ResourceList resource="heroes" variant="cards" columns={["name"]} />,
      { heroes: manyHeroes(8) },
    );
    await screen.findByText("Atlas 1", {}, wait);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    window.history.replaceState(null, "", "/");
  });
});
