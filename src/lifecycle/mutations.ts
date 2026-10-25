import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { BulkResult, JsonObject } from "@craftainer/crud-sdk";
import { deleteMutationOptions } from "@craftainer/crud-sdk/tanstack";
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

/**
 * The callback runs from the mutation's own options, not from `mutate`'s: a
 * `mutate` callback is dropped when the component unmounts first (a row that
 * leaves the list, a page that navigates away), while the request still goes
 * through. It runs after the resource is refreshed.
 */
type Done = (() => void) | undefined;

/** `usePublish` with a callback that survives the component's unmount. */
export function usePublishThen(
  ready: ReadyResource,
  onSuccess: Done,
): UseMutationResult<JsonObject, Error, number> {
  const invalidate = useInvalidateResource(ready.resource.name);
  return useMutation({
    mutationFn: (id: number) => ready.handle.publish(id),
    onSuccess: async () => {
      try {
        await invalidate();
      } finally {
        // The write went through even if the refresh failed.
        onSuccess?.();
      }
    },
  });
}

/** `useRestore` with a callback that survives the component's unmount. */
export function useRestoreThen(
  ready: ReadyResource,
  onSuccess: Done,
): UseMutationResult<BulkResult, Error, number> {
  const invalidate = useInvalidateResource(ready.resource.name);
  return useMutation({
    mutationFn: (id: number) => ready.handle.restore({ id }),
    onSuccess: async () => {
      try {
        await invalidate();
      } finally {
        // The write went through even if the refresh failed.
        onSuccess?.();
      }
    },
  });
}

/** The SDK's delete mutation, with a callback that survives the component's unmount. */
export function useDeleteThen(
  ready: ReadyResource,
  onSuccess: Done,
): UseMutationResult<unknown, Error, number> {
  const { queryClient } = useCrud();
  const base = deleteMutationOptions(
    queryClient,
    ready.namespace,
    ready.queryName,
    ready.api,
  );
  return useMutation({
    ...base,
    onSettled: async (data, error, id) => {
      try {
        await base.onSettled(data, error, id);
      } finally {
        if (error === null) onSuccess?.();
      }
    },
  });
}

/** `POST publish?id=`: turns a draft into a published record. */
export function usePublish(
  ready: ReadyResource,
): UseMutationResult<JsonObject, Error, number> {
  return usePublishThen(ready, undefined);
}

/** `POST restore?id=`: brings an archived record back. */
export function useRestore(
  ready: ReadyResource,
): UseMutationResult<BulkResult, Error, number> {
  return useRestoreThen(ready, undefined);
}
