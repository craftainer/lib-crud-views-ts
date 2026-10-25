import { useCallback, useMemo, useState } from "react";

/** Which records are selected: explicit ids, or every record matching the current filters. */
export interface BulkSelection {
  /** Ids ticked by hand (empty while `allMatching`). */
  readonly selected: readonly number[];
  /** All records matching the list's filters are selected, on every page. */
  readonly allMatching: boolean;
  isSelected(id: number): boolean;
  /**
   * Ticks or unticks one record. Passing the visible page's ids lets an
   * untick while `allMatching` keep the other visible records selected;
   * without them the other matching records cannot be named, so the
   * selection is emptied.
   */
  toggle(id: number, visible?: readonly number[]): void;
  /** Ticks or unticks every id of the visible page. */
  setPage(ids: readonly number[], on: boolean): void;
  selectAllMatching(): void;
  clear(): void;
}

/** Selection state for a list. Ticking a row after "select all matching" returns to explicit ids. */
export function useBulkSelection(): BulkSelection {
  // One state object, so every update reads the latest selection and mode.
  const [state, setState] = useState<{
    readonly selected: readonly number[];
    readonly allMatching: boolean;
  }>({ selected: [], allMatching: false });
  const toggle = useCallback((id: number, visible: readonly number[] = []) => {
    setState((current) => ({
      allMatching: false,
      // Every visible row showed ticked: unticking one leaves the others ticked.
      selected: current.allMatching
        ? visible.filter((x) => x !== id)
        : current.selected.includes(id)
          ? current.selected.filter((x) => x !== id)
          : [...current.selected, id],
    }));
  }, []);
  const setPage = useCallback((ids: readonly number[], on: boolean) => {
    setState((current) => {
      const rest = current.selected.filter((x) => !ids.includes(x));
      // Nothing to untick: keep the state object, so consumers do not re-render.
      if (
        !on &&
        !current.allMatching &&
        rest.length === current.selected.length
      )
        return current;
      return { allMatching: false, selected: on ? [...rest, ...ids] : rest };
    });
  }, []);
  const selectAllMatching = useCallback(() => {
    setState({ selected: [], allMatching: true });
  }, []);
  const clear = useCallback(() => {
    setState({ selected: [], allMatching: false });
  }, []);
  const { selected, allMatching } = state;
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
