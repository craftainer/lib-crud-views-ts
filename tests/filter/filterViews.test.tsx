import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldFilters } from "../../src/core/index.ts";
import {
  FacetSidebar,
  FilterBar,
  FilterBuilder,
  QuickSearch,
} from "../../src/filter/index.ts";
import { field } from "../helpers.tsx";
import { FiltersHarness } from "./harness.tsx";
import { renderReady } from "./renderReady.tsx";

describe("FilterBar", () => {
  it("shows a control per filterable field, says datetimes are UTC and clears", async () => {
    const user = userEvent.setup();
    const seen: FieldFilters[] = [];
    renderReady((ready) => (
      <FiltersHarness onChange={(f) => seen.push(f)}>
        {(filters, set) => (
          <FilterBar ready={ready} filters={filters} onChange={set} />
        )}
      </FiltersHarness>
    ));
    const bar = await screen.findByRole("region", { name: "Filters" });
    expect(within(bar).getByLabelText("Name")).toBeInTheDocument();
    expect(within(bar).queryByLabelText("Id")).toBeNull();
    expect(within(bar).getAllByText(/times are UTC/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();

    await user.type(within(bar).getByLabelText("Name"), "a");
    expect(seen.at(-1)).toEqual({ name: { icontains: "a" } });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(seen.at(-1)).toEqual({});
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("limits the bar to the named fields", async () => {
    renderReady((ready) => (
      <FilterBar
        ready={ready}
        filters={{}}
        onChange={() => {}}
        fields={["power_level", "id", "ghost"]}
      />
    ));
    expect(
      await screen.findByLabelText("Power level from"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByLabelText("Id from")).toBeNull();
  });

  it("passes renderers through to the controls", async () => {
    renderReady((ready) => (
      <FilterBar
        ready={ready}
        filters={{}}
        onChange={() => {}}
        fields={["name"]}
        renderers={{ "heroes.name": { filter: () => <p>custom filter</p> } }}
      />
    ));
    expect(await screen.findByText("custom filter")).toBeInTheDocument();
  });
});

describe("QuickSearch", () => {
  const fields = [
    field({ name: "name", label: "Name" }),
    field({ name: "owner_id", label: "Owner id" }),
  ];

  it("commits the text after the debounce and offers a field choice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onChange = vi.fn();
      const onFieldChange = vi.fn();
      render_(fields, "", "name", onChange, onFieldChange);
      await user.type(screen.getByLabelText("Search name"), "ada");
      expect(onChange).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(onChange).toHaveBeenCalledExactlyOnceWith("ada");

      await user.click(screen.getByRole("combobox", { name: "Search in" }));
      await user.click(screen.getByRole("option", { name: "Owner id" }));
      expect(onFieldChange).toHaveBeenCalledWith("owner_id");
    } finally {
      vi.useRealTimers();
    }
  });

  it("follows the value and hides the selector with one field", () => {
    const { rerender } = render_(fields.slice(0, 1), "x", undefined);
    expect(screen.getByLabelText("Search name")).toHaveValue("x");
    expect(screen.queryByRole("combobox")).toBeNull();
    rerender_(fields.slice(0, 1), "y");
    expect(screen.getByLabelText("Search name")).toHaveValue("y");
    void rerender;
  });

  it("renders nothing without a searchable field", () => {
    const { container } = render_([], "", undefined);
    expect(container).toBeEmptyDOMElement();
  });
});

import { render } from "@testing-library/react";
import type { FieldDescriptor } from "../../src/core/index.ts";

function props(
  fields: readonly FieldDescriptor[],
  value: string,
  fieldName: string | undefined,
  onChange = vi.fn(),
  onFieldChange = vi.fn(),
) {
  return (
    <QuickSearch
      fields={fields}
      value={value}
      field={fieldName}
      onChange={onChange}
      onFieldChange={onFieldChange}
    />
  );
}
let last: ReturnType<typeof render>;
function render_(
  fields: readonly FieldDescriptor[],
  value: string,
  fieldName: string | undefined,
  onChange = vi.fn(),
  onFieldChange = vi.fn(),
) {
  last = render(props(fields, value, fieldName, onChange, onFieldChange));
  return last;
}
function rerender_(fields: readonly FieldDescriptor[], value: string) {
  last.rerender(props(fields, value, undefined));
}

describe("FilterBuilder", () => {
  it("adds, edits, re-targets and removes conditions", async () => {
    const user = userEvent.setup();
    const seen: FieldFilters[] = [];
    renderReady((ready) => (
      <FiltersHarness onChange={(f) => seen.push(f)}>
        {(filters, set) => (
          <FilterBuilder ready={ready} filters={filters} onChange={set} />
        )}
      </FiltersHarness>
    ));
    await screen.findByRole("region", { name: "Filter builder" });
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add condition" }));
    // Changing the field or operator remounts the row, so look it up each time.
    const row = (): HTMLElement =>
      screen.getByRole("group", { name: "Condition 1" });
    await user.type(within(row()).getByLabelText("Name"), "x");
    expect(seen.at(-1)).toEqual({ name: { eq: "x" } });
    // Clearing the text keeps the row.
    await user.clear(within(row()).getByLabelText("Name"));
    expect(seen.at(-1)).toEqual({});
    expect(
      screen.getByRole("group", { name: "Condition 1" }),
    ).toBeInTheDocument();

    // Operator without a built-in editor falls back to a text box.
    await user.click(within(row()).getByRole("combobox", { name: "Operator" }));
    await user.click(screen.getByRole("option", { name: "matches pattern" }));
    const pattern = screen.getByLabelText("Name matches pattern");
    await user.type(pattern, "^A");
    expect(seen.at(-1)).toEqual({ name: { regex: "^A" } });

    // Another field: its first operator, nothing left of the old condition.
    await user.click(within(row()).getByRole("combobox", { name: "Field" }));
    await user.click(screen.getByRole("option", { name: "Power level" }));
    expect(seen.at(-1)).toEqual({});
    await user.type(within(row()).getByLabelText("Power level"), "5");
    expect(seen.at(-1)).toEqual({ power_level: { eq: 5 } });

    await user.click(within(row()).getByRole("combobox", { name: "Operator" }));
    await user.click(screen.getByRole("option", { name: "is one of" }));
    expect(screen.getByText("Comma-separated")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Power level is one of"), "1, 2");
    expect(seen.at(-1)).toEqual({ power_level: { in: [1, 2] } });

    await user.click(screen.getByRole("button", { name: "Add condition" }));
    expect(
      screen.getByRole("group", { name: "Condition 2" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove condition 2" }),
    );
    expect(screen.queryByRole("group", { name: "Condition 2" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Remove condition 1" }),
    );
    expect(seen.at(-1)).toEqual({});
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("shows existing filters, a UTC hint on datetime lists, and clears all", async () => {
    const user = userEvent.setup();
    const seen: FieldFilters[] = [];
    renderReady((ready) => (
      <FiltersHarness
        initial={{
          created_at: { in: [new Date("2026-01-01T00:00:00Z")] },
          power_level: { min: 4 },
        }}
        onChange={(f) => seen.push(f)}
      >
        {(filters, set) => (
          <FilterBuilder ready={ready} filters={filters} onChange={set} />
        )}
      </FiltersHarness>
    ));
    expect(
      await screen.findByText("Comma-separated, times are UTC"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Created at is one of")).toHaveValue(
      "2026-01-01T00:00:00.000Z",
    );
    expect(screen.getByLabelText("Power level from")).toHaveValue(4);
    await user.type(screen.getByLabelText("Power level from"), "0");
    expect(seen.at(-1)).toMatchObject({ power_level: { min: 40 } });
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(seen.at(-1)).toEqual({});
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("adds a second condition on the next unused field and ignores an empty resource", async () => {
    const user = userEvent.setup();
    renderReady(
      (ready) => (
        <FilterBuilder
          ready={ready}
          filters={{ title: { eq: "x" } }}
          onChange={() => {}}
        />
      ),
      { name: "quests" },
    );
    await user.click(
      await screen.findByRole("button", { name: "Add condition" }),
    );
    expect(
      screen.getByRole("group", { name: "Condition 2" }),
    ).toHaveTextContent("Difficulty");
  });
});

describe("FilterBar active state", () => {
  it("does not count a field with no operands as filtering", async () => {
    renderReady((ready) => (
      <FilterBar ready={ready} filters={{ name: {} }} onChange={() => {}} />
    ));
    await screen.findByRole("region", { name: "Filters" });
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });
});

describe("FilterBuilder text operand", () => {
  it("follows filters changed from outside", async () => {
    const user = userEvent.setup();
    renderReady((ready) => (
      <FiltersHarness onChange={() => {}}>
        {(filters, set) => (
          <>
            <FilterBuilder ready={ready} filters={filters} onChange={set} />
            <button
              type="button"
              onClick={() => set({ name: { regex: "zzz" } })}
            >
              Replace from outside
            </button>
          </>
        )}
      </FiltersHarness>
    ));
    await user.click(
      await screen.findByRole("button", { name: "Add condition" }),
    );
    await user.click(screen.getByRole("combobox", { name: "Operator" }));
    await user.click(screen.getByRole("option", { name: "matches pattern" }));
    await user.type(screen.getByLabelText(/Name.*/), "abc");
    await user.click(
      screen.getByRole("button", { name: "Replace from outside" }),
    );
    expect(screen.getByLabelText(/Name.*/)).toHaveValue("zzz");
  });
});

describe("FilterBuilder add", () => {
  it("reuses the first field when all are in use and does nothing without fields", async () => {
    const user = userEvent.setup();
    renderReady(
      (ready) => (
        <>
          <FilterBuilder ready={ready} filters={{}} onChange={() => {}} />
          <FilterBuilder
            ready={{ ...ready, fields: [] }}
            filters={{}}
            onChange={() => {}}
          />
        </>
      ),
      { name: "quests" },
    );
    const adds = await screen.findAllByRole("button", {
      name: "Add condition",
    });
    for (let i = 0; i < 6; i++) await user.click(adds[0]!);
    // One condition per field and operator: a twin of an existing one is not queued.
    const groups = screen.getAllByRole("group", { name: /Condition/ }).length;
    expect(groups).toBeGreaterThan(0);
    expect(groups).toBeLessThan(6);
    await user.click(adds[0]!);
    expect(screen.getAllByRole("group", { name: /Condition/ })).toHaveLength(
      groups,
    );
    await user.click(adds[1]!);
    expect(screen.getAllByRole("group", { name: /Condition/ })).toHaveLength(
      groups,
    );
  });
});

describe("FacetSidebar", () => {
  it("toggles enum and boolean values", async () => {
    const user = userEvent.setup();
    const seen: FieldFilters[] = [];
    renderReady(
      (ready) => (
        <FiltersHarness onChange={(f) => seen.push(f)}>
          {(filters, set) => (
            <FacetSidebar ready={ready} filters={filters} onChange={set} />
          )}
        </FiltersHarness>
      ),
      { name: "quests" },
    );
    const aside = await screen.findByRole("complementary", { name: "Facets" });
    const hard = within(aside).getByRole("checkbox", { name: "Hard" });
    await user.click(hard);
    await user.click(within(aside).getByRole("checkbox", { name: "Easy" }));
    expect(seen.at(-1)).toEqual({ difficulty: { in: ["hard", "easy"] } });
    await user.click(hard);
    expect(seen.at(-1)).toEqual({ difficulty: { in: ["easy"] } });
    await user.click(within(aside).getByRole("checkbox", { name: "Easy" }));
    expect(seen.at(-1)).toEqual({});
  });

  it("offers Yes and No for booleans and honours the fields option", async () => {
    const user = userEvent.setup();
    const seen: FieldFilters[] = [];
    renderReady((ready) => (
      <FiltersHarness onChange={(f) => seen.push(f)}>
        {(filters, set) => (
          <FacetSidebar
            ready={ready}
            filters={filters}
            onChange={set}
            fields={["is_draft"]}
          />
        )}
      </FiltersHarness>
    ));
    await user.click(await screen.findByRole("checkbox", { name: "No" }));
    expect(seen.at(-1)).toEqual({ is_draft: { in: [false] } });
    expect(screen.queryByText("Is locked")).toBeNull();
  });

  it("renders nothing without facets", async () => {
    renderReady(
      (ready) => (
        <>
          <p>loaded</p>
          <FacetSidebar
            ready={ready}
            filters={{}}
            onChange={() => {}}
            fields={["title"]}
          />
        </>
      ),
      { name: "quests" },
    );
    await screen.findByText("loaded");
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("FacetSidebar edge cases", () => {
  it("skips categorical fields it cannot list values for", async () => {
    renderReady((ready) => {
      const fields = [
        field({
          name: "tag",
          label: "Tag",
          categorical: true,
          filterOps: ["in"],
          choices: null,
        }),
        field({
          name: "mood",
          label: "Mood",
          categorical: true,
          filterOps: ["regex"],
          choices: ["a"],
          kind: "enum",
        }),
        field({
          name: "level",
          label: "Level",
          categorical: true,
          filterOps: ["eq"],
          choices: ["lo", "hi"],
          kind: "enum",
        }),
      ];
      return (
        <FacetSidebar
          ready={{ ...ready, fields }}
          filters={{ level: { eq: "lo" } }}
          onChange={() => {}}
        />
      );
    });
    expect(await screen.findByText("Level")).toBeInTheDocument();
    expect(screen.queryByText("Tag")).toBeNull();
    expect(screen.queryByText("Mood")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Lo" })).toBeChecked();
  });

  it("holds one value for an eq-only facet", async () => {
    const user = userEvent.setup();
    const seen: FieldFilters[] = [];
    renderReady((ready) => {
      const fields = [
        field({
          name: "level",
          label: "Level",
          categorical: true,
          filterOps: ["eq"],
          choices: ["lo", "hi"],
          kind: "enum",
        }),
      ];
      return (
        <FiltersHarness onChange={(f) => seen.push(f)}>
          {(filters, set) => (
            <FacetSidebar
              ready={{ ...ready, fields }}
              filters={filters}
              onChange={set}
            />
          )}
        </FiltersHarness>
      );
    });
    await user.click(await screen.findByRole("checkbox", { name: "Lo" }));
    await user.click(screen.getByRole("checkbox", { name: "Hi" }));
    expect(seen.at(-1)).toEqual({ level: { eq: "hi" } });
    await user.click(screen.getByRole("checkbox", { name: "Hi" }));
    expect(seen.at(-1)).toEqual({});
  });
});
