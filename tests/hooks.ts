import type { ReadyResource, ResourceHooks } from "../src/core/index.ts";

/** `ready` with some hooks replaced, to reach loading and error states. */
export function withHooks(
  ready: ReadyResource,
  over: Partial<Record<keyof ResourceHooks, unknown>>,
): ReadyResource {
  return { ...ready, hooks: { ...ready.hooks, ...over } as ResourceHooks };
}

export const pendingQuery = (): unknown => ({
  isPending: true,
  error: null,
  data: undefined,
});

export const failedQuery = (message: string) => (): unknown => ({
  isPending: false,
  error: new Error(message),
  data: undefined,
});
