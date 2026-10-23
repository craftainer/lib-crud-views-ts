import { BadRequest } from "@craftainer/crud-sdk";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BulkLimitError,
  BulkPanel,
  BulkRecords,
  BulkToolbar,
  describeBulkError,
  downloadText,
  toCsv,
  useBulkSelection,
  type BulkSelection,
} from "../../src/bulk/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { manyHeroes } from "../fixtures/routes/list.ts";
import { field, renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";
import { failedQuery, pendingQuery, withHooks } from "../hooks.ts";

const fresh = lifecycleHeroes;
const BASE = "/api/crud/v1/heroes/v2/json";

afterEach(() => vi.restoreAllMocks());

describe("useBulkSelection", () => {
  it("toggles ids, pages and the all-matching mode", () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => result.current.toggle(1));
    act(() => result.current.toggle(2));
    expect(result.current.selected).toEqual([1, 2]);
    expect(result.current.isSelected(2)).toBe(true);
    act(() => result.current.toggle(1));
    expect(result.current.selected).toEqual([2]);
    act(() => result.current.setPage([2, 3, 4], true));
    expect(result.current.selected).toEqual([2, 3, 4]);
    act(() => result.current.setPage([3], false));
    expect(result.current.selected).toEqual([2, 4]);
    act(() => result.current.selectAllMatching());
    expect(result.current.allMatching).toBe(true);
    expect(result.current.selected).toEqual([]);
    act(() => result.current.toggle(7));
    expect(result.current.allMatching).toBe(false);
    act(() => result.current.selectAllMatching());
    act(() => result.current.clear());
    expect(result.current).toMatchObject({ allMatching: false, selected: [] });
  });
});

describe("export helpers", () => {
  it("writes RFC 4180 CSV", () => {
    const fields = [field({ name: "a" }), field({ name: "b" })];
    expect(
      toCsv(fields, [
        { a: 'say "hi", ok', b: null },
        { a: ["x"], b: "line\nbreak" },
        { a: 1 },
      ]),
    ).toBe(
      'a,b\r\n"say ""hi"", ok",\r\n["x"],"line\nbreak"\r\n1,\r\n'.replace(
        '["x"]',
        '"[""x""]"',
      ),
    );
  });

  it("downloads text through an object URL", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    downloadText("x.csv", "a,b");
    downloadText("y.csv", "c", "text/plain");
    expect(create).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });
});

describe("describeBulkError", () => {
  it("explains the limit for a 400 and passes other errors through", () => {
    const bad = new BadRequest({ status: 400, title: "Bad Request" });
    expect(describeBulkError(bad, 1000)).toBe(
      "More than 1000 records match. Narrow the filter or select fewer records.",
    );
    expect(describeBulkError(new Error("down"), 1000)).toBe("down");
    expect(new BulkLimitError(5).message).toMatch(/More than 5/);
  });
});

const selectionOf = (over: Partial<BulkSelection>): BulkSelection => ({
  selected: [],
  allMatching: false,
  isSelected: () => false,
  toggle: vi.fn(),
  setPage: vi.fn(),
  selectAllMatching: vi.fn(),
  clear: vi.fn(),
  ...over,
});

describe("BulkRecords", () => {
  it("shows no toolbar until something is ticked, then counts", async () => {
    renderCrud(<BulkRecords resource="heroes" />, {
      heroes: fresh(),
      listDrafts: true,
    });
    await screen.findByText("Captain Ledger");
    expect(screen.queryByText(/ selected$/)).toBeNull();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select record 1" }),
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select all matching the filter" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear selection" }),
    );
    expect(screen.queryByText(/ selected$/)).toBeNull();
  });

  it("ticks a whole page through the header checkbox", async () => {
    renderCrud(<BulkRecords resource="heroes" columns={["name"]} />, {
      heroes: fresh(),
      listDrafts: true,
    });
    const all = await screen.findByRole("checkbox", {
      name: "Select all on this page",
    });
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select record 1" }),
    );
    expect(all).toHaveProperty("indeterminate", true);
    await userEvent.click(all);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(all);
    expect(screen.queryByText(/ selected$/)).toBeNull();
  });

  it("deletes the ticked records with id__in, after a confirmation", async () => {
    const onDone = vi.fn();
    const { stub } = renderCrud(
      <BulkRecords resource="heroes" onDone={onDone} />,
      { heroes: fresh(), listDrafts: true },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select record 2" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "2 records are deleted.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByText("Deleted 2 records.")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith({ action: "delete", count: 2 });
    expect(stub.requests).toContain(`DELETE ${BASE}?id__in=1,2`);
    expect(
      stub.requests.some((r) => /id=/.test(r) && r.startsWith("DELETE")),
    ).toBe(false);
  });

  it("says record when one is deleted", async () => {
    renderCrud(<BulkRecords resource="heroes" />, {
      heroes: fresh(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "1 record is deleted.",
    );
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByText("Deleted 1 record.")).toBeInTheDocument();
  });

  it("selects every record matching the filter and deletes by that filter", async () => {
    const { stub } = renderCrud(
      <BulkRecords
        resource="heroes"
        filters={{ name: { icontains: "captain" } }}
      />,
      { heroes: fresh(), listDrafts: true },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select all matching the filter" }),
    );
    expect(
      screen.getByText("All records matching the filter are selected"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select record 1" }),
    ).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Every record matching the filter is deleted.",
    );
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByText("Deleted 1 record.")).toBeInTheDocument();
    expect(stub.requests).toContain(`DELETE ${BASE}?name__icontains=captain`);
  });

  it("explains the limit when the server answers 400", async () => {
    const { stub } = renderCrud(
      <BulkRecords
        resource="heroes"
        filters={{ power_level: { min: 0 } }}
        limit={3}
      />,
      { heroes: manyHeroes(1001) },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select all matching the filter" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "More than 1000 records match. Narrow the filter or select fewer records.",
    );
    expect(stub.requests.filter((r) => r.startsWith("DELETE"))).toHaveLength(1);
    expect(screen.getByText(/All records matching/)).toBeInTheDocument();
  });

  it("exports the selected records as CSV", async () => {
    const onExport = vi.fn();
    const { stub } = renderCrud(
      <BulkRecords resource="heroes" onExport={onExport} />,
      { heroes: fresh(), listDrafts: true },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 2" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Exported 1 record.")).toBeInTheDocument();
    const [csv, filename] = onExport.mock.calls[0] as [string, string];
    expect(filename).toBe("heroes-export.csv");
    expect(csv).toContain("The Margin");
    expect(csv).not.toContain("Captain Ledger");
    expect(
      stub.requests.some((r) =>
        r.includes("id__in=2&skip=0&limit=100&include_unpublished=true"),
      ),
    ).toBe(true);
  });

  it("downloads the export when no handler is given", async () => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: () => "blob:x",
        revokeObjectURL: () => {},
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    renderCrud(<BulkRecords resource="heroes" />, {
      heroes: fresh(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await screen.findByText("Exported 1 record.");
    expect(click).toHaveBeenCalledOnce();
  });

  it("exports every record matching the filter, and refuses past the limit", async () => {
    const onExport = vi.fn();
    const first = renderCrud(
      <BulkRecords
        resource="heroes"
        filters={{ name: { icontains: "e" } }}
        onExport={onExport}
      />,
      { heroes: fresh(), listDrafts: true },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select all matching the filter" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Exported 2 records.")).toBeInTheDocument();
    first.unmount();
    renderCrud(
      <BulkRecords
        resource="heroes"
        filters={{ power_level: { min: 0 } }}
        limit={3}
        onExport={onExport}
      />,
      { heroes: manyHeroes(1001) },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select all matching the filter" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "More than 1000 records match",
    );
  });

  it("publishes the drafts among the selection", async () => {
    const onDone = vi.fn();
    const { stub } = renderCrud(
      <BulkRecords resource="heroes" onDone={onDone} />,
      { heroes: fresh(), listDrafts: true },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select record 2" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Published 1 record.")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith({ action: "publish", count: 1 });
    expect(stub.requests).toContain(`POST ${BASE}/publish?id=2`);
    expect(stub.requests).not.toContain(`POST ${BASE}/publish?id=1`);
  });

  it("publishes several drafts", async () => {
    const heroes = fresh().map((row) => ({ ...row, is_draft: true }));
    renderCrud(<BulkRecords resource="heroes" />, { heroes, listDrafts: true });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select all on this page" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Published 2 records.")).toBeInTheDocument();
  });

  it("offers only the actions asked for and only those the manifest allows", async () => {
    renderCrud(<BulkRecords resource="heroes" actions={["export"]} />, {
      heroes: fresh(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("has no Publish for a resource without drafts", async () => {
    renderCrud(<BulkRecords resource="quests" />);
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });

  it("passes renderers to the cells", async () => {
    const Shout = ({ value }: { value: unknown }) => (
      <b>{`!${String(value)}`}</b>
    );
    renderCrud(
      <BulkRecords
        resource="heroes"
        renderers={{ "heroes.name": { display: Shout as never } }}
      />,
      { heroes: fresh(), listDrafts: true },
    );
    expect(await screen.findByText("!Captain Ledger")).toBeInTheDocument();
  });
});

describe("BulkToolbar", () => {
  it("refuses a selection above bulk.max_matched without calling the server", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1);
    const { stub } = renderCrud(
      <Ready>
        {(ready) => (
          <BulkToolbar
            ready={ready}
            selection={selectionOf({ selected: ids })}
          />
        )}
      </Ready>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "More than 1000 records match",
    );
    expect(stub.requests.some((r) => r.startsWith("DELETE"))).toBe(false);
  });

  it("shows other failures as they are", async () => {
    renderCrud(
      <Ready>
        {(ready) => (
          <BulkToolbar
            ready={ready}
            selection={selectionOf({ allMatching: true })}
          />
        )}
      </Ready>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "a bulk operation needs at least one filter",
    );
  });
});

describe("BulkPanel states", () => {
  it("shows loading and error", async () => {
    const view = renderCrud(
      <Ready>
        {(ready) => (
          <BulkPanel ready={withHooks(ready, { useList: pendingQuery })} />
        )}
      </Ready>,
    );
    expect(await screen.findByLabelText("Loading")).toBeInTheDocument();
    view.unmount();
    renderCrud(
      <Ready>
        {(ready) => (
          <BulkPanel
            ready={withHooks(ready, { useList: failedQuery("list failed") })}
          />
        )}
      </Ready>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("list failed");
  });
});

function within_dialog_button(name: string): HTMLElement {
  const dialog = screen.getByRole("dialog");
  return Array.from(dialog.querySelectorAll("button")).find(
    (b) => b.textContent === name,
  ) as HTMLElement;
}
