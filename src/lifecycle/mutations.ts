import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { BulkResult, JsonObject } from "@craftainer/crud-sdk";
import { useCrud, type ReadyResource } from "../core/index.ts";

/**
 * Refreshes every cached query of one resource on this client (all API
 * versions and caller scopes), for the calls the core's hooks do not cover:
 * publish, restore and bulk. Keys are `["crud", client, resource, ...]` where
 * `resource` is `name` or `name@apiVersion`, so the match ignores the version.
 */
export function useInvalidateResource(name: string): () => Promise<void> {
  const { client, queryClient } = useCrud();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey: key }) =>
          key[0] === "crud" &&
          key[1] === client.id &&
          String(key[2]).split("@")[0] === name,
      }),
    [queryClient, client, name],
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
