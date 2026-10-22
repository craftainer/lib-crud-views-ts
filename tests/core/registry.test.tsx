import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FieldDisplay,
  FieldFilterInput,
  FieldInput,
  builtinRenderers,
  getRegisteredRenderers,
  registerFieldRenderer,
  resolveRenderer,
  selectorsFor,
  toQueryFilters,
  type DisplayRendererProps,
} from "../../src/core/index.ts";
import { field, renderCrud } from "../helpers.tsx";

const Mark = ({ value }: DisplayRendererProps) => (
  <b>{`mark:${String(value)}`}</b>
);
const Other = ({ value }: DisplayRendererProps) => (
  <b>{`other:${String(value)}`}</b>
);

describe("selectors and resolution", () => {
  it("lists selectors most specific first", () => {
    expect(
      selectorsFor(field({ name: "mail", format: "email" }), "heroes"),
    ).toEqual(["heroes.mail", "string:email", "string"]);
    expect(selectorsFor(field({ name: "n" }), "heroes")).toEqual([
      "heroes.n",
      "string",
    ]);
  });

  it("takes the nearest layer, then the most specific selector inside it", () => {
    const f = field({ name: "mail", format: "email" });
    const near = { string: { display: Mark } };
    const far = { "heroes.mail": { display: Other } };
    expect(resolveRenderer("display", f, "heroes", [near, far])).toBe(Mark);
    expect(
      resolveRenderer("display", f, "heroes", [undefined, far, near]),
    ).toBe(Other);
    expect(
      resolveRenderer("display", f, "heroes", [
        { "string:email": { display: Mark }, string: { display: Other } },
      ]),
    ).toBe(Mark);
    expect(resolveRenderer("input", f, "heroes", [near])).toBeUndefined();
  });

  it("has a renderer of every role for every kind", () => {
    for (const kind of [
      "string",
      "number",
      "integer",
      "boolean",
      "date",
      "datetime",
      "enum",
      "array",
      "json",
    ]) {
      expect(Object.keys(builtinRenderers[kind] ?? {}).sort()).toEqual([
        "display",
        "filter",
        "input",
      ]);
    }
  });
});

describe("registerFieldRenderer", () => {
  const undo: (() => void)[] = [];
  afterEach(() => {
    while (undo.length > 0) undo.pop()?.();
  });

  it("overrides the built-ins process-wide and can be undone", () => {
    undo.push(registerFieldRenderer("boolean", { display: Mark }));
    render(
      <FieldDisplay
        field={field({ kind: "boolean" })}
        resource="r"
        value={true}
      />,
    );
    expect(screen.getByText("mark:true")).toBeInTheDocument();
    undo.pop()?.();
    expect(getRegisteredRenderers()).toEqual({});
  });

  it("re-renders mounted fields when a renderer is registered or removed", () => {
    render(
      <FieldDisplay
        field={field({ kind: "boolean" })}
        resource="r"
        value={true}
      />,
    );
    expect(screen.queryByText("mark:true")).toBeNull();
    let remove = (): void => undefined;
    act(() => {
      remove = registerFieldRenderer("boolean", { display: Mark });
    });
    expect(screen.getByText("mark:true")).toBeInTheDocument();
    act(() => remove());
    expect(screen.queryByText("mark:true")).toBeNull();
  });

  it("merges registrations per selector, and undo restores the previous one", () => {
    undo.push(registerFieldRenderer("boolean", { display: Mark }));
    const second = registerFieldRenderer("boolean", { display: Other });
    expect(getRegisteredRenderers()["boolean"]?.display).toBe(Other);
    second();
    expect(getRegisteredRenderers()["boolean"]?.display).toBe(Mark);
  });

  it("does not undo a later registration of the same selector", () => {
    const first = registerFieldRenderer("date", { display: Mark });
    const second = registerFieldRenderer("date", { display: Other });
    first();
    expect(getRegisteredRenderers()["date"]?.display).toBe(Other);
    second();
    expect(getRegisteredRenderers()["date"]).toBeUndefined();
    expect(getRegisteredRenderers()).toEqual({});
  });

  it("ranks component > provider > registered > built-in", () => {
    undo.push(registerFieldRenderer("boolean", { display: Mark }));
    const f = field({ kind: "boolean" });
    const { rerender } = renderCrud(
      <FieldDisplay field={f} resource="r" value={true} />,
      {},
      { renderers: { boolean: { display: Other } } },
    );
    expect(screen.getByText("other:true")).toBeInTheDocument();
    rerender(
      <FieldDisplay
        field={f}
        resource="r"
        value={true}
        renderers={{ "r.f": { display: () => <i>own</i> } }}
      />,
    );
    expect(screen.getByText("own")).toBeInTheDocument();
  });

  it("resolves input and filter roles through the same layers", () => {
    const f = field({ kind: "string", filterOps: ["eq"] });
    render(
      <>
        <FieldInput
          field={f}
          resource="r"
          value=""
          onChange={() => {}}
          renderers={{ string: { input: () => <i>in</i> } }}
        />
        <FieldFilterInput
          field={f}
          resource="r"
          value={undefined}
          onChange={() => {}}
          renderers={{ string: { filter: () => <i>fi</i> } }}
        />
      </>,
    );
    expect(screen.getByText("in")).toBeInTheDocument();
    expect(screen.getByText("fi")).toBeInTheDocument();
  });
});

describe("toQueryFilters", () => {
  it("maps eq to the bare name and other operators to field__op", () => {
    const when = new Date("2026-01-01T00:00:00Z");
    expect(
      toQueryFilters({
        name: { icontains: "ada" },
        flag: { eq: true },
        at: { min: when },
        gone: undefined,
      }),
    ).toEqual({ name__icontains: "ada", flag: true, at__min: when });
  });
});
