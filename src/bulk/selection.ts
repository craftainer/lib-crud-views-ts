import { useCallback, useMemo, useState } from "react";

/** Which records are selected: explicit ids, or every record matching the current filters. */
export interface BulkSelection {
  /** Ids ticked by hand (empty while `allMatching`). */
  readonly selected: readonly number[];
  /** All records matching the list's filters are selected, on every page. */
  readonly allMatching: boolean;
  isSelected(id: number): boolean;
  toggle(id: number): void;
  /** Ticks or unticks every id of the visible page. */
  setPage(ids: readonly number[], on: boolean): void;
  selectAllMatching(): void;
  clear(): void;
}

/** Selection state for a list. Ticking a row after "select all matching" returns to explicit ids. */
export function useBulkSelection(): BulkSelection {
  const [selected, setSelected] = useState<readonly number[]>([]);
  const [allMatching, setAllMatching] = useState(false);
  const toggle = useCallback((id: number) => {
    setAllMatching(false);
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);
  const setPage = useCallback((ids: readonly number[], on: boolean) => {
    setAllMatching(false);
    setSelected((current) => {
      const rest = current.filter((x) => !ids.includes(x));
      return on ? [...rest, ...ids] : rest;
    });
  }, []);
  const selectAllMatching = useCallback(() => {
    setSelected([]);
    setAllMatching(true);
  }, []);
  const clear = useCallback(() => {
    setSelected([]);
    setAllMatching(false);
  }, []);
  return useMemo(
    () => ({
      selected,
      allMatching,
      isSelected: (id) => selected.includes(id),
      toggle,
      setPage,
      selectAllMatching,
      clear,
    }),
    [selected, allMatching, toggle, setPage, selectAllMatching, clear],
  );
}
