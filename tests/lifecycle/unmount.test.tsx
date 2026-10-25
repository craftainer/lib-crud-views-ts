import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ArchiveButton,
  DiscardDraftButton,
  RestoreButton,
  PublishButton,
} from "../../src/lifecycle/index.ts";
import type { ReadyResource } from "../../src/core/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";

/** Shows `children(ready)` until "Hide" is clicked: a row that goes away while a request is in flight. */
function Hideable({
  ready,
  children,
}: {
  ready: ReadyResource;
  children: (ready: ReadyResource) => ReactElement;
}): ReactElement {
  const [hidden, setHidden] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setHidden(true)}>
        Hide
      </button>
      {hidden ? <span>row gone</span> : children(ready)}
    </>
  );
}

describe("a button whose row unmounts while its request is in flight", () => {
  it("DiscardDraftButton still calls onDone", async () => {
    const onDone = vi.fn();
    const { stub } = renderCrud(
      <Ready>
        {(ready) => (
          <Hideable ready={ready}>
            {(r) => <DiscardDraftButton ready={r} id={2} onDone={onDone} />}
          </Hideable>
        )}
      </Ready>,
      { heroes: lifecycleHeroes() },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard draft" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    // The open dialog hides the rest of the page from the accessibility tree.
    fireEvent.click(screen.getByRole("button", { name: "Hide", hidden: true }));
    await waitFor(() =>
      expect(stub.requests).toContain(
        "DELETE /api/crud/v1/heroes/v2/json?id=2",
      ),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it("ArchiveButton still calls onArchived and onDone", async () => {
    const onDone = vi.fn();
    const onArchived = vi.fn();
    renderCrud(
      <Ready>
        {(ready) => (
          <Hideable ready={ready}>
            {(r) => (
              <ArchiveButton
                ready={r}
                id={1}
                onDone={onDone}
                onArchived={onArchived}
              />
            )}
          </Hideable>
        )}
      </Ready>,
      { heroes: lifecycleHeroes(), softDelete: true },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(onArchived).toHaveBeenCalledOnce());
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("RestoreButton still calls onDone", async () => {
    const onDone = vi.fn();
    renderCrud(
      <Ready>
        {(ready) => (
          <Hideable ready={ready}>
            {(r) => <RestoreButton ready={r} id={3} onDone={onDone} />}
          </Hideable>
        )}
      </Ready>,
      { heroes: lifecycleHeroes() },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it("PublishButton still calls onDone", async () => {
    const onDone = vi.fn();
    renderCrud(
      <Ready>
        {(ready) => (
          <Hideable ready={ready}>
            {(r) => <PublishButton ready={r} id={2} onDone={onDone} />}
          </Hideable>
        )}
      </Ready>,
      { heroes: lifecycleHeroes() },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });
});
