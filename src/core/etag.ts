import type { JsonObject } from "@craftainer/crud-sdk";
import { useCallback } from "react";
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
) => string | undefined | Promise<string | undefined>;

/**
 * Thrown (and shown as the save error) when a resource declares
 * `conditional_requests` and no ETag is known for the record: the write is
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

/** Looks up the `If-Match` value for a write; see {@link useEtagResolver}. */
export type EtagResolver = (
  id: number,
  options?: {
    /** Fetch the record (`GET`) once if no validator is known yet, then look again. */
    readonly fetchIfMissing?: boolean;
    /**
     * With `fetchIfMissing`: whether the freshly read record still shows what the
     * user saw; `false` rejects with {@link StaleRecordError} (nothing is sent).
     */
    readonly verify?: (fresh: JsonObject) => boolean;
  },
) => Promise<string | undefined>;

/**
 * The `If-Match` value for a write to `ready`'s resource, resolved in order from
 * the view's own `source`, then the provider's `etags` store (the SDK cache,
 * which keeps the last validator of every record it read). Resolves
 * `undefined` only when the resource does not declare `conditional_requests`;
 * when it does and no ETag is known it rejects with {@link MissingEtagError}
 * (fail closed). With `fetchIfMissing` the record is read once through the SDK
 * first, which makes the cache remember its validator; `verify` then checks
 * that the record still shows what the user saw.
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
      const lookup = async (): Promise<string | undefined> => {
        if (source !== undefined) return source(id);
        if (etags === undefined) return undefined;
        return etags.cachedEtag(name, id, await client.scope(), apiVersion);
      };
      let tag = await lookup();
      if (tag === undefined && options?.fetchIfMissing === true) {
        const fresh = (await handle.get(id)) as JsonObject;
        if (options.verify?.(fresh) === false) {
          throw new StaleRecordError(name, id);
        }
        tag = await lookup();
      }
      if (tag === undefined || tag === "") throw new MissingEtagError(name, id);
      return tag;
    },
    [conditional, apiVersion, source, etags, client, name, handle],
  );
}
