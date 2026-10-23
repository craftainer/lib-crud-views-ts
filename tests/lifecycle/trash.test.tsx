import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrashList, TrashPanel } from "../../src/lifecycle/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { renderCrud } from "../helpers.tsx";
import { Ready } from "../support-vw3.tsx";
import { failedQuery, pendingQuery, withHooks } from "../hooks-vw3.ts";

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
    expect(stub.requests).toContain(
      "GET /api/crud/v1/heroes/v2/json?include_archived=true",
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
    renderCrud(
      <Ready>
        {(ready) => (
          <TrashPanel
            ready={withHooks(ready, {
              useList: () => ({
                isPending: false,
                error: null,
                data: [{ id: 99, name: "Ghost", archived_at: "2026-01-01" }],
              }),
            })}
          />
        )}
      </Ready>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore record 99" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });

  it("takes a column list", async () => {
    renderCrud(<TrashList resource="heroes" columns={["power_level"]} />, {
      heroes: fresh(),
    });
    expect(await screen.findByText("18")).toBeInTheDocument();
    expect(screen.queryByText("Old Stamp")).toBeNull();
  });

  it("shows loading and error states and hides itself without an archive", async () => {
    const view = renderCrud(
      <Ready>
        {(ready) => (
          <TrashPanel ready={withHooks(ready, { useList: pendingQuery })} />
        )}
      </Ready>,
    );
    expect(await screen.findByLabelText("Loading")).toBeInTheDocument();
    view.unmount();
    renderCrud(
      <Ready>
        {(ready) => (
          <TrashPanel
            ready={withHooks(ready, { useList: failedQuery("list failed") })}
          />
        )}
      </Ready>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("list failed");
  });

  it("renders nothing for a resource without an archive", async () => {
    const { container } = renderCrud(
      <Ready name="quests">{(ready) => <TrashPanel ready={ready} />}</Ready>,
    );
    await waitFor(() => expect(screen.queryByLabelText("Loading")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });
});
