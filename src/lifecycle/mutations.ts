import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { BulkResult, JsonObject } from "@craftainer/crud-sdk";
import { useCrud, type ReadyResource } from "../core/index.ts";

/**
 * Refreshes every cached query of one resource (all API versions), for the
 * calls the core's hooks do not cover: publish, restore and bulk.
 */
export function useInvalidateResource(name: string): () => Promise<void> {
  const { queryClient } = useCrud();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          `${String(query.queryKey[0])}/${String(query.queryKey[1]).split("@")[0]}` ===
          `crud/${name}`,
      }),
    [queryClient, name],
  );
}

/** `POST publish?id=`: turns a draft into a published record. */
export function usePublish(
  ready: ReadyResource,
): UseMutationResult<JsonObject, Error, number> {
  const invalidate = useInvalidateResource(ready.resource.name);
  return useMutation({
    mutationFn: (id: number) => ready.handle.publish(id),
    onSuccess: invalidate,
  });
}

/** `POST restore?id=`: brings an archived record back. */
export function useRestore(
  ready: ReadyResource,
): UseMutationResult<BulkResult, Error, number> {
  const invalidate = useInvalidateResource(ready.resource.name);
  return useMutation({
    mutationFn: (id: number) => ready.handle.restore({ id }),
    onSuccess: invalidate,
  });
}
