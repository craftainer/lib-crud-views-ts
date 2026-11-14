import type { JsonObject } from "@craftainer/crud-sdk";
import {
  listOptions,
  recordOptions,
  type CrudQuery,
} from "@craftainer/crud-sdk/tanstack";
import { useCallback, useMemo } from "react";
import { useCrud } from "./context.ts";
import type { ReadyResource } from "./useResource.ts";

/**
 * The part of the SDK cache (`createCache(...)` from `@craftainer/crud-sdk/cache`)
 * the views read validators from. Pass the cache itself as `CrudProvider`'s `etags`.
 */
export interface EtagStore {
  cachedEtag(
    resource: string,
    recordId: number,
    scope: string,
    apiVersion: string | null,
  ): Promise<string | undefined>;
}

/** A per-view lookup of a record's ETag; may be async. `undefined` means none is known. */
export type EtagSource = (
  id: number,
  context?: unknown,
) => string | undefined | Promise<string | undefined>;

/**
 * Thrown (and shown as the save error) when a resource declares
 * `conditional_requests` and no strong ETag is known (a weak `W/` one counts as unknown) for the record: the write is
 * refused instead of being sent unconditionally.
 */
export class MissingEtagError extends Error {
  constructor(resource: string, id: number) {
    super(
      `Cannot save ${resource} ${id}: its ETag is unknown, and the resource requires If-Match. Reload the record and try again.`,
    );
    this.name = "MissingEtagError";
  }
}

/**
 * Thrown when the record was read to obtain its ETag and no longer shows what
 * the user saw: someone else changed it meanwhile. Handled like a `412`.
 */
export class StaleRecordError extends Error {
  constructor(resource: string, id: number) {
    super(`${resource} ${id} changed elsewhere since you loaded it.`);
    this.name = "StaleRecordError";
  }
}

/** How a lookup may read the record through the SDK to learn its validator. */
export type EtagFetch = "never" | "always";

/** Looks up the `If-Match` value for a write; see {@link useEtagResolver}. */
export type EtagResolver = (
  id: number,
  options: {
    /**
     * `"always"` reads the record (`GET`) before the lookup, so the validator is the one of
     * what `verify` just checked (the cache holds only the newest one, so a
     * read by another view in the instant between the two can still replace it:
     * the server's atomic `If-Match` check is the last line). The read goes
     * through the SDK cache, which may answer a fresh or stale-while-revalidate
     * entry without the network (the validator is then that entry's, so a
     * changed record answers `412`; but a background refresh landing in the
     * instant between the two can pair the old body with the new validator).
     * Give conditional resources a cache policy with `max_age` and
     * `stale_while_revalidate` of 0, or use a BFF (`no-store`).
     */
    readonly fetch: EtagFetch;
    /**
     * With a read: whether the freshly read record still shows what the user
     * saw; `false` rejects with {@link StaleRecordError} (nothing is sent).
     */
    readonly verify?: (fresh: JsonObject) => boolean;
    /** Passed to the view's `source` as its second argument (for example the row). */
    readonly context?: unknown;
    /** Ask the `etags` store before the view's `source` (after the record was re-read). */
    readonly preferStore?: boolean;
  },
) => Promise<string | undefined>;

/**
 * The `If-Match` value for a write to `ready`'s resource, resolved in order from
 * the view's own `source`, then the provider's `etags` store (the SDK cache,
 * which keeps the last validator of every record it read). Resolves
 * `undefined` only when the resource does not declare `conditional_requests`;
 * when it does and no ETag source exists, or none knows the record, it rejects
 * with {@link MissingEtagError} (fail closed, without reading the record when
 * there is nowhere to look). The `fetch` option reads the record through the
 * SDK first, which makes the cache remember its validator; `verify` then
 * checks that the record still shows what the user saw.
 */
export function useEtagResolver(
  ready: ReadyResource,
  source?: EtagSource,
): EtagResolver {
  const { client, etags } = useCrud();
  const { handle } = ready;
  // The version the SDK called (the cache keys by it), not only a requested one.
  const apiVersion = ready.resource.api_version;
  const name = ready.resource.name;
  const conditional = ready.capabilities.conditional_requests;
  return useCallback(
    async (id, options) => {
      if (!conditional) return undefined;
      if (source === undefined && etags === undefined) {
        throw new MissingEtagError(name, id);
      }
      // Resolved before the read, so nothing but the store lookup separates
      // the read from the validator it is paired with.
      const scope = etags === undefined ? "" : await client.scope();
      const fromStore = async (): Promise<string | undefined> =>
        etags?.cachedEtag(name, id, scope, apiVersion);
      // If-Match uses strong comparison (RFC 9110 section 13.1.1): a weak
      // validator can never match, so it counts as unknown.
      const strong = (tag: string | undefined): string | undefined =>
        tag === undefined || tag === "" || tag.startsWith("W/")
          ? undefined
          : tag;
      const lookup = async (): Promise<string | undefined> => {
        const first = options.preferStore === true ? fromStore : undefined;
        const tag = strong(await first?.());
        if (tag !== undefined) return tag;
        if (source !== undefined)
          return strong(await source(id, options.context));
        return strong(await fromStore());
      };
      if (options.fetch === "always") {
        // "no-cache": never answered by the SDK cache, whatever its max_age or
        // stale-while-revalidate, so a changed record is seen (and conflicts).
        const fresh = (await handle.get(id, {
          cache: "no-cache",
        })) as JsonObject;
        if (options.verify?.(fresh) === false) {
          throw new StaleRecordError(name, id);
        }
      }
      const tag = await lookup();
      if (tag === undefined) throw new MissingEtagError(name, id);
      return tag;
    },
    [conditional, apiVersion, source, etags, client, name, handle],
  );
}

/**
 * Reloads a list or a record into its query, bypassing the SDK cache's
 * `hit`/`stale` answers (`cache: "no-cache"`): used after a conflict, where
 * the cached copy is the one that just proved stale.
 */
export function useForcedReload(ready: ReadyResource): {
  readonly list: (query: CrudQuery | undefined) => Promise<void>;
  readonly record: (id: number) => Promise<unknown>;
} {
  const { queryClient } = useCrud();
  const { namespace, queryName, api } = ready;
  return useMemo(
    () => ({
      // A failed reload shows through the query's own error state.
      list: async (query) => {
        await queryClient
          .fetchQuery(
            listOptions(namespace, queryName, api, query, {
              cache: "no-cache",
            }),
          )
          .catch(() => undefined);
      },
      // Rejects with the fetch error, for the caller to show.
      record: (id) =>
        queryClient.fetchQuery(
          recordOptions(namespace, queryName, api, id, { cache: "no-cache" }),
        ),
    }),
    [queryClient, namespace, queryName, api],
  );
}
