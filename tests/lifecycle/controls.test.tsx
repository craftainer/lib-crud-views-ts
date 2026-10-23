import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ArchiveButton,
  ArchivedToggle,
  DiscardDraftButton,
  DraftControls,
  PublishButton,
  RestoreButton,
  StatusBadge,
  StatusFilter,
} from "../../src/lifecycle/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";

const heroes = lifecycleHeroes();
const [live, draft, archived] = heroes as [
  (typeof heroes)[number],
  (typeof heroes)[number],
  (typeof heroes)[number],
];

describe("StatusBadge", () => {
  it("shows the state of a record", async () => {
    renderCrud(
      <Ready>
        {(ready) => (
          <>
            <StatusBadge ready={ready} record={live} />
            <StatusBadge ready={ready} record={draft} />
            <StatusBadge ready={ready} record={archived} />
          </>
        )}
      </Ready>,
    );
    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("is hidden when the resource has neither drafts nor an archive", async () => {
    renderCrud(
      <Ready name="quests">
        {(ready) => (
          <>
            <span>ready</span>
            <StatusBadge ready={ready} record={live} />
            <DraftControls ready={ready} record={draft} id={2} />
            <PublishButton ready={ready} id={2} />
            <DiscardDraftButton ready={ready} id={2} />
            <ArchiveButton ready={ready} id={2} />
            <RestoreButton ready={ready} id={2} />
            <ArchivedToggle ready={ready} checked={false} onChange={vi.fn()} />
            <StatusFilter ready={ready} value="all" onChange={vi.fn()} />
          </>
        )}
      </Ready>,
    );
    await screen.findByText("ready");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Published")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
  });
});

describe("DraftControls", () => {
  it("publishes a draft", async () => {
    const onChanged = vi.fn();
    const { stub } = renderCrud(
      <Ready>
        {(ready) => (
          <DraftControls
            ready={ready}
            record={draft}
            id={2}
            onChanged={onChanged}
          />
        )}
      </Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(stub.requests).toContain(
      "POST /api/crud/v1/heroes/v2/json/publish?id=2",
    );
  });

  it("offers nothing for a published record but its badge", async () => {
    renderCrud(
      <Ready>
        {(ready) => <DraftControls ready={ready} record={live} id={1} />}
      </Ready>,
    );
    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("works without a callback and shows a failed publish", async () => {
    renderCrud(
      <Ready>{(ready) => <PublishButton ready={ready} id={99} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });

  it("publishes without a callback", async () => {
    const { stub } = renderCrud(
      <Ready>{(ready) => <PublishButton ready={ready} id={2} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    );
    await waitFor(() =>
      expect(stub.requests).toContain(
        "POST /api/crud/v1/heroes/v2/json/publish?id=2",
      ),
    );
  });
});

describe("DiscardDraftButton", () => {
  it("deletes the draft after a confirmation", async () => {
    const onDone = vi.fn();
    const { stub } = renderCrud(
      <Ready>
        {(ready) => <DiscardDraftButton ready={ready} id={2} onDone={onDone} />}
      </Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard draft" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(stub.requests).toContain("DELETE /api/crud/v1/heroes/v2/json?id=2");
  });

  it("keeps the dialog open with the error when the delete fails, and Cancel closes it", async () => {
    renderCrud(
      <Ready>{(ready) => <DiscardDraftButton ready={ready} id={99} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard draft" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByText(/Not found/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("discards without a callback", async () => {
    renderCrud(
      <Ready>{(ready) => <DiscardDraftButton ready={ready} id={2} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard draft" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("StatusFilter", () => {
  it("reports the chosen status and ignores a click on the current one", async () => {
    const onChange = vi.fn();
    renderCrud(
      <Ready>
        {(ready) => (
          <StatusFilter ready={ready} value="all" onChange={onChange} />
        )}
      </Ready>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Draft" }));
    expect(onChange).toHaveBeenCalledWith("draft");
    onChange.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ArchivedToggle", () => {
  it("reports the switch", async () => {
    const onChange = vi.fn();
    renderCrud(
      <Ready>
        {(ready) => (
          <ArchivedToggle ready={ready} checked={false} onChange={onChange} />
        )}
      </Ready>,
    );
    await userEvent.click(
      await screen.findByRole("switch", { name: "Show archived" }),
    );
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("ArchiveButton", () => {
  it("archives and offers Undo, which restores", async () => {
    const onDone = vi.fn();
    const { stub } = renderCrud(
      <Ready>
        {(ready) => <ArchiveButton ready={ready} id={1} onDone={onDone} />}
      </Ready>,
      { heroes, softDelete: true },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Archive" }),
    );
    expect(await screen.findByText("Record archived")).toBeInTheDocument();
    expect(stub.requests).toContain("DELETE /api/crud/v1/heroes/v2/json?id=1");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(stub.requests).toContain(
        "POST /api/crud/v1/heroes/v2/json/restore?id=1",
      ),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(2));
  });

  it("restores without a callback, closes on Escape and shows errors", async () => {
    renderCrud(
      <Ready>{(ready) => <ArchiveButton ready={ready} id={1} />}</Ready>,
      { heroes, softDelete: true },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Archive" }),
    );
    await screen.findByText("Record archived");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(screen.queryByText("Record archived")).toBeNull(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await screen.findByText("Record archived");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText("Record archived")).toBeNull(),
    );
  });

  it("shows the server's refusal", async () => {
    renderCrud(
      <Ready>{(ready) => <ArchiveButton ready={ready} id={99} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Archive" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });
});

describe("RestoreButton", () => {
  it("restores an archived record", async () => {
    const onDone = vi.fn();
    const { stub } = renderCrud(
      <Ready>
        {(ready) => <RestoreButton ready={ready} id={3} onDone={onDone} />}
      </Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore" }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(stub.requests).toContain(
      "POST /api/crud/v1/heroes/v2/json/restore?id=3",
    );
  });

  it("restores without a callback and shows a failure", async () => {
    renderCrud(
      <Ready>{(ready) => <RestoreButton ready={ready} id={99} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });

  it("restores quietly when it works", async () => {
    const { stub } = renderCrud(
      <Ready>{(ready) => <RestoreButton ready={ready} id={3} />}</Ready>,
      { heroes },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore" }),
    );
    await waitFor(() =>
      expect(stub.requests).toContain(
        "POST /api/crud/v1/heroes/v2/json/restore?id=3",
      ),
    );
  });
});
