import type { JsonObject } from "@craftainer/crud-sdk";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeleteAction,
  type DeleteActionProps,
  type DisplayRendererProps,
} from "../../src/index.ts";
import { heroRows, type StubOptions } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";

const fresh = (): JsonObject[] => heroRows.map((r) => ({ ...r }));
const HEROES = "/api/crud/v1/heroes/v2/json";

function setup(props: Partial<DeleteActionProps> = {}, stub: StubOptions = {}) {
  const heroes = fresh();
  const view = renderCrud(<DeleteAction name="heroes" id={1} {...props} />, {
    heroes,
    ...stub,
  });
  return { ...view, heroes, user: userEvent.setup() };
}

const calls = (view: { stub: { requests: string[] } }, method: string) =>
  view.stub.requests.filter((r) => r.startsWith(`${method} `));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DeleteAction", () => {
  it("deletes at once", async () => {
    const onDeleted = vi.fn();
    const view = setup({ variant: "immediate", onDeleted });
    await view.user.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1));
    expect(calls(view, "DELETE")).toEqual([`DELETE ${HEROES}?id=1`]);
  });

  it("renders nothing while the manifest loads or fails", async () => {
    const pending = setup({}, { manifest: "pending" });
    expect(pending.container).toBeEmptyDOMElement();
    pending.unmount();
    const down = setup({}, { manifest: "down" });
    await waitFor(() => expect(down.stub.requests.length).toBeGreaterThan(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(down.container).toBeEmptyDOMElement();
  });

  it("asks first, showing the record through the renderers, and can be cancelled", async () => {
    const Shout = ({ value }: DisplayRendererProps) => (
      <b>{String(value).toUpperCase()}</b>
    );
    const view = setup({
      label: "Remove",
      recordLabel: "hero",
      renderers: { "heroes.name": { display: Shout } },
    });
    await view.user.click(
      await screen.findByRole("button", { name: "Remove hero 1" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Delete hero 1?",
    });
    expect(await screen.findByText("CAPTAIN LEDGER")).toBeInTheDocument();
    expect(dialog).toBeVisible();
    await view.user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls(view, "DELETE")).toHaveLength(0);
  });

  it("deletes after the confirmation, with chosen summary fields", async () => {
    const onDeleted = vi.fn();
    const view = setup({ summaryFields: ["power_level"], onDeleted });
    await view.user.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    expect(await screen.findByText("72")).toBeInTheDocument();
    expect(screen.queryByText("Captain Ledger")).toBeNull();
    await view.user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls(view, "DELETE")).toHaveLength(1);
  });

  it("holds an undo deletion back until the time is up", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onDeleted = vi.fn();
    const view = setup({ variant: "undo", undoMs: 500, onDeleted });
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    expect(screen.getByText("Deleting record 1…")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete record 1" }),
    ).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(calls(view, "DELETE")).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(200));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1));
    expect(calls(view, "DELETE")).toHaveLength(1);
    expect(screen.queryByText(/Deleting record 1/)).toBeNull();
  });

  it("cancels an undo deletion", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onUndone = vi.fn();
    const view = setup({ variant: "undo", onUndone });
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndone).toHaveBeenCalledWith(1);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(calls(view, "DELETE")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Delete record 1" }),
    ).toBeEnabled();
  });

  it("keeps the waiting toast through Escape, so the deletion stays undoable", async () => {
    const onUndone = vi.fn();
    const view = setup({ variant: "undo", undoMs: 600_000, onUndone });
    await view.user.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    await screen.findByText("Deleting record 1…");
    await view.user.keyboard("{Escape}");
    await view.user.click(document.body);
    await view.user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndone).toHaveBeenCalledWith(1);
  });

  it("commits a waiting undo deletion when the button goes away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = setup({ variant: "undo" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    view.unmount();
    await waitFor(() => expect(calls(view, "DELETE")).toHaveLength(1));
  });

  it("leaves nothing behind when it goes away with no deletion waiting", async () => {
    const view = setup({ variant: "undo" });
    await screen.findByRole("button", { name: "Delete record 1" });
    view.unmount();
    expect(calls(view, "DELETE")).toHaveLength(0);
  });

  describe("a failed delayed deletion", () => {
    it("calls onDeleteError when the window has passed", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const onDeleteError = vi.fn();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      setup({ id: 99, variant: "undo", undoMs: 100, onDeleteError });
      fireEvent.click(
        await screen.findByRole("button", { name: "Delete record 99" }),
      );
      await act(() => vi.advanceTimersByTimeAsync(150));
      await waitFor(() => expect(onDeleteError).toHaveBeenCalledOnce());
      expect(onDeleteError).toHaveBeenCalledWith(99, expect.any(Error));
      expect(onDeleteError.mock.calls[0]?.[1]).toHaveProperty(
        "message",
        "404 Not found",
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("calls it after unmount, where no toast can show the failure", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const onDeleteError = vi.fn();
      const view = setup({ id: 99, variant: "undo", onDeleteError });
      fireEvent.click(
        await screen.findByRole("button", { name: "Delete record 99" }),
      );
      view.unmount();
      await waitFor(() => expect(onDeleteError).toHaveBeenCalledOnce());
      expect(onDeleteError).toHaveBeenCalledWith(99, expect.any(Error));
      expect(calls(view, "DELETE")).toEqual([`DELETE ${HEROES}?id=99`]);
    });

    it("logs with console.error when there is no onDeleteError", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const view = setup({ id: 99, variant: "undo" });
      fireEvent.click(
        await screen.findByRole("button", { name: "Delete record 99" }),
      );
      view.unmount();
      await waitFor(() => expect(error).toHaveBeenCalledOnce());
      expect(error.mock.calls[0]?.[0]).toBe("Could not delete record 99");
      expect(error.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    });

    it("logs the failure when onDeleteError itself throws", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const onDeleteError = vi.fn(() => {
        throw new Error("callback broke");
      });
      const view = setup({ id: 99, variant: "undo", onDeleteError });
      fireEvent.click(
        await screen.findByRole("button", { name: "Delete record 99" }),
      );
      view.unmount();
      await waitFor(() => expect(error).toHaveBeenCalledTimes(2));
      expect(error.mock.calls[0]?.[0]).toBe("Could not delete record 99");
      expect(error.mock.calls[1]?.[0]).toBe("onDeleteError threw");
    });

    it("wraps a rejection that is not an Error", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const onDeleteError = vi.fn();
      const view = setup({ variant: "undo", undoMs: 100, onDeleteError });
      vi.spyOn(view.queryClient.getMutationCache(), "build").mockImplementation(
        () => {
          throw "plain";
        },
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Delete record 1" }),
      );
      await act(() => vi.advanceTimersByTimeAsync(150));
      await waitFor(() => expect(onDeleteError).toHaveBeenCalledOnce());
      expect(onDeleteError.mock.calls[0]?.[1]).toHaveProperty(
        "message",
        "Could not delete",
      );
    });

    it("does not call onDeleteError for an immediate delete, which shows the alert", async () => {
      const onDeleteError = vi.fn();
      const view = setup({ id: 99, variant: "immediate", onDeleteError });
      await view.user.click(
        await screen.findByRole("button", { name: "Delete record 99" }),
      );
      await screen.findByRole("alert");
      expect(onDeleteError).not.toHaveBeenCalled();
    });
  });

  it("reports a failed deletion and lets the alert be closed", async () => {
    const view = setup({ id: 99, variant: "immediate" });
    await view.user.click(
      await screen.findByRole("button", { name: "Delete record 99" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not found");
    await view.user.click(within(alert).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await view.user.click(
      screen.getByRole("button", { name: "Delete record 99" }),
    );
    await screen.findByRole("alert");
    await view.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("reports an error that is not an Error object", async () => {
    const view = setup({ variant: "immediate" });
    vi.spyOn(view.queryClient.getMutationCache(), "build").mockImplementation(
      () => {
        throw "plain";
      },
    );
    await view.user.click(
      await screen.findByRole("button", { name: "Delete record 1" }),
    );
    expect(await screen.findByText("Could not delete")).toBeInTheDocument();
  });

  describe("soft", () => {
    it("moves the record to the trash and restores it on Undo", async () => {
      const onDeleted = vi.fn();
      const onUndone = vi.fn();
      const view = setup(
        { variant: "soft", onDeleted, onUndone },
        { softDelete: true },
      );
      await view.user.click(
        await screen.findByRole("button", { name: "Delete record 1" }),
      );
      expect(await screen.findByText("Record archived")).toBeInTheDocument();
      expect(onDeleted).toHaveBeenCalledWith(1);
      expect(view.heroes[0]?.["archived_at"]).not.toBeNull();
      await view.user.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => expect(onUndone).toHaveBeenCalledWith(1));
      expect(calls(view, "POST")).toEqual([`POST ${HEROES}/restore?id=1`]);
      expect(view.heroes[0]?.["archived_at"]).toBeNull();
    });

    it("keeps the toast on a click elsewhere and closes it on Escape", async () => {
      const view = setup({ variant: "soft" }, { softDelete: true });
      await view.user.click(
        await screen.findByRole("button", { name: "Delete record 1" }),
      );
      await screen.findByText("Record archived");
      await view.user.click(document.body);
      expect(screen.getByText("Record archived")).toBeInTheDocument();
      await view.user.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.queryByText("Record archived")).toBeNull(),
      );
    });

    it("shows no Undo toast when the deletion failed", async () => {
      const view = setup({ variant: "soft", id: 99 }, { softDelete: true });
      await view.user.click(
        await screen.findByRole("button", { name: "Delete record 99" }),
      );
      await screen.findByRole("alert");
      expect(screen.queryByText(/Record archived/)).toBeNull();
    });

    it("reports a failed restore", async () => {
      const view = setup({ variant: "soft" }, { softDelete: true });
      await view.user.click(
        await screen.findByRole("button", { name: "Delete record 1" }),
      );
      await screen.findByText("Record archived");
      view.stub.tables.get(HEROES)?.splice(0, 1);
      await view.user.click(screen.getByRole("button", { name: "Undo" }));
      expect(await screen.findByText(/Not found/)).toBeInTheDocument();
    });

    it("is hidden for a resource without archive and restore", async () => {
      const view = renderCrud(
        <DeleteAction name="quests" id={1} variant="soft" />,
      );
      await waitFor(() => expect(calls(view, "GET").length).toBeGreaterThan(0));
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
