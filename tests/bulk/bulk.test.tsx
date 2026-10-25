import { BadRequest, type JsonObject } from "@craftainer/crud-sdk";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BulkLimitError,
  BulkPanel,
  BulkRecords,
  BulkToolbar,
  describeBulkError,
  PartialPublishError,
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
    act(() => result.current.toggle(7, [5, 6, 7]));
    expect(result.current.allMatching).toBe(false);
    expect(result.current.selected).toEqual([5, 6]);
    // Without the visible ids the other matching records cannot be named.
    act(() => result.current.selectAllMatching());
    act(() => result.current.toggle(7));
    expect(result.current).toMatchObject({ allMatching: false, selected: [] });
    act(() => result.current.selectAllMatching());
    act(() => result.current.selectAllMatching());
    act(() => result.current.clear());
    expect(result.current).toMatchObject({ allMatching: false, selected: [] });
  });
});

describe("useBulkSelection with batched calls", () => {
  it("toggles against the latest state, not a stale closure", () => {
    const { result } = renderHook(() => useBulkSelection());
    const staleToggle = result.current.toggle;
    act(() => {
      result.current.selectAllMatching();
      staleToggle(7, [5, 6, 7]);
    });
    expect(result.current).toMatchObject({
      allMatching: false,
      selected: [5, 6],
    });
  });
});

describe("useBulkSelection no-ops", () => {
  it("keeps the same selection object when unticking nothing", () => {
    const { result } = renderHook(() => useBulkSelection());
    act(() => result.current.toggle(1));
    const before = result.current;
    act(() => result.current.setPage([9], false));
    expect(result.current).toBe(before);
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

  it("defuses cells a spreadsheet would read as formulas", () => {
    const fields = [field({ name: "a" })];
    expect(toCsv(fields, [{ a: "=SUM(A1)" }, { a: "-5" }, { a: -5 }])).toBe(
      "a\r\n'=SUM(A1)\r\n'-5\r\n-5\r\n",
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
    vi.useFakeTimers();
    downloadText("x.csv", "a,b");
    downloadText("y.csv", "c", "text/plain");
    expect(create).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
  });
});

describe("describeBulkError", () => {
  it("explains the limit for a 400 and passes other errors through", () => {
    const bad = new BadRequest({ status: 400, title: "Bad Request" });
    expect(describeBulkError(bad, 1000)).toBe(
      "400 Bad Request. A bulk call touches at most 1000 records; if the filter matches more, narrow it.",
    );
    expect(describeBulkError(new Error("down"), 1000)).toBe("down");
    expect(
      describeBulkError(new PartialPublishError([1, 3], 5, 4, bad), 1000),
    ).toBe("Published 2 of 5; failed at 4: 400 Bad Request");
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
      /A bulk call touches at most 1000 records/,
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

  it("lists drafts, so a draft can be ticked and published", async () => {
    const { stub } = renderCrud(<BulkRecords resource="heroes" />, {
      heroes: fresh(),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 2" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Published 1 record.")).toBeInTheDocument();
    expect(stub.requests).toContain(`POST ${BASE}/publish?id=2`);
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

  it("drops the selection when the filters change", async () => {
    const view = renderCrud(
      <BulkRecords
        resource="heroes"
        filters={{ name: { icontains: "captain" } }}
      />,
      { heroes: fresh() },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    view.rerender(<BulkRecords resource="heroes" />);
    await waitFor(() => expect(screen.queryByText(/ selected$/)).toBeNull());
  });

  it("forgets ticked records that left the data set", async () => {
    const view = renderCrud(<BulkRecords resource="heroes" />, {
      heroes: fresh(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select all on this page" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    // A smaller page: record 2 is no longer listed, so it is no longer selected.
    view.rerender(<BulkRecords resource="heroes" limit={1} />);
    await waitFor(() =>
      expect(screen.getByText("1 selected")).toBeInTheDocument(),
    );
  });

  /** A panel whose `publish` rejects for id 2 while `failing.on` holds. */
  const failingPublish = (
    failing: { on: boolean; reason?: unknown },
    props: Partial<ComponentProps<typeof BulkPanel>> = {},
  ) => (
    <Ready>
      {(ready) => {
        const handle = new Proxy(ready.handle, {
          get: (target, key) => {
            if (key === "publish") {
              return (id: number) =>
                id === 2 && failing.on
                  ? Promise.reject(
                      failing.reason ?? new Error("publish failed"),
                    )
                  : target.publish(id);
            }
            const value = Reflect.get(target, key, target) as unknown;
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        return <BulkPanel ready={{ ...ready, handle }} {...props} />;
      }}
    </Ready>
  );
  const allDrafts = (): JsonObject[] =>
    fresh().map((row) => ({ ...row, is_draft: true }));

  it("refreshes after a publish that fails part way, and says how far it got", async () => {
    const view = renderCrud(failingPublish({ on: true }), {
      heroes: allDrafts(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select all on this page" }),
    );
    const lists = (): number =>
      view.stub.requests.filter(
        (r) => r.startsWith("GET ") && r.includes("limit=25"),
      ).length;
    const before = lists();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Published 1 of 2; failed at 2: publish failed",
    );
    await waitFor(() => expect(lists()).toBeGreaterThan(before));
  });

  it("reports a rejection that is not an Error", async () => {
    renderCrud(failingPublish({ on: true, reason: "boom" }), {
      heroes: allDrafts(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select all on this page" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Published 1 of 2; failed at 2: boom",
    );
  });

  it("unticks the published ids so a retry covers only the rest", async () => {
    const failing = { on: true };
    const view = renderCrud(failingPublish(failing), {
      heroes: allDrafts(),
      listDrafts: true,
    });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select all on this page" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText(/Published 1 of 2; failed at 2/);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select record 1" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select record 2" }),
    ).toBeChecked();

    failing.on = false;
    view.stub.requests.length = 0;
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Published 1 record.")).toBeInTheDocument();
    expect(view.stub.requests).toContain(`POST ${BASE}/publish?id=2`);
    expect(view.stub.requests).not.toContain(`POST ${BASE}/publish?id=1`);
  });

  it("keeps an all-matching selection after a partial publish", async () => {
    renderCrud(
      failingPublish({ on: true }, { filters: { name: { icontains: "e" } } }),
      { heroes: allDrafts(), listDrafts: true },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select record 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Select all matching the filter" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Published 1 of 2; failed at 2: publish failed",
    );
    expect(
      screen.getByText("All records matching the filter are selected"),
    ).toBeInTheDocument();
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

  it("refuses an all-matching call once the filters are gone", async () => {
    const { stub } = renderCrud(
      <Ready>
        {(ready) => (
          <BulkToolbar
            ready={ready}
            selection={selectionOf({ allMatching: true })}
            filters={{}}
          />
        )}
      </Ready>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The filter was cleared",
    );
    expect(stub.requests.some((r) => r.startsWith("DELETE"))).toBe(false);
  });

  it("shows other failures as they are", async () => {
    renderCrud(
      <Ready>
        {(ready) => {
          const handle = new Proxy(ready.handle, {
            get: (target, key) => {
              if (key === "deleteMany") {
                return () => Promise.reject(new Error("the server is down"));
              }
              const value = Reflect.get(target, key, target) as unknown;
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          return (
            <BulkToolbar
              ready={{ ...ready, handle }}
              selection={selectionOf({ selected: [1] })}
            />
          );
        }}
      </Ready>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await userEvent.click(within_dialog_button("Delete"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "the server is down",
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
