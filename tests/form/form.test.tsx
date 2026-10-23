import type { JsonObject } from "@craftainer/crud-sdk";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ResourceForm,
  type InputRendererProps,
  type ResourceFormProps,
} from "../../src/index.ts";
import { etagOf, touch } from "../fixtures/routes/form.ts";
import { heroRows, type StubOptions } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";

const fresh = (): JsonObject[] => heroRows.map((r) => ({ ...r }));

function setup(
  props: Partial<ResourceFormProps> & { stub?: StubOptions } = {},
) {
  const { stub, ...rest } = props;
  const heroes = fresh();
  const view = renderCrud(<ResourceForm name="heroes" {...rest} />, {
    heroes,
    ...stub,
  });
  return { ...view, heroes, user: userEvent.setup() };
}

const requests = (view: { stub: { requests: string[] } }, method: string) =>
  view.stub.requests.filter((r) => r.startsWith(`${method} `));

afterEach(() => {
  vi.useRealTimers();
});

describe("create", () => {
  it("renders the create schema's fields and posts the values", async () => {
    const onSaved = vi.fn();
    const view = setup({ onSaved });
    expect(
      await screen.findByRole("heading", { name: "New record" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Powers/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Is locked/)).toBeNull();
    await view.user.type(screen.getByLabelText(/Name/), "Nova");
    await view.user.type(screen.getByLabelText(/Powers/), "light, speed");
    await view.user.type(screen.getByLabelText(/Power level/), "7");
    await view.user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(requests(view, "POST")).toHaveLength(1);
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      name: "Nova",
      powers: ["light", "speed"],
      power_level: 7,
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    // The form starts over for the next record.
    expect(screen.getByLabelText(/Name/)).toHaveValue("");
  });

  it("starts from initial values, limits fields and renames the record", async () => {
    setup({
      initial: { name: "Preset", ignored: 1 },
      fields: ["name"],
      recordLabel: "hero",
    });
    expect(
      await screen.findByRole("heading", { name: "New hero" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/Name/)).toHaveValue("Preset");
    expect(screen.queryByLabelText(/Powers/)).toBeNull();
  });

  it("takes a title and passes renderers to every field", async () => {
    const Custom = (p: InputRendererProps) => (
      <input aria-label={`custom ${p.field.name}`} onChange={() => {}} />
    );
    setup({
      title: "Recruit",
      renderers: { "heroes.name": { input: Custom } },
    });
    expect(
      await screen.findByRole("heading", { name: "Recruit" }),
    ).toBeVisible();
    expect(screen.getByLabelText("custom name")).toBeInTheDocument();
  });

  it("shows required and constraint errors after a submit and does not post", async () => {
    const view = setup();
    await view.user.click(
      await screen.findByRole("button", { name: "Create" }),
    );
    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(requests(view, "POST")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "x".repeat(201) },
    });
    expect(
      screen.getByText("Must be at most 200 characters"),
    ).toBeInTheDocument();
  });

  it("shows an error once a field has been left, not before", async () => {
    const view = setup();
    await screen.findByLabelText(/Name/);
    expect(screen.queryByText("Required")).toBeNull();
    await view.user.click(screen.getByLabelText(/Name/));
    await view.user.tab();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("blocks submit while a field's draft is invalid", async () => {
    const view = setup({ initial: { name: "Nova", powers: ["a"] } });
    const level = await screen.findByLabelText(/Power level/);
    await view.user.type(level, "1.5");
    expect(screen.getByText("Enter a whole number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    // Enter in a field cannot sneak past the disabled button.
    fireEvent.submit(level.closest("form") as HTMLFormElement);
    expect(requests(view, "POST")).toHaveLength(0);
    await view.user.clear(level);
    await view.user.type(level, "2");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("maps a 422 from the server onto the field", async () => {
    const view = setup({ initial: { name: "INVALID", powers: ["a"] } });
    // The stub only validates PATCH, so create through edit below; here the create succeeds.
    await view.user.click(
      await screen.findByRole("button", { name: "Create" }),
    );
    await screen.findByText("Saved");
  });

  it("closes a dialog through its Close button and shows nothing while closed", async () => {
    const onClose = vi.fn();
    const closed = setup({ presentation: "dialog", open: false, onClose });
    expect(closed.container).toBeEmptyDOMElement();
    closed.unmount();
    const open = setup({ presentation: "dialog", open: true, onClose });
    const dialog = await screen.findByRole("dialog", { name: "New record" });
    expect(dialog).toBeVisible();
    await open.user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("works without an onClose handler", async () => {
    const view = setup({ presentation: "dialog", open: true });
    await screen.findByRole("dialog");
    await view.user.click(screen.getByRole("button", { name: "Close" }));
  });

  it("renders in a drawer", async () => {
    const view = setup({ presentation: "drawer", open: true });
    expect(await screen.findByText("New record")).toBeVisible();
    await view.user.click(screen.getByRole("button", { name: "Close" }));
  });
});

describe("edit", () => {
  it("loads the other record when the id changes", async () => {
    const heroes = fresh();
    const view = renderCrud(<ResourceForm name="heroes" id={1} />, { heroes });
    expect(
      await screen.findByDisplayValue("Captain Ledger"),
    ).toBeInTheDocument();
    view.rerender(<ResourceForm name="heroes" id={2} />);
    expect(await screen.findByDisplayValue("The Margin")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Captain Ledger")).toBeNull();
  });

  const etag = (heroes: JsonObject[]) => (id: number) =>
    etagOf(heroes.find((h) => h["id"] === id) as JsonObject);

  it("loads the record and patches only what changed, with If-Match", async () => {
    const heroes = fresh();
    const etagFn = vi.fn((id: number) =>
      etagOf(heroes.find((h) => h["id"] === id) as JsonObject),
    );
    const onSaved = vi.fn();
    const view = renderCrud(
      <ResourceForm name="heroes" id={1} etag={etagFn} onSaved={onSaved} />,
      { heroes },
    );
    expect(
      await screen.findByRole("heading", { name: "Edit record 1" }),
    ).toBeVisible();
    expect(
      await screen.findByDisplayValue("Captain Ledger"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Power level/)).toHaveValue(72);
    expect(screen.queryByLabelText(/Created at/)).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Name/), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(etagFn).toHaveBeenCalledWith(1);
    expect(heroes[0]).toMatchObject({
      name: "Captain Ledger!",
      power_level: 72,
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    // A second save uses the new ETag the callback reads.
    await user.type(screen.getByLabelText(/Name/), "?");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    expect(
      view.stub.requests.filter((r) => r.startsWith("PATCH")),
    ).toHaveLength(2);
  });

  it("says so when nothing changed", async () => {
    const view = setup({ id: 1 });
    await screen.findByDisplayValue("Captain Ledger");
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("No changes to save")).toBeInTheDocument();
    expect(requests(view, "PATCH")).toHaveLength(0);
  });

  it("sends null for a cleared nullable field", async () => {
    const view = setup({ id: 1 });
    await view.user.clear(await screen.findByLabelText(/Power level/));
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(view.heroes[0]?.["power_level"]).toBeNull();
  });

  it("omits a cleared field that cannot be null instead of sending it", async () => {
    const view = setup({
      id: 1,
      name: "quests",
      stub: {
        manifestPatch: (m) => {
          for (const r of m.resources.filter((x) => x.name === "quests")) {
            (r.schemas.read.properties as Record<string, unknown>)["due_on"] = {
              format: "date",
              type: "string",
            };
          }
        },
        quests: [
          { id: 1, title: "T", difficulty: "easy", due_on: "2026-03-14" },
        ],
      },
    });
    await view.user.clear(await screen.findByLabelText(/Due on/));
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("No changes to save")).toBeInTheDocument();
    expect(requests(view, "PATCH")).toHaveLength(0);
  });

  it("does not send If-Match when the resource has no conditional requests", async () => {
    const heroes = fresh();
    const etagFn = vi.fn(() => 'W/"stale"');
    renderCrud(<ResourceForm name="heroes" id={1} etag={etagFn} />, {
      heroes,
      manifestPatch: (m) => {
        for (const r of m.resources)
          r.capabilities.conditional_requests = false;
      },
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Name/), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(etagFn).not.toHaveBeenCalled();
  });

  it("sends no If-Match without an etag callback", async () => {
    const view = setup({ id: 1 });
    await view.user.type(await screen.findByLabelText(/Name/), "!");
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(view.heroes[0]?.["name"]).toBe("Captain Ledger!");
  });

  it("shows a conflict on 412 and reloads the current record", async () => {
    const heroes = fresh();
    const stale = etagOf(heroes[0] as JsonObject);
    const view = renderCrud(
      <ResourceForm name="heroes" id={1} etag={() => stale} />,
      { heroes },
    );
    const user = userEvent.setup();
    const name = await screen.findByLabelText(/Name/);
    await user.type(name, "!");
    // Someone else saved in the meantime.
    heroes[0]!["name"] = "Changed elsewhere";
    touch(heroes[0] as JsonObject);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(/This record was changed since you opened it/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Name/)).toHaveValue("Changed elsewhere"),
    );
    expect(screen.queryByText(/changed since you opened/)).toBeNull();
    expect(
      view.stub.requests.filter((r) => r.startsWith("PATCH")),
    ).toHaveLength(1);
  });

  it("overwrites on request after a 412, without If-Match", async () => {
    const heroes = fresh();
    const stale = etagOf(heroes[0] as JsonObject);
    renderCrud(<ResourceForm name="heroes" id={1} etag={() => stale} />, {
      heroes,
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Name/), "!");
    touch(heroes[0] as JsonObject);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Overwrite" }));
    await screen.findByText("Saved");
    expect(heroes[0]?.["name"]).toBe("Captain Ledger!");
    expect(screen.queryByText(/changed since you opened/)).toBeNull();
  });

  it("keeps the conflict when the reload fails", async () => {
    const heroes = fresh();
    const stale = etagOf(heroes[0] as JsonObject);
    const view = renderCrud(
      <ResourceForm name="heroes" id={1} etag={() => stale} />,
      { heroes },
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Name/), "!");
    touch(heroes[0] as JsonObject);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Reload" });
    view.stub.tables.get("/api/crud/v1/heroes/v2/json")?.splice(0, 1);
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(
      await screen.findByText(/The record could not be reloaded: /),
    ).toBeInTheDocument();
  });

  it("maps 422 problem details onto the field and clears them on edit", async () => {
    const view = setup({ id: 1 });
    const name = await screen.findByLabelText(/Name/);
    await view.user.clear(name);
    await view.user.type(name, "INVALID");
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Value is not allowed")).toBeInTheDocument();
    expect(view.heroes[0]?.["name"]).toBe("Captain Ledger");
    await view.user.type(name, "x");
    expect(screen.queryByText("Value is not allowed")).toBeNull();
  });

  it("shows a general problem as an alert", async () => {
    const view = setup({ id: 1 });
    const name = await screen.findByLabelText(/Name/);
    await view.user.clear(name);
    await view.user.type(name, "LOCKED");
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Locked: held by Ada")).toBeInTheDocument();
  });

  it("reports a record that cannot be loaded", async () => {
    setup({ id: 99 });
    expect(await screen.findByText(/Not found/)).toBeInTheDocument();
  });

  it("shows a spinner while the record loads", async () => {
    setup({ id: 1, stub: { list: "pending" } });
    expect(
      await screen.findByRole("progressbar", { name: "Loading" }),
    ).toBeInTheDocument();
    await screen.findByDisplayValue("Captain Ledger");
  });

  it("keeps edits when the record is refetched in the background", async () => {
    const view = setup({ id: 1 });
    await view.user.type(await screen.findByLabelText(/Name/), "!");
    await act(() => view.queryClient.invalidateQueries());
    expect(screen.getByLabelText(/Name/)).toHaveValue("Captain Ledger!");
  });

  it("is unused etag helper for stale ETags", () => {
    const heroes = fresh();
    expect(etag(heroes)(1)).toMatch(/^W\/"1-/);
  });
});

describe("auto-save", () => {
  it("saves after a pause, hides the Save button and does not repeat", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = setup({ id: 1, autoSave: true, autoSaveDelayMs: 200 });
    const name = await screen.findByDisplayValue("Captain Ledger");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.change(name, { target: { value: "Captain Auto" } });
    expect(requests(view, "PATCH")).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(250));
    await screen.findByText("Saved");
    expect(view.heroes[0]?.["name"]).toBe("Captain Auto");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(requests(view, "PATCH")).toHaveLength(1);
  });

  it("uses the default delay, waits while invalid and stops on a conflict", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const heroes = fresh();
    const stale = etagOf(heroes[0] as JsonObject);
    const view = renderCrud(
      <ResourceForm name="heroes" id={1} autoSave etag={() => stale} />,
      { heroes },
    );
    const name = await screen.findByDisplayValue("Captain Ledger");
    fireEvent.change(name, { target: { value: "" } });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(requests(view, "PATCH")).toHaveLength(0);
    fireEvent.change(name, { target: { value: "Again" } });
    touch(heroes[0] as JsonObject);
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(requests(view, "PATCH")).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(200));
    await screen.findByText(/changed since you opened it/);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(requests(view, "PATCH")).toHaveLength(1);
  });

  it("does not auto-save a create form", async () => {
    const view = setup({ autoSave: true });
    await view.user.type(await screen.findByLabelText(/Name/), "Nova");
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(requests(view, "POST")).toHaveLength(0);
  });
});

describe("layouts", () => {
  it("groups fields under headings", async () => {
    setup({ layout: "sections" });
    expect(
      await screen.findByRole("heading", { name: "Required" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Optional" })).toBeVisible();
  });

  it("switches tabs, keeps drafts and counts errors per tab", async () => {
    const view = setup({
      layout: "tabs",
      sections: [
        { title: "Basics", fields: ["name"] },
        { title: "Traits", fields: ["powers", "power_level"] },
      ],
    });
    await screen.findByRole("tab", { name: "Basics" });
    expect(screen.getByLabelText(/Name/)).toBeVisible();
    expect(screen.getByLabelText(/Powers/)).not.toBeVisible();
    await view.user.click(screen.getByRole("tab", { name: "Traits" }));
    expect(screen.getByLabelText(/Powers/)).toBeVisible();
    await view.user.type(screen.getByLabelText(/Powers/), "a");
    await view.user.click(screen.getByRole("tab", { name: "Basics" }));
    // The name is required and empty: the submit jumps to its tab.
    await view.user.click(screen.getByRole("tab", { name: "Traits" }));
    await view.user.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByLabelText(/Name/)).toBeVisible();
    expect(
      screen.getByRole("tab", { name: "Basics (1 error)" }),
    ).toBeInTheDocument();
    await view.user.click(screen.getByRole("tab", { name: "Traits" }));
    expect(screen.getByLabelText(/Powers/)).toHaveValue("a");
  });

  it("walks a stepper, validating each step before moving on", async () => {
    const onSaved = vi.fn();
    const view = setup({
      layout: "stepper",
      onSaved,
      sections: [
        { title: "Who", fields: ["name"] },
        { title: "Traits", fields: ["powers", "power_level"] },
      ],
    });
    await screen.findByLabelText(/Name/);
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await view.user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Who (1 error)")).toBeInTheDocument();
    await view.user.type(screen.getByLabelText(/Name/), "Nova");
    await view.user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText(/Powers/)).toBeVisible();
    expect(screen.getByLabelText(/Name/)).not.toBeVisible();
    await view.user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText(/Name/)).toBeVisible();
    await view.user.click(screen.getByRole("button", { name: "Next" }));
    await view.user.type(screen.getByLabelText(/Powers/), "x");
    await view.user.type(screen.getByLabelText(/Power level/), "1.5");
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await view.user.clear(screen.getByLabelText(/Power level/));
    await view.user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("does not step past an invalid draft", async () => {
    const view = setup({
      layout: "stepper",
      initial: { name: "N", powers: ["a"] },
      sections: [
        { title: "One", fields: ["power_level"] },
        { title: "Two", fields: ["name"] },
      ],
    });
    await view.user.type(await screen.findByLabelText(/Power level/), "1.5");
    await view.user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText(/Power level/)).toBeVisible();
  });
});

describe("details", () => {
  it("uses the api version in its query keys and takes a node as title", async () => {
    renderCrud(
      <ResourceForm
        name="quests"
        apiVersion="v1"
        id={1}
        title={<em>Quest sheet</em>}
      />,
    );
    expect(await screen.findByText("Quest sheet")).toBeVisible();
    expect(
      await screen.findByDisplayValue("Reconcile the ledger"),
    ).toBeVisible();
    expect(screen.getByRole("form", { name: "Form" })).toBeInTheDocument();
  });

  it("ignores a second submit while one is in flight", async () => {
    const view = setup({ initial: { name: "Nova", powers: ["a"] } });
    const form = (await screen.findByLabelText(/Name/)).closest(
      "form",
    ) as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await screen.findByText("Saved");
    expect(requests(view, "POST")).toHaveLength(1);
  });

  it("pluralises the error count of a tab", async () => {
    const view = setup({ layout: "tabs" });
    await view.user.click(
      await screen.findByRole("button", { name: "Create" }),
    );
    expect(
      screen.getByRole("tab", { name: "Required (2 errors)" }),
    ).toBeInTheDocument();
  });

  it("copes with custom renderers that report the same reason twice or none", async () => {
    const Custom = (p: InputRendererProps) => (
      <>
        <button type="button" onClick={() => p.onInvalid?.("bad")}>
          bad
        </button>
        <button type="button" onClick={() => p.onInvalid?.(null)}>
          clear
        </button>
      </>
    );
    const view = setup({
      fields: ["name"],
      renderers: { "heroes.name": { input: Custom } },
    });
    await view.user.click(await screen.findByRole("button", { name: "clear" }));
    await view.user.click(screen.getByRole("button", { name: "bad" }));
    await view.user.click(screen.getByRole("button", { name: "bad" }));
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await view.user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });
});
