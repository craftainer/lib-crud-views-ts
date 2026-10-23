import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import type { ReactElement } from "react";
import {
  humanize,
  withOp,
  type FieldDescriptor,
  type FieldFilters,
  type FilterOp,
  type FilterScalar,
  type ReadyResource,
} from "../core/index.ts";

export interface FacetSidebarProps {
  readonly ready: ReadyResource;
  readonly filters: FieldFilters;
  readonly onChange: (filters: FieldFilters) => void;
  /** Field names to show. Default: every categorical field with known values. */
  readonly fields?: readonly string[] | undefined;
}

interface Facet {
  readonly field: FieldDescriptor;
  readonly op: FilterOp;
  readonly values: readonly { label: string; value: FilterScalar }[];
}

/** The facets: categorical enum and boolean fields filterable by `in` or `eq`. */
function facetsOf(ready: ReadyResource, names?: readonly string[]): Facet[] {
  return ready.fields.flatMap((field): Facet[] => {
    if (!field.categorical) return [];
    if (names !== undefined && !names.includes(field.name)) return [];
    const op = (["in", "eq"] as const).find((o) => field.filterOps.includes(o));
    if (op === undefined) return [];
    if (field.kind === "boolean")
      return [
        {
          field,
          op,
          values: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      ];
    if (field.choices === null) return [];
    return [
      {
        field,
        op,
        values: field.choices.map((c) => ({ label: humanize(c), value: c })),
      },
    ];
  });
}

/** Checkboxes for the categorical fields: pick values, the list narrows to them. */
export function FacetSidebar({
  ready,
  filters,
  onChange,
  fields,
}: FacetSidebarProps): ReactElement | null {
  const facets = facetsOf(ready, fields);
  if (facets.length === 0) return null;
  return (
    <Box component="aside" aria-label="Facets">
      {facets.map(({ field, op, values }) => {
        const operand = filters[field.name]?.[op];
        const selected: readonly FilterScalar[] =
          operand === undefined
            ? []
            : Array.isArray(operand)
              ? (operand as readonly FilterScalar[])
              : [operand as FilterScalar];
        const toggle = (value: FilterScalar): void => {
          const on = selected.includes(value);
          // `eq` holds one value: picking another replaces it.
          const next =
            op === "in"
              ? on
                ? selected.filter((v) => v !== value)
                : [...selected, value]
              : on
                ? undefined
                : value;
          onChange({
            ...filters,
            [field.name]: withOp(filters[field.name], op, next),
          });
        };
        return (
          <FormControl
            key={field.name}
            component="fieldset"
            variant="standard"
            sx={{ display: "block", mb: 2 }}
          >
            <FormLabel component="legend">{field.label}</FormLabel>
            <FormGroup>
              {values.map(({ label, value }) => (
                <FormControlLabel
                  key={String(value)}
                  label={label}
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.includes(value)}
                      onChange={() => toggle(value)}
                    />
                  }
                />
              ))}
            </FormGroup>
          </FormControl>
        );
      })}
    </Box>
  );
}
