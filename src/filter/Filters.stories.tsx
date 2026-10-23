import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactElement } from "react";
import {
  PageShell,
  ResourceGate,
  type FieldFilters,
  type ReadyResource,
} from "../core/index.ts";
import { FacetSidebar } from "./FacetSidebar.tsx";
import { FilterBar } from "./FilterBar.tsx";
import { FilterBuilder } from "./FilterBuilder.tsx";
import { QuickSearch } from "./QuickSearch.tsx";
import { searchableFields } from "./queryState.ts";

/** Holds the filter state for one demo. */
function Demo({
  initial = {},
  children,
}: {
  initial?: FieldFilters;
  children: (
    ready: ReadyResource,
    filters: FieldFilters,
    set: (filters: FieldFilters) => void,
  ) => ReactElement;
}): ReactElement {
  const [filters, setFilters] = useState(initial);
  return (
    <PageShell title="Heroes" maxWidth="md">
      <ResourceGate name="heroes">
        {(ready) => children(ready, filters, setFilters)}
      </ResourceGate>
    </PageShell>
  );
}

const meta = {
  title: "Filter/Filters",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Case-insensitive "contains" on one string field; with several, a field selector. */
export const QuickSearchBox: Story = {
  render: () => (
    <Demo>
      {(ready) => (
        <QuickSearch
          fields={searchableFields(ready.fields)}
          value="ledger"
          field="name"
          onChange={() => {}}
          onFieldChange={() => {}}
        />
      )}
    </Demo>
  ),
};

/** A control per field. Datetime filters say their operands are UTC. */
export const Bar: Story = {
  render: () => (
    <Demo initial={{ power_level: { min: 10 } }}>
      {(ready, filters, set) => (
        <FilterBar
          ready={ready}
          filters={filters}
          onChange={set}
          fields={["name", "power_level", "is_locked", "created_at"]}
        />
      )}
    </Demo>
  ),
};

/** Field, operator and operand per row; operators the renderer cannot edit get a text box. */
export const Builder: Story = {
  render: () => (
    <Demo
      initial={{
        name: { icontains: "ledger" },
        power_level: { in: [41, 72] },
        created_at: { min: new Date("2026-01-01T00:00:00Z") },
      }}
    >
      {(ready, filters, set) => (
        <FilterBuilder ready={ready} filters={filters} onChange={set} />
      )}
    </Demo>
  ),
};

/** Checkboxes for the categorical fields. */
export const Facets: Story = {
  render: () => (
    <Demo initial={{ is_locked: { in: [true] } }}>
      {(ready, filters, set) => (
        <FacetSidebar ready={ready} filters={filters} onChange={set} />
      )}
    </Demo>
  ),
};
