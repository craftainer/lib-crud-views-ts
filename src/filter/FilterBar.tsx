import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";
import {
  isFilterable,
  type FieldFilters,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { FilterControl } from "./FilterControl.tsx";

export interface FilterBarProps {
  readonly ready: ReadyResource;
  readonly filters: FieldFilters;
  readonly onChange: (filters: FieldFilters) => void;
  /** Field names to show, in order. Default: every filterable field except the resource's key field. */
  readonly fields?: readonly string[] | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

/** One filter control per field, side by side: the filters are all visible at once. */
export function FilterBar({
  ready,
  filters,
  onChange,
  fields,
  renderers,
}: FilterBarProps): ReactElement {
  const keyField = ready.resource.id_field;
  const shown =
    fields === undefined
      ? ready.fields.filter((f) => isFilterable(f) && f.name !== keyField)
      : fields.flatMap((name) => {
          const field = ready.field(name);
          return field !== undefined &&
            isFilterable(field) &&
            field.name !== keyField
            ? [field]
            : [];
        });
  const active = Object.values(filters).some(
    (f) => f !== undefined && Object.keys(f).length > 0,
  );
  return (
    <Stack
      component="section"
      aria-label="Filters"
      direction="row"
      useFlexGap
      sx={{ flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}
    >
      {shown.map((field) => (
        <Stack key={field.name} sx={{ minWidth: 0, flex: "1 1 14rem" }}>
          <FilterControl
            field={field}
            resource={ready.resource.name}
            value={filters[field.name]}
            onChange={(value) => onChange({ ...filters, [field.name]: value })}
            renderers={renderers}
          />
        </Stack>
      ))}
      {active && <Button onClick={() => onChange({})}>Clear filters</Button>}
    </Stack>
  );
}
