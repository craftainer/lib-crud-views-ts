import {
  UnknownResourceError,
  findResource,
  type Capabilities,
  type CrudClient,
  type JsonObject,
  type Resource,
  type ResourceClient,
} from "@craftainer/crud-sdk";
import {
  createMutationOptions,
  deleteMutationOptions,
  infiniteListOptions,
  listOptions,
  manifestOptions,
  predictOptions,
  recordOptions,
  revisionsOptions,
  statsOptions,
  tanstackApi,
  updateMutationOptions,
  type CrudQuery,
  type InfiniteListInit,
  type TanstackApi,
  type UpdateVariables,
} from "@craftainer/crud-sdk/tanstack";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { describeFields } from "./fields.ts";
import { useCrud } from "./context.ts";
import type { FieldDescriptor } from "./types.ts";

/** TanStack hooks bound to one resource. Stable between renders while the resource is. */
export interface ResourceHooks<
  Read extends object = JsonObject,
  Create extends object = JsonObject,
  Update extends object = JsonObject,
> {
  useList(query?: CrudQuery): UseQueryResult<Read[]>;
  useInfiniteList(
    query?: CrudQuery,
    init?: InfiniteListInit,
  ): UseInfiniteQueryResult<InfiniteData<Read[], number>>;
  useRecord(id: number): UseQueryResult<Read>;
  useStats(query?: CrudQuery): UseQueryResult<JsonObject>;
  usePredict(query?: CrudQuery): UseQueryResult<JsonObject>;
  useRevisions(id: number): UseQueryResult<JsonObject[]>;
  /** Invalidates lists, stats and predictions on success. */
  useCreate(): UseMutationResult<Read, Error, Create>;
  /** Variables carry `ifMatch` for `If-Match`; a stale one fails with `PreconditionFailed`. */
  useUpdate(): UseMutationResult<Read, Error, UpdateVariables<Update>>;
  useDelete(): UseMutationResult<unknown, Error, number>;
}

/** The loaded state of `useResource`. */
export interface ReadyResource<
  Read extends object = JsonObject,
  Create extends object = JsonObject,
  Update extends object = JsonObject,
> {
  readonly status: "ready";
  readonly error: null;
  /** The manifest entry (schemas, fields, pagination, paths, ...). */
  readonly resource: Resource;
  /** Shortcut for `resource.capabilities`: gate every optional view on it. */
  readonly capabilities: Capabilities;
  readonly fields: readonly FieldDescriptor[];
  field(name: string): FieldDescriptor | undefined;
  /** The SDK handle, for calls the hooks do not cover (clone, publish, restore, bulk). */
  readonly handle: ResourceClient<Read, Create, Update>;
  readonly api: TanstackApi<Read, Create, Update>;
  readonly hooks: ResourceHooks<Read, Create, Update>;
}

export interface PendingResource {
  readonly status: "pending";
  readonly error: null;
}

export interface FailedResource {
  readonly status: "error";
  readonly error: Error;
}

export type UseResourceResult<
  Read extends object = JsonObject,
  Create extends object = JsonObject,
  Update extends object = JsonObject,
> = PendingResource | FailedResource | ReadyResource<Read, Create, Update>;

const clientIds = new WeakMap<CrudClient, number>();
let nextClientId = 0;
function clientId(client: CrudClient): number {
  let id = clientIds.get(client);
  if (id === undefined) {
    id = nextClientId++;
    clientIds.set(client, id);
  }
  return id;
}

function buildHooks<
  Read extends object,
  Create extends object,
  Update extends object,
>(
  name: string,
  api: TanstackApi<Read, Create, Update>,
  queryClient: ReturnType<typeof useCrud>["queryClient"],
): ResourceHooks<Read, Create, Update> {
  return {
    useList: (query) => useQuery(listOptions(name, api, query)),
    useInfiniteList: (query, init) =>
      useInfiniteQuery(infiniteListOptions(name, api, query, init)),
    useRecord: (id) => useQuery(recordOptions(name, api, id)),
    useStats: (query) => useQuery(statsOptions(name, api, query)),
    usePredict: (query) => useQuery(predictOptions(name, api, query)),
    useRevisions: (id) => useQuery(revisionsOptions(name, api, id)),
    useCreate: () => useMutation(createMutationOptions(queryClient, name, api)),
    useUpdate: () => useMutation(updateMutationOptions(queryClient, name, api)),
    useDelete: () => useMutation(deleteMutationOptions(queryClient, name, api)),
  };
}

/**
 * Loads the manifest (once per caller scope) and returns the resource `name`
 * (the highest `api_version` unless given) with its capabilities, described
 * fields, SDK handle and TanStack hooks. Query keys use `name`, or
 * `name@apiVersion` when `apiVersion` is given, so two versions never share a cache entry.
 */
export function useResource<
  Read extends object = JsonObject,
  Create extends object = JsonObject,
  Update extends object = JsonObject,
>(name: string, apiVersion?: string): UseResourceResult<Read, Create, Update> {
  const { client, queryClient, scope } = useCrud();
  const manifest = useQuery({
    ...manifestOptions(
      { manifest: () => client.manifest() },
      `${clientId(client)}:${scope}`,
    ),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const resource =
    manifest.data === undefined
      ? undefined
      : findResource(manifest.data, name, apiVersion);
  const handle = useQuery({
    queryKey: [
      "crud",
      "_handle",
      clientId(client),
      scope,
      name,
      apiVersion ?? null,
    ],
    queryFn: () => client.resource<Read, Create, Update>(name, apiVersion),
    enabled: resource !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const ready = handle.data;
  return useMemo<UseResourceResult<Read, Create, Update>>(() => {
    if (manifest.error !== null && manifest.data === undefined)
      return { status: "error", error: manifest.error };
    if (manifest.data !== undefined && resource === undefined) {
      return {
        status: "error",
        error: new UnknownResourceError(
          `the manifest has no resource "${name}"${apiVersion === undefined ? "" : ` ${apiVersion}`} for this caller`,
        ),
      };
    }
    if (handle.error !== null && ready === undefined)
      return { status: "error", error: handle.error };
    if (resource === undefined || ready === undefined)
      return { status: "pending", error: null };
    const fields = describeFields(resource);
    const api = tanstackApi(client, ready);
    return {
      status: "ready",
      error: null,
      resource,
      capabilities: resource.capabilities,
      fields,
      field: (fieldName) => fields.find((f) => f.name === fieldName),
      handle: ready,
      api,
      hooks: buildHooks(
        apiVersion === undefined ? name : `${name}@${apiVersion}`,
        api,
        queryClient,
      ),
    };
  }, [
    manifest.error,
    manifest.data,
    resource,
    handle.error,
    ready,
    name,
    apiVersion,
    client,
    queryClient,
  ]);
}
