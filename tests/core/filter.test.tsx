import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import {
  FieldFilterInput,
  isFilterable,
  withOp,
  type FieldFilter,
  type FieldDescriptor,
} from "../../src/core/index.ts";
import { field } from "../helpers.tsx";

function Host({
  f,
  initial,
  seen,
}: {
  f: FieldDescriptor;
  initial?: FieldFilter | undefined;
  seen: (FieldFilter | undefined)[];
}): ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <FieldFilterInput
      field={f}
      resource="r"
      value={value}
      onChange={(v) => {
        seen.push(v);
        setValue(v);
      }}
    />
  );
}

const setup = (f: Partial<FieldDescriptor>, initial?: FieldFilter) => {
  const seen: (FieldFilter | undefined)[] = [];
  const view = render(
    <Host f={field({ label: "Thing", ...f })} initial={initial} seen={seen} />,
  );
  return { seen, user: userEvent.setup(), view };
};

describe("withOp / isFilterable", () => {
  it("sets and removes operators", () => {
    expect(withOp(undefined, "min", 1)).toEqual({ min: 1 });
    expect(withOp({ min: 1 }, "max", 5)).toEqual({ min: 1, max: 5 });
    expect(withOp({ min: 1 }, "min", undefined)).toBeUndefined();
    expect(withOp({ in: ["a"], eq: "b" }, "in", [])).toEqual({ eq: "b" });
  });

  it("excludes fields without operators, and nothing else", () => {
    expect(isFilterable(field({ filterOps: ["eq"] }))).toBe(true);
    expect(isFilterable(field({ filterOps: [] }))).toBe(false);
    // The key field is left out by the views, which know its name, not here.
    expect(isFilterable(field({ name: "id", filterOps: ["eq"] }))).toBe(true);
  });
});

describe("filter renderers", () => {
  it("filters strings with the most forgiving operator", async () => {
    const a = setup({
      kind: "string",
      filterOps: ["eq", "icontains", "contains"],
    });
    await a.user.type(screen.getByLabelText("Thing"), "ad");
    expect(a.seen.at(-1)).toEqual({ icontains: "ad" });
    await a.user.clear(screen.getByLabelText("Thing"));
    expect(a.seen.at(-1)).toBeUndefined();
    a.view.unmount();
    const b = setup({ kind: "string", filterOps: ["contains"] });
    await b.user.type(screen.getByLabelText("Thing"), "x");
    expect(b.seen.at(-1)).toEqual({ contains: "x" });
  });

  it("renders nothing when no operator applies", () => {
    for (const kind of [
      "string",
      "number",
      "boolean",
      "enum",
      "date",
      "datetime",
      "array",
      "json",
    ] as const) {
      const { view } = setup({ kind, filterOps: ["regex"] });
      expect(view.container).toBeEmptyDOMElement();
      view.unmount();
    }
    const { view } = setup({ kind: "number", filterOps: [] });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("filters numbers by range", async () => {
    const a = setup({ kind: "integer", filterOps: ["eq", "min", "max"] });
    await a.user.type(screen.getByLabelText("Thing from"), "3");
    await a.user.type(screen.getByLabelText("Thing to"), "9");
    expect(a.seen.at(-1)).toEqual({ min: 3, max: 9 });
    await a.user.clear(screen.getByLabelText("Thing from"));
    expect(a.seen.at(-1)).toEqual({ max: 9 });
    a.view.unmount();
    const b = setup({ kind: "number", filterOps: ["eq"] });
    await b.user.type(screen.getByLabelText("Thing"), "2");
    expect(b.seen.at(-1)).toEqual({ eq: 2 });
  });

  it("filters dates by range as YYYY-MM-DD strings", async () => {
    const a = setup(
      { kind: "date", filterOps: ["min", "max"] },
      { min: "2026-01-01" },
    );
    expect(screen.getByLabelText("Thing from")).toHaveValue("2026-01-01");
    await a.user.type(screen.getByLabelText("Thing to"), "2026-02-03");
    expect(a.seen.at(-1)).toEqual({ min: "2026-01-01", max: "2026-02-03" });
  });

  it("filters datetimes by range as Dates", async () => {
    const a = setup(
      { kind: "datetime", filterOps: ["min"] },
      { min: new Date("2026-01-01T10:20:00Z") },
    );
    expect(screen.getByLabelText("Thing from")).toHaveValue("2026-01-01T10:20");
    await a.user.clear(screen.getByLabelText("Thing from"));
    await a.user.type(screen.getByLabelText("Thing from"), "2026-02-03T04:05");
    expect(a.seen.at(-1)).toEqual({ min: new Date("2026-02-03T04:05:00Z") });
    a.view.unmount();
    setup(
      { kind: "datetime", filterOps: ["min"] },
      { min: new Date(Number.NaN) },
    );
    expect(screen.getByLabelText("Thing from")).toHaveValue("");
  });

  it("filters booleans with Any, Yes and No", async () => {
    const a = setup({ kind: "boolean", filterOps: ["eq"] });
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "Yes" }));
    expect(a.seen.at(-1)).toEqual({ eq: true });
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "No" }));
    expect(a.seen.at(-1)).toEqual({ eq: false });
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "Any" }));
    expect(a.seen.at(-1)).toBeUndefined();
  });

  it("filters enums with several choices (in)", async () => {
    const a = setup({
      kind: "enum",
      choices: ["easy", "hard"],
      filterOps: ["eq", "in"],
    });
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "Easy" }));
    await a.user.click(screen.getByRole("option", { name: "Hard" }));
    expect(a.seen.at(-1)).toEqual({ in: ["easy", "hard"] });
    await a.user.click(screen.getByRole("option", { name: "Easy" }));
    await a.user.click(screen.getByRole("option", { name: "Hard" }));
    expect(a.seen.at(-1)).toBeUndefined();
  });

  it("filters enums with one choice (eq) when `in` is unavailable", async () => {
    const a = setup({ kind: "enum", choices: ["easy"], filterOps: ["eq"] });
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "Easy" }));
    expect(a.seen.at(-1)).toEqual({ eq: "easy" });
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "Any" }));
    expect(a.seen.at(-1)).toBeUndefined();
    a.view.unmount();
    setup(
      { kind: "enum", filterOps: ["in"], label: "Nochoice" },
      { in: "bad" as unknown as string[] },
    );
    expect(
      screen.getByRole("combobox", { name: "Nochoice" }),
    ).toBeInTheDocument();
  });

  it("renders nothing for kinds the manifest cannot filter", () => {
    const { view } = setup({ kind: "array", filterOps: ["eq"] });
    expect(view.container).toBeEmptyDOMElement();
  });
});
