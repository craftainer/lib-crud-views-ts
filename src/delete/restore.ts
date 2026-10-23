// Restoring an archived record, shared by the undo toast and the trash view.
import { crudKeys } from "@craftainer/crud-sdk/tanstack";
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { ReadyResource } from "../core/index.ts";

/** The key prefix `useResource` uses for `name` and `apiVersion`. */
export const queryName = (
  name: string,
  apiVersion: string | undefined,
): string => (apiVersion === undefined ? name : `${name}@${apiVersion}`);

/** Restores one archived record by id, then refreshes everything cached for the resource. */
export function useRestore(
  ready: ReadyResource,
  name: string,
  apiVersion: string | undefined,
): UseMutationResult<unknown, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ready.handle.restore({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: crudKeys.resource(queryName(name, apiVersion)),
      }),
  });
}
