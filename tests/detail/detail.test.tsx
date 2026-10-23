import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordDetail, DetailPanel } from "../../src/detail/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";
import { failedQuery, pendingQuery, withHooks } from "../hooks.ts";

const fresh = lifecycleHeroes;

describe("RecordDetail page", () => {
  it("shows the fields of a record and not the system ones", async () => {
    renderCrud(<RecordDetail resource="heroes" id={1} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Heroes #1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Captain Ledger")).toBeInTheDocument();
    expect(screen.getByText("Power level")).toBeInTheDocument();
    expect(screen.queryByText("Owner id")).toBeNull();
  });

  it("takes a title and passes renderers to the fields", async () => {
    const Shout = ({ value }: { value: unknown }) => (
      <b>{`!${String(value)}`}</b>
    );
    renderCrud(
      <RecordDetail
        resource="heroes"
        id={1}
        title="Ledger"
        renderers={{ "heroes.name": { display: Shout as never } }}
      />,
    );
    expect(await screen.findByText("!Captain Ledger")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ledger" })).toBeInTheDocument();
  });

  it("shows loading and error states", async () => {
    const view = renderCrud(
      <Ready>
        {(ready) => (
          <DetailPanel
            ready={withHooks(ready, { useRecord: pendingQuery })}
            id={1}
          />
        )}
      </Ready>,
    );
    expect(await screen.findByLabelText("Loading")).toBeInTheDocument();
    view.unmount();
    const missing = renderCrud(<RecordDetail resource="heroes" id={99} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
    missing.unmount();
    renderCrud(
      <Ready>
        {(ready) => (
          <DetailPanel
            ready={withHooks(ready, { useRecord: failedQuery("boom") })}
            id={1}
          />
        )}
      </Ready>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});

describe("RecordDetail form", () => {
  it("mounts the form from renderForm", async () => {
    const renderForm = vi.fn(({ id, onDone }) => (
      <button onClick={onDone}>{`form ${id}`}</button>
    ));
    renderCrud(
      <RecordDetail
        resource="heroes"
        id={1}
        variant="form"
        renderForm={renderForm}
      />,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "form 1" }),
    );
    expect(renderForm.mock.calls[0]?.[0]).toMatchObject({ id: 1 });
  });

  it("falls back to the fields without renderForm", async () => {
    renderCrud(<RecordDetail resource="heroes" id={1} variant="form" />);
    expect(await screen.findByText("Captain Ledger")).toBeInTheDocument();
  });
});

describe("RecordDetail metadata", () => {
  it("shows the system fields in their own panel", async () => {
    renderCrud(<RecordDetail resource="heroes" id={1} variant="metadata" />);
    expect(
      await screen.findByRole("heading", { name: "Metadata" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Owner id")).toBeInTheDocument();
    expect(screen.getByText("stub-owner")).toBeInTheDocument();
  });
});

describe("RecordDetail tabs", () => {
  it("switches between details, metadata and history", async () => {
    renderCrud(<RecordDetail resource="heroes" id={1} variant="tabs" />, {
      heroes: lifecycleHeroes(),
    });
    expect(await screen.findByText("Captain Ledger")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    expect(screen.getByText("Owner id")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(
      await screen.findByRole("table", { name: "Audit trail" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByText("Captain Ledger")).toBeInTheDocument();
  });

  it("has no history tab without revisions", async () => {
    renderCrud(<RecordDetail resource="quests" id={1} variant="tabs" />);
    await screen.findByRole("tab", { name: "Details" });
    expect(screen.queryByRole("tab", { name: "History" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  });
});

describe("RecordDetail dialog and drawer", () => {
  it.each(["dialog", "drawer"] as const)(
    "%s closes through onClose",
    async (variant) => {
      const onClose = vi.fn();
      renderCrud(
        <RecordDetail
          resource="heroes"
          id={1}
          variant={variant}
          onClose={onClose}
        />,
      );
      const shell = await screen.findByRole(
        variant === "dialog" ? "dialog" : "presentation",
      );
      expect(
        await within(shell).findByText("Captain Ledger"),
      ).toBeInTheDocument();
      await userEvent.click(
        within(shell).getByRole("button", { name: "Close" }),
      );
      expect(onClose).toHaveBeenCalled();
    },
  );

  it("closes without an onClose and stays hidden when closed", async () => {
    const view = renderCrud(
      <RecordDetail resource="heroes" id={1} variant="dialog" />,
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    view.unmount();
    renderCrud(
      <RecordDetail resource="heroes" id={1} variant="dialog" open={false} />,
    );
    await waitFor(() => expect(screen.queryByLabelText("Loading")).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("lifecycle actions", () => {
  it("publishes a draft and refreshes", async () => {
    const onChanged = vi.fn();
    const { stub } = renderCrud(
      <RecordDetail resource="heroes" id={2} onChanged={onChanged} />,
      { heroes: fresh() },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(stub.requests).toContain(
      "POST /api/crud/v1/heroes/v2/json/publish?id=2",
    );
  });

  it("archives a record and refreshes without a callback", async () => {
    const { stub } = renderCrud(<RecordDetail resource="heroes" id={1} />, {
      heroes: fresh(),
      softDelete: true,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Archive" }),
    );
    expect(await screen.findByText("Record archived")).toBeInTheDocument();
    expect(stub.requests).toContain("DELETE /api/crud/v1/heroes/v2/json?id=1");
  });

  it("offers Restore for an archived record", async () => {
    const { stub } = renderCrud(<RecordDetail resource="heroes" id={3} />, {
      heroes: fresh(),
    });
    const restore = await screen.findByRole("button", { name: "Restore" });
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    await userEvent.click(restore);
    await waitFor(() =>
      expect(stub.requests).toContain(
        "POST /api/crud/v1/heroes/v2/json/restore?id=3",
      ),
    );
  });
});
