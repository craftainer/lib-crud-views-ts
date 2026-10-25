import type { CrudClient } from "@craftainer/crud-sdk";
import type { CrudNamespace } from "@craftainer/crud-sdk/tanstack";
import type { QueryClient } from "@tanstack/react-query";
import { createContext, useContext, type Context } from "react";
import type { RendererOverrides } from "./types.ts";

/** What `useCrud` returns. */
export interface CrudContextValue {
  readonly client: CrudClient;
  readonly queryClient: QueryClient;
  /**
   * The `{ client, scope }` every query key starts with: `client.id` and the
   * caller scope (the provider's `scope`, else `client.namespace()`).
   * `undefined` while the scope is being resolved.
   */
  readonly namespace: CrudNamespace | undefined;
  /** Why `client.namespace()` failed (a token provider that threw), else `undefined`. */
  readonly namespaceError: Error | undefined;
  /** BCP 47 tag for number and date formatting; `undefined` = the browser's. */
  readonly locale: string | undefined;
  /** IANA zone for `datetime` display; `undefined` = the browser's. */
  readonly timeZone: string | undefined;
  readonly renderers: RendererOverrides | undefined;
}

/** The raw context (`null` outside a provider); use `useCrud` unless a missing provider is fine. */
export const CrudContextRaw: Context<CrudContextValue | null> =
  createContext<CrudContextValue | null>(null);

/** The provider's value; throws outside a `CrudProvider`. */
export function useCrud(): CrudContextValue {
  const value = useContext(CrudContextRaw);
  if (value === null) {
    throw new Error("useCrud must be used inside <CrudProvider>");
  }
  return value;
}

/** Formatting settings that work without a provider (tests, stand-alone use). */
export function useFormat(): {
  locale: string | undefined;
  timeZone: string | undefined;
} {
  const value = useContext(CrudContextRaw);
  return { locale: value?.locale, timeZone: value?.timeZone };
}
