import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrashList, TrashPanel } from "../../src/lifecycle/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { manyHeroes } from "../fixtures/routes/list.ts";
import { renderCrud } from "../helpers.tsx";
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
    expect(stub.requests.some((r) => r.includes("include_archived=true"))).toBe(
      true,
    );
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

  it("renders nothing for a resource without an archive", async () => {
    const { container } = renderCrud(
      <Ready name="quests">{(ready) => <TrashPanel ready={ready} />}</Ready>,
    );
    await waitFor(() => expect(screen.queryByLabelText("Loading")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });
});
