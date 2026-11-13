import {
  deleteMutationOptions,
  type DeleteApi,
} from "@craftainer/crud-sdk/tanstack";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useCrud } from "./context.ts";
import { useEtagResolver } from "./etag.ts";
import type { ReadyResource } from "./useResource.ts";

/**
 * The SDK's delete mutation, conditional where the resource declares
 * `conditional_requests`: when the mutation runs (so an `undo` delete resolves
 * it at commit time, not when it was asked for) the record is read and deleted
 * with its strong ETag as `If-Match`. With no strong ETag known it rejects with
 * `MissingEtagError` and sends nothing. Other resources delete unconditionally.
 * `extra` adds options (for example a callback that survives the unmount).
 */
export function useDeleteRecord(
  ready: ReadyResource,
  extra?: (
    base: ReturnType<typeof deleteMutationOptions>,
  ) => Partial<ReturnType<typeof deleteMutationOptions>>,
): UseMutationResult<unknown, Error, number> {
  const { queryClient } = useCrud();
  const resolveEtag = useEtagResolver(ready);
  const api: DeleteApi = {
    delete: async (id) => {
      const ifMatch = await resolveEtag(id, { fetch: "always" });
      return ready.handle.delete(
        id,
        ifMatch === undefined ? undefined : { ifMatch },
      );
    },
  };
  const base = deleteMutationOptions(
    queryClient,
    ready.namespace,
    ready.queryName,
    api,
  );
  return useMutation<unknown, Error, number>({
    ...base,
    ...extra?.(base),
  });
}
