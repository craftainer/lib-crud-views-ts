import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  FieldInput,
  emptyValue,
  type FieldDescriptor,
  type FieldValue,
} from "../../src/core/index.ts";
import { field } from "../helpers.tsx";

/** Controlled host that records every emitted value. */
function Host({
  f,
  initial,
  emitted,
  extra,
}: {
  f: FieldDescriptor;
  initial?: FieldValue | undefined;
  emitted: FieldValue[];
  extra?: Record<string, unknown> | undefined;
}): ReactElement {
  const [value, setValue] = useState<FieldValue>(initial);
  return (
    <FieldInput
      field={f}
      resource="r"
      value={value}
      onChange={(v) => {
        emitted.push(v);
        setValue(v);
      }}
      {...extra}
    />
  );
}

const setup = (
  f: Partial<FieldDescriptor>,
  initial?: FieldValue,
  extra?: Record<string, unknown> | undefined,
) => {
  const emitted: FieldValue[] = [];
  render(
    <Host
      f={field({ label: "Thing", ...f })}
      initial={initial}
      emitted={emitted}
      extra={extra}
    />,
  );
  return { emitted, user: userEvent.setup() };
};

describe("emptyValue", () => {
  it("is null for nullable fields and undefined otherwise", () => {
    expect(emptyValue(field({ nullable: true }))).toBeNull();
    expect(emptyValue(field())).toBeUndefined();
  });
});

describe("input renderers", () => {
  it("edits strings and clears to undefined or null", async () => {
    const a = setup({ kind: "string", required: true }, "x");
    expect(screen.getByLabelText(/Thing/)).toHaveValue("x");
    await a.user.type(screen.getByLabelText(/Thing/), "y");
    expect(a.emitted.at(-1)).toBe("xy");
    await a.user.clear(screen.getByLabelText(/Thing/));
    expect(a.emitted.at(-1)).toBeUndefined();
  });

  it("clears a nullable string to null, and renders email, url and long text variants", async () => {
    const a = setup(
      { kind: "string", nullable: true, format: "email" },
      "a@b.c",
    );
    expect(screen.getByLabelText("Thing")).toHaveAttribute("type", "email");
    await a.user.clear(screen.getByLabelText("Thing"));
    expect(a.emitted.at(-1)).toBeNull();
    setup({ kind: "string", format: "uri", label: "Link" });
    expect(screen.getByLabelText("Link")).toHaveAttribute("type", "url");
    setup({
      kind: "string",
      label: "Bio",
      constraints: { ...field().constraints, maxLength: 500 },
    });
    expect(screen.getByLabelText("Bio").tagName).toBe("TEXTAREA");
  });

  it("shows errors and helper text, and passes id, blur and disabled through", async () => {
    const onBlur = vi.fn();
    const a = setup({ kind: "string" }, "", {
      error: "Too short",
      onBlur,
      id: "the-id",
      autoFocus: true,
    });
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.getByLabelText("Thing")).toHaveAttribute("id", "the-id");
    expect(screen.getByLabelText("Thing")).toHaveFocus();
    await a.user.tab();
    expect(onBlur).toHaveBeenCalled();
    setup({ kind: "string", label: "Other" }, "", {
      helperText: "Hint",
      disabled: true,
    });
    expect(screen.getByText("Hint")).toBeInTheDocument();
    expect(screen.getByLabelText("Other")).toBeDisabled();
  });

  it("edits numbers, with integer steps and bounds", async () => {
    const a = setup(
      {
        kind: "integer",
        nullable: true,
        constraints: { ...field().constraints, minimum: 0, maximum: 9 },
      },
      3,
    );
    const input = screen.getByLabelText("Thing");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAttribute("min", "0");
    await a.user.type(input, "4");
    expect(a.emitted.at(-1)).toBe(34);
    await a.user.clear(input);
    expect(a.emitted.at(-1)).toBeNull();
    setup({ kind: "number", label: "Ratio" });
    expect(screen.getByLabelText("Ratio")).toHaveAttribute("step", "any");
  });

  it("toggles booleans", async () => {
    const a = setup({ kind: "boolean" }, false);
    await a.user.click(screen.getByRole("switch", { name: "Thing" }));
    expect(a.emitted.at(-1)).toBe(true);
    setup({ kind: "boolean", label: "Off" }, undefined, {
      disabled: true,
      size: "medium",
    });
    expect(screen.getByRole("switch", { name: "Off" })).toBeDisabled();
  });

  it("edits dates as YYYY-MM-DD", async () => {
    const a = setup({ kind: "date", nullable: true }, "2026-03-14T00:00:00Z");
    const input = screen.getByLabelText("Thing");
    expect(input).toHaveValue("2026-03-14");
    await a.user.clear(input);
    expect(a.emitted.at(-1)).toBeNull();
    await a.user.type(input, "2026-05-06");
    expect(a.emitted.at(-1)).toBe("2026-05-06");
  });

  it("edits datetimes as UTC ISO strings", async () => {
    const a = setup(
      { kind: "datetime", nullable: true },
      "2026-01-02T09:30:00Z",
    );
    const input = screen.getByLabelText("Thing");
    expect(input).toHaveValue("2026-01-02T09:30");
    expect(screen.getByText("UTC")).toBeInTheDocument();
    await a.user.clear(input);
    expect(a.emitted.at(-1)).toBeNull();
    await a.user.type(input, "2026-05-06T07:08");
    expect(a.emitted.at(-1)).toBe("2026-05-06T07:08:00.000Z");
    setup({ kind: "datetime", label: "Zoneless" }, "2026-01-02T09:30:00");
    expect(screen.getByLabelText("Zoneless")).toHaveValue("2026-01-02T09:30");
    setup({ kind: "datetime", label: "Bad" }, "garbage", { error: "no" });
    expect(screen.getByLabelText("Bad")).toHaveValue("");
  });

  it("ignores a datetime the browser accepts but ISO-8601 cannot write", () => {
    const a = setup({ kind: "datetime" }, "2026-01-02T09:30:00Z");
    // `datetime-local` takes years beyond 9999; `toISOString` would need a sign.
    fireEvent.change(screen.getByLabelText("Thing"), {
      target: { value: "275760-09-13T00:01" },
    });
    expect(a.emitted).toEqual([]);
    expect(screen.getByLabelText("Thing")).toHaveValue("2026-01-02T09:30");
  });

  it("picks enum choices and offers None only when optional", async () => {
    const a = setup({ kind: "enum", choices: ["easy", "very_hard"] }, "easy");
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
    await a.user.click(screen.getByRole("option", { name: "Very hard" }));
    expect(a.emitted.at(-1)).toBe("very_hard");
    await a.user.click(screen.getByRole("combobox", { name: "Thing" }));
    await a.user.click(screen.getByRole("option", { name: "None" }));
    expect(a.emitted.at(-1)).toBeUndefined();
  });

  it("requires a choice when the field is required, and tolerates missing choices", async () => {
    const a = setup(
      { kind: "enum", choices: ["a"], required: true, label: "Req" },
      undefined,
    );
    await a.user.click(screen.getByRole("combobox", { name: /Req/ }));
    expect(screen.queryByRole("option", { name: "None" })).toBeNull();
    setup({ kind: "enum", label: "Nochoice", required: true });
    expect(
      screen.getByRole("combobox", { name: /Nochoice/ }),
    ).toBeInTheDocument();
  });

  it("edits arrays as comma-separated text, and follows outside changes", async () => {
    const a = setup({ kind: "array", itemKind: "string", nullable: true }, [
      "a",
      "b",
    ]);
    const input = screen.getByLabelText("Thing");
    expect(input).toHaveValue("a, b");
    await a.user.type(input, ", c");
    expect(a.emitted.at(-1)).toEqual(["a", "b", "c"]);
    await a.user.clear(input);
    expect(a.emitted.at(-1)).toBeNull();
    expect(screen.getByText("Separate items with commas")).toBeInTheDocument();
    const n = setup(
      { kind: "array", itemKind: "integer", label: "Nums" },
      undefined,
    );
    await n.user.type(screen.getByLabelText("Nums"), "1,2");
    expect(n.emitted.at(-1)).toEqual([1, 2]);
  });

  it("edits JSON, flags invalid text and keeps the last valid value", async () => {
    const a = setup({ kind: "json", nullable: true }, { a: 1 });
    const input = screen.getByLabelText("Thing");
    expect(input).toHaveValue(JSON.stringify({ a: 1 }, null, 2));
    await a.user.clear(input);
    expect(a.emitted.at(-1)).toBeNull();
    await a.user.type(input, "{{");
    expect(screen.getByText("Not valid JSON")).toBeInTheDocument();
    expect(a.emitted.at(-1)).toBeNull();
    await a.user.clear(input);
    await a.user.type(input, "[[1]");
    expect(screen.queryByText("Not valid JSON")).toBeNull();
    expect(a.emitted.at(-1)).toEqual([1]);
    setup({ kind: "json", label: "Err" }, 5, { error: "bad" });
    expect(screen.getByText("bad")).toBeInTheDocument();
  });

  it("flags non-numeric items and does not emit NaN", async () => {
    const n = setup({ kind: "array", itemKind: "integer", label: "Nums" });
    await n.user.type(screen.getByLabelText("Nums"), "1,abc");
    expect(screen.getByText("Items must be numbers")).toBeInTheDocument();
    expect(n.emitted.at(-1)).toEqual([1]);
    expect(
      n.emitted.some((v) => Array.isArray(v) && v.some(Number.isNaN)),
    ).toBe(false);
  });

  it("shows the error and helper text of a boolean field", () => {
    setup({ kind: "boolean", label: "Ok", required: true }, false, {
      error: "must be accepted",
    });
    expect(screen.getByText("must be accepted")).toBeInTheDocument();
    setup({ kind: "boolean", label: "Ok2" }, false, { helperText: "hint" });
    expect(screen.getByText("hint")).toBeInTheDocument();
  });

  it("clears the invalid-JSON flag when the value changes from outside", () => {
    const emitted: FieldValue[] = [];
    const f = field({ kind: "json", label: "J" });
    const view = (value: FieldValue) => (
      <FieldInput
        field={f}
        resource="r"
        value={value}
        onChange={(v) => emitted.push(v)}
      />
    );
    const { rerender } = render(view({ a: 1 }));
    fireEvent.change(screen.getByLabelText("J"), { target: { value: "{" } });
    expect(screen.getByText("Not valid JSON")).toBeInTheDocument();
    rerender(view({ a: 2 }));
    expect(screen.queryByText("Not valid JSON")).toBeNull();
  });

  it("starts a JSON field from null", () => {
    setup({ kind: "json", label: "Nul" }, null);
    expect(screen.getByLabelText("Nul")).toHaveValue("");
  });

  it("follows an outside change of the value", () => {
    const emitted: FieldValue[] = [];
    const f = field({ kind: "array", itemKind: "string" });
    const view = (value: FieldValue) => (
      <FieldInput
        field={f}
        resource="r"
        value={value}
        onChange={(v) => emitted.push(v)}
      />
    );
    const { rerender } = render(view(["x"]));
    expect(screen.getByLabelText("F")).toHaveValue("x");
    rerender(view(["y", "z"]));
    expect(screen.getByLabelText("F")).toHaveValue("y, z");
  });

  describe("onInvalid", () => {
    const withSpy = (
      f: Partial<FieldDescriptor>,
      initial?: FieldValue,
    ): {
      spy: ReturnType<typeof vi.fn>;
      user: ReturnType<typeof userEvent.setup>;
    } => {
      const spy = vi.fn();
      const a = setup(f, initial, { onInvalid: spy });
      return { spy, user: a.user };
    };

    it("reports out-of-range and non-integer numbers, and clears when valid", async () => {
      const { spy, user } = withSpy(
        {
          kind: "integer",
          constraints: { ...field().constraints, minimum: 2, maximum: 9 },
        },
        5,
      );
      const input = screen.getByLabelText("Thing");
      expect(spy).not.toHaveBeenCalled();
      await user.clear(input);
      await user.type(input, "1");
      expect(spy).toHaveBeenLastCalledWith("Must be at least 2");
      expect(screen.getByText("Must be at least 2")).toBeInTheDocument();
      await user.clear(input);
      await user.type(input, "99");
      expect(spy).toHaveBeenLastCalledWith("Must be at most 9");
      await user.clear(input);
      await user.type(input, "3.5");
      expect(spy).toHaveBeenLastCalledWith("Enter a whole number");
      await user.clear(input);
      await user.type(input, "4");
      expect(spy).toHaveBeenLastCalledWith(null);
    });

    it("forgets unparsable text when the value is set from outside", () => {
      const spy = vi.fn();
      const f = field({ kind: "number", label: "Thing" });
      const view = (value: FieldValue) => (
        <FieldInput
          field={f}
          resource="r"
          value={value}
          onChange={() => {}}
          onInvalid={spy}
        />
      );
      const { rerender } = render(view(1));
      const input = screen.getByLabelText("Thing") as HTMLInputElement;
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        configurable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      expect(spy).toHaveBeenLastCalledWith("Enter a number");
      rerender(view(null));
      rerender(view(5));
      expect(spy).toHaveBeenLastCalledWith(null);
      expect(screen.queryByText("Enter a number")).toBeNull();
    });

    it("reports text the browser cannot parse as a number", () => {
      const { spy } = withSpy({ kind: "number" }, 1);
      const input = screen.getByLabelText("Thing") as HTMLInputElement;
      Object.defineProperty(input, "validity", {
        value: { badInput: true },
        configurable: true,
      });
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.change(input, { target: { value: "" } });
      expect(spy).toHaveBeenLastCalledWith("Enter a number");
      Object.defineProperty(input, "validity", {
        value: { badInput: false },
        configurable: true,
      });
      fireEvent.change(input, { target: { value: "7" } });
      expect(spy).toHaveBeenLastCalledWith(null);
    });

    it("reports bad JSON and non-numeric array items", async () => {
      const j = withSpy({ kind: "json", label: "Js" });
      await j.user.type(screen.getByLabelText("Js"), "{{");
      expect(j.spy).toHaveBeenLastCalledWith("Not valid JSON");
      await j.user.clear(screen.getByLabelText("Js"));
      expect(j.spy).toHaveBeenLastCalledWith(null);
      const a = withSpy({ kind: "array", itemKind: "number", label: "Arr" });
      await a.user.type(screen.getByLabelText("Arr"), "1,x");
      expect(a.spy).toHaveBeenLastCalledWith("Items must be numbers");
    });

    it("reports an initially invalid value once, and clears it on unmount", () => {
      const spy = vi.fn();
      const f = field({
        kind: "integer",
        constraints: { ...field().constraints, maximum: 1 },
      });
      const { unmount, rerender } = render(
        <FieldInput
          field={f}
          resource="r"
          value={5}
          onChange={() => {}}
          onInvalid={spy}
        />,
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("Must be at most 1");
      rerender(
        <FieldInput field={f} resource="r" value={5} onChange={() => {}} />,
      );
      unmount();
      expect(spy).toHaveBeenLastCalledWith("Must be at most 1");
    });

    it("clears the report when an invalid field unmounts", () => {
      const spy = vi.fn();
      const f = field({
        kind: "integer",
        constraints: { ...field().constraints, maximum: 1 },
      });
      const { unmount } = render(
        <FieldInput
          field={f}
          resource="r"
          value={5}
          onChange={() => {}}
          onInvalid={spy}
        />,
      );
      unmount();
      expect(spy).toHaveBeenLastCalledWith(null);
    });
  });
});
