import { useState, type ReactElement, type ReactNode } from "react";
import type { FieldFilters } from "../../src/core/index.ts";

/** Holds filter state for a component under test and reports each change. */
export function FiltersHarness({
  initial = {},
  onChange,
  children,
}: {
  initial?: FieldFilters;
  onChange?: (filters: FieldFilters) => void;
  children: (
    filters: FieldFilters,
    set: (filters: FieldFilters) => void,
  ) => ReactNode;
}): ReactElement {
  const [filters, setFilters] = useState(initial);
  const set = (next: FieldFilters): void => {
    setFilters(next);
    onChange?.(next);
  };
  return <>{children(filters, set)}</>;
}
