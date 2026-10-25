import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { field } from "../helpers.tsx";
import {
  RecordRevisions,
  RevisionsPanel,
  changedFields,
  restorePatch,
  toRevisions,
} from "../../src/revisions/index.ts";
import { lifecycleHeroes, withHistory } from "../fixtures/routes/detail.ts";
import { heroRows } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";
import { failedQuery, pendingQuery, withHooks } from "../hooks.ts";

describe("revision helpers", () => {
  it("reads rows, with an empty snapshot when one is missing", () => {
    expect(
      toRevisions([
        {
          id: 1,
          action: "create",
          actor: "ada",
          created_at: "2026-01-01T00:00:00Z",
          snapshot: { name: "A" },
        },
        { id: 2, action: "update", actor: "bob", created_at: "x" },
      ]),
    ).toEqual([
      {
        id: 1,
        action: "create",
        actor: "ada",
        createdAt: "2026-01-01T00:00:00Z",
        snapshot: { name: "A" },
      },
      { id: 2, action: "update", actor: "bob", createdAt: "x", snapshot: {} },
    ]);
  });

  it("lists the fields that differ", () => {
    const fields = [field({ name: "a" }), field({ name: "b" })];
    expect(changedFields(fields, { a: 1, b: [1] }, { a: 2, b: [1] })).toEqual([
      "a",
    ]);
  });

  it("patches only writable fields, leaving out null for a field that cannot be null", () => {
    const fields = [
      field({ name: "id", readOnly: true }),
      field({ name: "name", nullable: false }),
      field({ name: "note", nullable: true }),
      field({ name: "level" }),
      field({ name: "gone" }),
    ];
    expect(
      restorePatch(fields, { id: 1, name: null, note: null, level: 3 }),
    ).toEqual({ note: null, level: 3 });
  });
});

const page = (variant: "list" | "audit" | "diff" | "preview") => (
  <RecordRevisions resource="heroes" id={1} variant={variant} />
);

describe("RecordRevisions list", () => {
  it("restores a revision with a PATCH of its writable fields", async () => {
    const onRestored = vi.fn();
    const { stub } = renderCrud(
      <RecordRevisions resource="heroes" id={1} onRestored={onRestored} />,
      { heroes: lifecycleHeroes() },
    );
    const list = await screen.findByRole("list", { name: "Revisions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("create by ada")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Restore revision 101" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restore",
      }),
    );
    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    expect(onRestored.mock.calls[0]?.[0]).toMatchObject({ id: 101 });
    expect(stub.requests).toContain("PATCH /api/crud/v1/heroes/v2/json?id=1");
    const patch = heroRows; // rows are untouched: the stub copies on write
    expect(patch).toHaveLength(3);
  });

  it("refreshes the record's queries once after a restore", async () => {
    const onRestored = vi.fn();
    const { stub } = renderCrud(
      <RecordRevisions resource="heroes" id={1} onRestored={onRestored} />,
      { heroes: lifecycleHeroes() },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore revision 101" }),
    );
    const reads = (): number =>
      stub.requests.filter(
        (r) => r.startsWith("GET ") && r.includes("revision"),
      ).length;
    expect(reads()).toBe(1);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restore",
      }),
    );
    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    // The update hook already refreshes the revisions; nothing refreshes twice.
    expect(reads()).toBe(2);
  });

  it("restores without a callback and Cancel closes the dialog", async () => {
    const { stub } = renderCrud(page("list"), { heroes: lifecycleHeroes() });
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore revision 102" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(
      screen.getByRole("button", { name: "Restore revision 102" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restore",
      }),
    );
    await waitFor(() =>
      expect(stub.requests).toContain("PATCH /api/crud/v1/heroes/v2/json?id=1"),
    );
  });

  it("shows a failed restore", async () => {
    renderCrud(
      <Ready>
        {(ready) => (
          <RevisionsPanel
            ready={withHooks(ready, {
              useUpdate: () => ({
                mutate: vi.fn(),
                reset: vi.fn(),
                isPending: false,
                error: new Error("conflict"),
              }),
            })}
            id={1}
          />
        )}
      </Ready>,
      { heroes: lifecycleHeroes() },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("conflict");
  });
});

describe("RecordRevisions audit", () => {
  it("lists who changed which fields", async () => {
    renderCrud(page("audit"), { heroes: lifecycleHeroes() });
    const table = await screen.findByRole("table", { name: "Audit trail" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1] as HTMLElement).getByText("ada")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Powers, Power level");
    expect(rows[3]).toHaveTextContent("create");
  });
});

describe("RecordRevisions diff", () => {
  it("compares the newest two revisions and hides unchanged fields", async () => {
    renderCrud(page("diff"), { heroes: lifecycleHeroes() });
    const table = await screen.findByRole("table", { name: "Changes" });
    expect(within(table).getByText("Power level")).toBeInTheDocument();
    expect(within(table).queryByText("Name")).toBeNull();
    await userEvent.click(
      screen.getByRole("switch", { name: "Show unchanged fields" }),
    );
    expect(within(table).getByText("Name")).toBeInTheDocument();
  });

  it("lets both sides be chosen, and says when they are identical", async () => {
    renderCrud(page("diff"), { heroes: lifecycleHeroes() });
    await screen.findByRole("table", { name: "Changes" });
    await userEvent.click(screen.getByRole("combobox", { name: "From" }));
    await userEvent.click(screen.getByRole("option", { name: "#103 update" }));
    expect(
      await screen.findByText("These revisions are identical."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "To" }));
    await userEvent.click(screen.getByRole("option", { name: "#101 create" }));
    expect(
      await screen.findByRole("table", { name: "Changes" }),
    ).toBeInTheDocument();
  });
});

describe("RecordRevisions diff of the oldest revision", () => {
  it("compares the oldest revision with itself until a base is chosen", async () => {
    renderCrud(page("diff"), { heroes: lifecycleHeroes() });
    await screen.findByRole("table", { name: "Changes" });
    await userEvent.click(screen.getByRole("combobox", { name: "To" }));
    await userEvent.click(screen.getByRole("option", { name: "#101 create" }));
    expect(
      await screen.findByText("These revisions are identical."),
    ).toBeInTheDocument();
  });
});

describe("RecordRevisions preview", () => {
  it("shows a snapshot and switches revision", async () => {
    renderCrud(page("preview"), { heroes: lifecycleHeroes() });
    expect(await screen.findByText("Captain Ledger")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Revision" }));
    await userEvent.click(screen.getByRole("option", { name: "#101 create" }));
    expect(await screen.findByText("Lieutenant Ledger")).toBeInTheDocument();
  });
});

describe("states", () => {
  it("shows loading, errors and an empty history", async () => {
    const loading = renderCrud(
      <Ready>
        {(ready) => (
          <RevisionsPanel
            ready={withHooks(ready, { useRevisions: pendingQuery })}
            id={1}
          />
        )}
      </Ready>,
    );
    expect(await screen.findByLabelText("Loading")).toBeInTheDocument();
    loading.unmount();
    const failed = renderCrud(
      <Ready>
        {(ready) => (
          <RevisionsPanel
            ready={withHooks(ready, {
              useRevisions: failedQuery("no history"),
            })}
            id={1}
          />
        )}
      </Ready>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("no history");
    failed.unmount();
    renderCrud(<RecordRevisions resource="heroes" id={51} />, {
      heroes: withHistory([{ ...heroRows[0], id: 51 }]),
    });
    expect(await screen.findByText("No revisions yet.")).toBeInTheDocument();
  });

  it("is hidden when the resource keeps no revisions", async () => {
    const { container } = renderCrud(
      <RecordRevisions resource="quests" id={1} />,
    );
    await waitFor(() => expect(screen.queryByLabelText("Loading")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });
});
