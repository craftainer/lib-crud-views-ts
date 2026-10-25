import type { CrudClient } from "@craftainer/crud-sdk";
import type { CrudNamespace } from "@craftainer/crud-sdk/tanstack";
import { ThemeProvider, type Theme } from "@mui/material/styles";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { CrudContextRaw, type CrudContextValue } from "./context.ts";
import type { RendererOverrides } from "./types.ts";

export interface CrudProviderProps {
  readonly client: CrudClient;
  readonly queryClient: QueryClient;
  /** Wraps the tree in this MUI theme. Omit to inherit the ambient theme. */
  readonly theme?: Theme | undefined;
  /** Renderer overrides for this tree (selector -> renderers). */
  readonly renderers?: RendererOverrides | undefined;
  /**
   * The caller scope in every query key. Omit it to use `client.namespace()`
   * (`"anon"`, or a hash of the bearer token), which separates callers by
   * themselves; set it to name the caller yourself (for example the user id).
   */
  readonly scope?: string | undefined;
  readonly locale?: string | undefined;
  readonly timeZone?: string | undefined;
  readonly children?: ReactNode;
}

interface Resolved {
  readonly client: CrudClient;
  readonly namespace?: CrudNamespace;
  readonly error?: Error;
}

/** The namespace for `client`: `scope` when given, else `client.namespace()` once it settles. */
function useNamespace(
  client: CrudClient,
  scope: string | undefined,
): { namespace: CrudNamespace | undefined; error: Error | undefined } {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  useEffect(() => {
    if (scope !== undefined) return;
    let live = true;
    client.namespace().then(
      (namespace) => {
        if (live) setResolved({ client, namespace });
      },
      (error: unknown) => {
        if (live) {
          setResolved({
            client,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [client, scope]);
  const given = useMemo(
    () => (scope === undefined ? undefined : { client: client.id, scope }),
    [client, scope],
  );
  // A result for another client is stale: wait for the new one.
  const current = resolved?.client === client ? resolved : null;
  return {
    namespace: given ?? current?.namespace,
    error: scope === undefined ? current?.error : undefined,
  };
}

/** Provides the SDK client, the TanStack `QueryClient`, an optional MUI theme and renderer overrides. */
export function CrudProvider({
  client,
  queryClient,
  theme,
  renderers,
  scope,
  locale,
  timeZone,
  children,
}: CrudProviderProps): ReactElement {
  const { namespace, error: namespaceError } = useNamespace(client, scope);
  const value = useMemo<CrudContextValue>(
    () => ({
      client,
      queryClient,
      namespace,
      namespaceError,
      locale,
      timeZone,
      renderers,
    }),
    [
      client,
      queryClient,
      namespace,
      namespaceError,
      locale,
      timeZone,
      renderers,
    ],
  );
  const tree = (
    <QueryClientProvider client={queryClient}>
      <CrudContextRaw.Provider value={value}>
        {children}
      </CrudContextRaw.Provider>
    </QueryClientProvider>
  );
  return theme === undefined ? (
    tree
  ) : (
    <ThemeProvider theme={theme}>{tree}</ThemeProvider>
  );
}
