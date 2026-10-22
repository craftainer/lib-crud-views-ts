import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FieldDisplay,
  type FieldDescriptor,
  type FieldValue,
} from "../../src/core/index.ts";
import { field, renderCrud } from "../helpers.tsx";

const show = (f: Partial<FieldDescriptor>, value: FieldValue) =>
  render(<FieldDisplay field={field(f)} resource="r" value={value} />);

describe("display renderers", () => {
  it("shows a dash for empty values of every kind", () => {
    for (const kind of [
      "string",
      "number",
      "boolean",
      "date",
      "datetime",
      "enum",
      "array",
      "json",
    ] as const) {
      const { unmount } = show({ kind }, null);
      expect(screen.getByText("—")).toBeInTheDocument();
      unmount();
    }
    show({ kind: "string" }, "");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows plain strings, mail links and http links", () => {
    show({ kind: "string" }, "Ada");
    expect(screen.getByText("Ada")).toBeInTheDocument();
    show({ kind: "string", format: "email" }, "ada@example.com");
    expect(
      screen.getByRole("link", { name: "ada@example.com" }),
    ).toHaveAttribute("href", "mailto:ada@example.com");
    show({ kind: "string", format: "uri" }, "https://example.com/x");
    expect(
      screen.getByRole("link", { name: "https://example.com/x" }),
    ).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("never links a non-http uri", () => {
    show({ kind: "string", format: "uri" }, "javascript:alert(1)");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("stringifies a non-string value in a string field", () => {
    show({ kind: "string" }, 7);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("formats numbers with the provider locale", () => {
    renderCrud(
      <FieldDisplay
        field={field({ kind: "number" })}
        resource="r"
        value={1234.5}
      />,
      {},
      { locale: "de-DE" },
    );
    expect(screen.getByText("1.234,5")).toBeInTheDocument();
    show({ kind: "integer" }, 1234);
    expect(screen.getByText(/1,?234/)).toBeInTheDocument();
    show({ kind: "number" }, "x");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows booleans as chips", () => {
    show({ kind: "boolean" }, true);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    show({ kind: "boolean" }, false);
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("formats dates in UTC and datetimes in the provider zone", () => {
    show({ kind: "date" }, "2026-03-14");
    expect(screen.getByText("Mar 14, 2026")).toBeInTheDocument();
    show({ kind: "date" }, "not a date");
    expect(screen.getByText("—")).toBeInTheDocument();
    renderCrud(
      <FieldDisplay
        field={field({ kind: "datetime" })}
        resource="r"
        value="2026-01-02T09:30:00Z"
      />,
      {},
      { locale: "en-US", timeZone: "Asia/Tokyo" },
    );
    expect(screen.getByText(/Jan 2, 2026/)).toHaveAttribute(
      "datetime",
      "2026-01-02T09:30:00.000Z",
    );
    expect(screen.getByText(/6:30\s?PM/)).toBeInTheDocument();
    show({ kind: "datetime" }, 5);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("humanizes enum values and lists array items", () => {
    show({ kind: "enum" }, "very_hard");
    expect(screen.getByText("Very hard")).toBeInTheDocument();
    show({ kind: "array" }, ["a", 2]);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    show({ kind: "array" }, []);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("prints JSON compactly", () => {
    show({ kind: "json" }, { a: 1 });
    expect(screen.getByText('{"a":1}')).toBeInTheDocument();
  });
});
