import {
  UnknownResourceError,
  findResource,
  type Capabilities,
  type JsonObject,
  type Manifest,
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
  type CrudNamespace,
  type CrudQuery,
  type InfiniteListInit,
  type TanstackApi,
  type UpdateVariables,
} from "@craftainer/crud-sdk/tanstack";
import {
  skipToken,
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
  /** The `{ client, scope }` of this resource's query keys. */
  readonly namespace: CrudNamespace;
  /**
   * The resource string in its query keys: `name`, or `name@apiVersion` when a
   * version was requested. Pass it to the SDK's `invalidate*` helpers.
   */
  readonly queryName: string;
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

/** The key of the disabled queries while the namespace is unknown: no data is ever stored under it. */
const WAITING_MANIFEST_KEY: readonly unknown[] = [
  "crud-views",
  "waiting",
  "manifest",
];
const WAITING_HANDLE_KEY: readonly unknown[] = [
  "crud-views",
  "waiting",
  "handle",
];

function buildHooks<
  Read extends object,
  Create extends object,
  Update extends object,
>(
  ns: CrudNamespace,
  name: string,
  api: TanstackApi<Read, Create, Update>,
  queryClient: ReturnType<typeof useCrud>["queryClient"],
): ResourceHooks<Read, Create, Update> {
  return {
    useList: (query) => useQuery(listOptions(ns, name, api, query)),
    useInfiniteList: (query, init) =>
      useInfiniteQuery(infiniteListOptions(ns, name, api, query, init)),
    useRecord: (id) => useQuery(recordOptions(ns, name, api, id)),
    useStats: (query) => useQuery(statsOptions(ns, name, api, query)),
    usePredict: (query) => useQuery(predictOptions(ns, name, api, query)),
    useRevisions: (id) => useQuery(revisionsOptions(ns, name, api, id)),
    useCreate: () =>
      useMutation<Read, Error, Create>(
        createMutationOptions(queryClient, ns, name, api),
      ),
    useUpdate: () =>
      useMutation<Read, Error, UpdateVariables<Update>>(
        updateMutationOptions(queryClient, ns, name, api),
      ),
    useDelete: () =>
      useMutation<unknown, Error, number>(
        deleteMutationOptions(queryClient, ns, name, api),
      ),
  };
}

/**
 * Waits for the query namespace, loads the manifest (once per caller scope) and returns the resource `name`
 * (the highest `api_version` unless given) with its capabilities, described
 * fields, SDK handle and TanStack hooks. Query keys use `name`, or
 * `name@apiVersion` when `apiVersion` is given, so two versions never share a cache entry.
 */
export function useResource<
  Read extends object = JsonObject,
  Create extends object = JsonObject,
  Update extends object = JsonObject,
>(name: string, apiVersion?: string): UseResourceResult<Read, Create, Update> {
  const { client, queryClient, namespace, namespaceError } = useCrud();
  const manifest = useQuery<Manifest>({
    ...(namespace === undefined
      ? { queryKey: WAITING_MANIFEST_KEY, queryFn: skipToken }
      : manifestOptions(namespace, { manifest: () => client.manifest() })),
    enabled: namespace !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const resource =
    manifest.data === undefined
      ? undefined
      : findResource(manifest.data, name, apiVersion);
  const handle = useQuery({
    // Outside the SDK's `crud` keys: a handle is no cached response, so an
    // invalidation of the resource must not rebuild it (and its hooks).
    queryKey:
      namespace === undefined
        ? WAITING_HANDLE_KEY
        : [
            "crud-views",
            "handle",
            namespace.client,
            namespace.scope,
            name,
            apiVersion ?? null,
          ],
    queryFn: () => client.resource<Read, Create, Update>(name, apiVersion),
    enabled: namespace !== undefined && resource !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const ready = handle.data;
  return useMemo<UseResourceResult<Read, Create, Update>>(() => {
    if (namespaceError !== undefined)
      return { status: "error", error: namespaceError };
    if (namespace === undefined) return { status: "pending", error: null };
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
    const queryName = apiVersion === undefined ? name : `${name}@${apiVersion}`;
    return {
      status: "ready",
      error: null,
      resource,
      capabilities: resource.capabilities,
      fields,
      field: (fieldName) => fields.find((f) => f.name === fieldName),
      handle: ready,
      namespace,
      queryName,
      api,
      hooks: buildHooks(namespace, queryName, api, queryClient),
    };
  }, [
    namespace,
    namespaceError,
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
