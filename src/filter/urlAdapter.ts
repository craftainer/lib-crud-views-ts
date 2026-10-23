// Where filter, sort and paging state lives: the page's query string by default.
// A framework router supplies its own adapter instead.

/** Reads and writes the query string (no leading `?`) the list state is kept in. */
export interface UrlAdapter {
  /** The current query string. */
  read(): string;
  /** Replaces the query string; `push` adds a history entry, `replace` does not. */
  write(search: string, mode: "push" | "replace"): void;
  /** Calls `listener` whenever the query string changes, from anywhere; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** An in-memory adapter: tests, stories, and embedded lists that must not touch the address bar. */
export function memoryUrlAdapter(initial = ""): UrlAdapter {
  let search = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => search,
    write(next) {
      search = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The default adapter: `window.location` and `history` (back and forward work). */
export function windowUrlAdapter(): UrlAdapter {
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    read: () => window.location.search.replace(/^\?/, ""),
    write(search, mode) {
      const { pathname, hash } = window.location;
      const url = `${pathname}${search === "" ? "" : `?${search}`}${hash}`;
      if (mode === "replace")
        window.history.replaceState(window.history.state, "", url);
      else window.history.pushState(window.history.state, "", url);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      // `popstate` fires on back and forward; pushState and replaceState do not fire it.
      window.addEventListener("popstate", listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("popstate", listener);
      };
    },
  };
}

let shared: UrlAdapter | undefined;

/** The process-wide window adapter, so every list on a page shares one listener set. */
export function defaultUrlAdapter(): UrlAdapter {
  shared ??= windowUrlAdapter();
  return shared;
}
