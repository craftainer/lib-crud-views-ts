import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrashList, TrashPanel } from "../../src/lifecycle/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { manyHeroes } from "../fixtures/routes/list.ts";
import { CrudProvider } from "../../src/core/index.ts";
import { createStubClient } from "../fixtures/stub.ts";
import { newQueryClient, renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";

const fresh = lifecycleHeroes;

describe("TrashList", () => {
  it("lists archived records and restores one", async () => {
    const onRestored = vi.fn();
    const { stub } = renderCrud(
      <TrashList resource="heroes" onRestored={onRestored} />,
      { heroes: fresh() },
    );
    expect(await screen.findByText("Old Stamp")).toBeInTheDocument();
    expect(screen.queryByText("The Margin")).toBeNull();
    // The server picks the archived rows: no client-side filtering, and no
    // `include_archived=false` to clash with `only_archived`.
    expect(stub.requests.some((r) => r.includes("only_archived=true"))).toBe(
      true,
    );
    expect(
      stub.requests.some((r) => r.includes("include_archived=false")),
    ).toBe(false);
    await userEvent.click(
      screen.getByRole("button", { name: "Restore record 3" }),
    );
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(3));
    expect(await screen.findByText("The trash is empty.")).toBeInTheDocument();
  });

  it("restores without a callback and shows a failed restore", async () => {
    renderCrud(<TrashList resource="heroes" />, {
      heroes: fresh().map((row) => ({
        ...row,
        archived_at: row["archived_at"],
      })),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore record 3" }),
    );
    await screen.findByText("The trash is empty.");
  });

  it("shows the restore error", async () => {
    const view = renderCrud(<TrashList resource="heroes" />, {
      heroes: fresh(),
    });
    const button = await screen.findByRole("button", {
      name: "Restore record 3",
    });
    view.stub.tables.get("/api/crud/v1/heroes/v2/json")?.splice(2, 1);
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });

  it("takes a column list", async () => {
    renderCrud(<TrashList resource="heroes" columns={["power_level"]} />, {
      heroes: fresh(),
    });
    expect(await screen.findByText("18")).toBeInTheDocument();
    expect(screen.queryByText("Old Stamp")).toBeNull();
  });

  it("shows loading and error states", async () => {
    const view = renderCrud(<TrashList resource="heroes" />, {
      list: "pending",
    });
    expect(await screen.findByLabelText("Loading")).toBeInTheDocument();
    view.unmount();
    renderCrud(<TrashList resource="heroes" />, { list: "error" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
  });

  it("lists an archived draft too", async () => {
    const heroes = fresh().map((row) =>
      row["id"] === 3 ? { ...row, is_draft: true } : row,
    );
    renderCrud(<TrashList resource="heroes" />, { heroes });
    expect(await screen.findByText("Old Stamp")).toBeInTheDocument();
  });

  it("finds archived records on every page", async () => {
    const heroes = manyHeroes(120).map((row, i) =>
      i >= 110
        ? { ...row, is_draft: false, archived_at: "2026-02-01T12:00:00Z" }
        : row,
    );
    renderCrud(<TrashList resource="heroes" />, { heroes });
    expect(
      await screen.findAllByRole("button", { name: /^Restore/ }),
    ).toHaveLength(10);
  });

  it("shows when a record was archived in the viewer's locale and zone", async () => {
    renderCrud(
      <TrashList resource="heroes" />,
      { heroes: fresh() },
      { locale: "en-US", timeZone: "Asia/Tokyo" },
    );
    const when = await screen.findByText(/Feb 1, 2026/);
    expect(when).toHaveAttribute("datetime", "2026-02-01T12:00:00.000Z");
    expect(when).toHaveTextContent(/9:00\s?PM/);
    expect(screen.queryByText("2026-02-01T12:00:00Z")).toBeNull();
  });

  it("keeps an unparseable archive time as it came", async () => {
    const heroes = fresh().map((row) =>
      row["id"] === 3 ? { ...row, archived_at: "sometime" } : row,
    );
    renderCrud(<TrashList resource="heroes" />, { heroes });
    expect(await screen.findByText("sometime")).toBeInTheDocument();
  });

  it("does not show one caller's trash to another sharing the query cache", async () => {
    const queryClient = newQueryClient();
    const as = (
      scope: string,
      stub: ReturnType<typeof createStubClient>,
    ): React.ReactElement => (
      <CrudProvider
        client={stub.client}
        queryClient={queryClient}
        scope={scope}
      >
        <TrashList resource="heroes" />
      </CrudProvider>
    );
    const a = createStubClient({ heroes: fresh() });
    const view = render(as("a", a));
    expect(await screen.findByText("Old Stamp")).toBeInTheDocument();
    // The second caller's trash never answers: it must wait, not borrow the first's rows.
    const b = createStubClient({ list: "pending" });
    view.rerender(as("b", b));
    await waitFor(() =>
      expect(b.requests.some((r) => r.includes("only_archived"))).toBe(true),
    );
    expect(screen.queryByText("Old Stamp")).toBeNull();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders nothing for a resource without an archive", async () => {
    const { container } = renderCrud(
      <Ready name="quests">{(ready) => <TrashPanel ready={ready} />}</Ready>,
    );
    await waitFor(() => expect(screen.queryByLabelText("Loading")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });
});
