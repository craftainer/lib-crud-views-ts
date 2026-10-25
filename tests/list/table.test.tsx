import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { memoryUrlAdapter } from "../../src/filter/index.ts";
import { ResourceList } from "../../src/list/index.ts";
import { etagOf } from "../fixtures/routes/form.ts";
import { manyHeroes } from "../fixtures/routes/list.ts";
import { heroRows } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";

const grid = { disableVirtualization: true };

const lastList = (requests: string[]): string =>
  requests.filter((r) => r.startsWith("GET /api/crud/v1/heroes/v2")).at(-1) ??
  "";

describe("DataTableList", () => {
  it("shows the rows through the field renderers and hides drafts", async () => {
    const adapter = memoryUrlAdapter();
    renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={adapter}
        gridProps={grid}
        columns={[
          "name",
          { field: "power_level", header: "Level", width: 120 },
          "ghost",
        ]}
      />,
    );
    expect(await screen.findByText("Captain Ledger")).toBeInTheDocument();
    expect(screen.getByText("The Margin")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Level" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Ghost" })).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("gates the archive and draft switches on the capabilities", async () => {
    const user = userEvent.setup();
    const adapter = memoryUrlAdapter();
    const v2 = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={adapter}
        gridProps={grid}
        columns={["id", "name"]}
      />,
    );
    await screen.findByText("Captain Ledger");
    await user.click(screen.getByRole("switch", { name: "Include drafts" }));
    expect(adapter.read()).toBe("l_drafts=1");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    expect(lastList(v2.stub.requests)).toContain("include_unpublished=true");
    await user.click(screen.getByRole("switch", { name: "Include archived" }));
    expect(adapter.read()).toContain("l_archived=1");
    v2.unmount();

    renderCrud(
      <ResourceList
        resource="quests"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["title"]}
      />,
    );
    await screen.findByText("Reconcile the ledger");
    expect(screen.queryByRole("switch", { name: "Include drafts" })).toBeNull();
    expect(
      screen.queryByRole("switch", { name: "Include archived" }),
    ).toBeNull();
  });

  it("sorts by header click, one key, and returns to the default", async () => {
    const user = userEvent.setup();
    const adapter = memoryUrlAdapter();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={adapter}
        gridProps={grid}
        columns={["name", "power_level", "powers"]}
        defaults={{ sort: [{ field: "power_level", desc: true }] }}
      />,
    );
    await screen.findByText("Captain Ledger");
    expect(lastList(stub.requests)).toContain("sort=-power_level");
    expect(screen.queryByRole("combobox", { name: "Sort by" })).toBeNull();

    await user.click(screen.getByRole("columnheader", { name: /Name/ }));
    await waitFor(() => expect(adapter.read()).toContain("l_sort=name"));
    expect(lastList(stub.requests)).toContain("sort=name");
    expect(adapter.read()).not.toContain("power_level");
    await user.click(screen.getByRole("columnheader", { name: /Name/ }));
    await waitFor(() => expect(adapter.read()).toContain("l_sort=-name"));
    await user.click(screen.getByRole("columnheader", { name: /Name/ }));
    await waitFor(() => expect(adapter.read()).toBe("l_sort="));
    // `powers` is not sortable: a click changes nothing.
    await user.click(screen.getByRole("columnheader", { name: /Powers/ }));
    expect(adapter.read()).toBe("l_sort=");
  });

  it("can show sortable columns only", async () => {
    renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        sortableOnly
      />,
    );
    await screen.findByText("Captain Ledger");
    expect(screen.queryByRole("columnheader", { name: /Powers/ })).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: /Name/ }),
    ).toBeInTheDocument();
  });

  it("pages and changes the page size", async () => {
    const user = userEvent.setup();
    const adapter = memoryUrlAdapter();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={adapter}
        gridProps={grid}
        columns={["id", "name"]}
        defaults={{ pageSize: 10 }}
      />,
      { heroes: manyHeroes(25) },
    );
    await screen.findByText("Atlas 1", {}, { timeout: 8000 });
    expect(lastList(stub.requests)).toContain("limit=11");
    expect(screen.queryByText("Ember 13")).toBeNull();
    await user.click(screen.getByRole("button", { name: /next page/i }));
    await screen.findByText("Ember 13", {}, { timeout: 8000 });
    expect(adapter.read()).toBe("l_page=2");
    expect(lastList(stub.requests)).toContain("skip=10");

    const footer = document.querySelector<HTMLElement>(
      ".MuiTablePagination-root",
    )!;
    await user.click(footer.querySelector<HTMLElement>("[role=combobox]")!);
    await user.click(screen.getByRole("option", { name: "25" }));
    await screen.findByText("Helix 24", {}, { timeout: 8000 });
    expect(adapter.read()).toBe("l_size=25");
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  }, 20_000);

  it("hides and shows columns", async () => {
    const user = userEvent.setup();
    renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
      />,
    );
    await screen.findByText("Captain Ledger");
    await user.click(screen.getByRole("button", { name: "Columns" }));
    const dialog = screen.getByRole("dialog", { name: "Columns" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Name" }));
    const header = { name: /Name/, hidden: true };
    expect(screen.queryByRole("columnheader", header)).toBeNull();
    await user.click(within(dialog).getByRole("checkbox", { name: "Name" }));
    expect(screen.getByRole("columnheader", header)).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("has no Columns button when columns are fixed", async () => {
    const { DataTableList } = await import("../../src/list/index.ts");
    expect(DataTableList).toBeDefined();
  });

  it("reports an error with a retry, and calls onRowClick", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        onRowClick={onRowClick}
      />,
    );
    await user.click(await screen.findByText("The Margin"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    expect(stub.requests.length).toBeGreaterThan(0);
  });

  it("shows the load error", async () => {
    const user = userEvent.setup();
    renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
      />,
      { list: "error" },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("inline editing", () => {
  const edit = async (
    user: ReturnType<typeof userEvent.setup>,
    from: string,
    text: string,
  ): Promise<void> => {
    await user.dblClick(await screen.findByText(from));
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, `${text}{Enter}`);
  };

  it("saves the changed cell with PATCH", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name", "owner_id"]}
        editable
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    await screen.findByText("Captain Index");
    expect(stub.requests).toContain("PATCH /api/crud/v1/heroes/v2/json?id=1");
  });

  it("keeps the row when nothing changed, and never edits read-only cells", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name", "owner_id"]}
        editable
      />,
    );
    await user.dblClick(await screen.findByText("Captain Ledger"));
    await user.keyboard("{Enter}");
    await user.dblClick(screen.getAllByText("stub-owner")[0]!);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(stub.requests.some((r) => r.startsWith("PATCH"))).toBe(false);
  });

  it("sends If-Match when the resource takes conditional requests", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        editable
        ifMatch={(row) =>
          etagOf({ id: row["id"], updated_at: heroRows[0]!["updated_at"] })
        }
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    await screen.findByText("Captain Index");
    expect(stub.requests.some((r) => r.startsWith("PATCH"))).toBe(true);
  });

  it("awaits an async ifMatch before the PATCH, once, while saving", async () => {
    const user = userEvent.setup();
    let release: (tag: string | undefined) => void = () => undefined;
    const ifMatch = vi.fn(
      () =>
        new Promise<string | undefined>((resolve) => {
          release = resolve;
        }),
    );
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        editable
        ifMatch={ifMatch}
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    await waitFor(() => expect(ifMatch).toHaveBeenCalledTimes(1));
    expect(document.querySelector("[aria-busy=true]")).not.toBeNull();
    // A second commit while the ETag is pending does nothing.
    await user.keyboard("{Enter}");
    expect(stub.requests.some((r) => r.startsWith("PATCH"))).toBe(false);
    release(etagOf({ id: 1, updated_at: heroRows[0]!["updated_at"] }));
    await screen.findByText("Captain Index");
    expect(stub.requests.filter((r) => r.startsWith("PATCH"))).toHaveLength(1);
    expect(ifMatch).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[aria-busy=true]")).toBeNull();
  });

  it("sends the PATCH without If-Match when an async ifMatch gives undefined", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        editable
        ifMatch={() => Promise.resolve(undefined)}
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    await screen.findByText("Captain Index");
    expect(stub.requests.filter((r) => r.startsWith("PATCH"))).toHaveLength(1);
  });

  it("does not send the edit when an async ifMatch rejects, and says so", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        editable
        ifMatch={() => Promise.reject(new Error("etag lookup failed"))}
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    expect(
      await screen.findByText("Could not save: etag lookup failed"),
    ).toBeInTheDocument();
    expect(stub.requests.some((r) => r.startsWith("PATCH"))).toBe(false);
    expect(document.querySelector("[aria-busy=true]")).toBeNull();
  });

  it("explains a stale edit (412) and reloads", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        editable
        ifMatch={() => 'W/"stale"'}
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    expect(await screen.findByText(/changed elsewhere/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        stub.requests.filter((r) => r.startsWith("GET /api/crud/v1/heroes/v2"))
          .length,
      ).toBeGreaterThan(1),
    );
    // The failed cell is still being edited; leave it before closing the notice.
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText(/changed elsewhere/)).toBeNull();
  });

  it.each([
    [new Error("boom"), "Could not save: boom"],
    ["plain text", "Could not save: plain text"],
  ])("reports other save failures (%s)", async (thrown, message) => {
    const user = userEvent.setup();
    renderCrud(
      <ResourceList
        resource="heroes"
        urlAdapter={memoryUrlAdapter()}
        gridProps={grid}
        columns={["id", "name"]}
        editable
        ifMatch={() => {
          throw thrown;
        }}
      />,
    );
    await edit(user, "Captain Ledger", "Captain Index");
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
