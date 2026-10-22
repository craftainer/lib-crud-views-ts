import type { CrudClient } from "@craftainer/crud-sdk";
import { ThemeProvider, type Theme } from "@mui/material/styles";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useMemo, type ReactElement, type ReactNode } from "react";
import { CrudContextRaw, type CrudContextValue } from "./context.ts";
import type { RendererOverrides } from "./types.ts";

export interface CrudProviderProps {
  readonly client: CrudClient;
  readonly queryClient: QueryClient;
  /** Wraps the tree in this MUI theme. Omit to inherit the ambient theme. */
  readonly theme?: Theme | undefined;
  /** Renderer overrides for this tree (selector -> renderers). */
  readonly renderers?: RendererOverrides | undefined;
  readonly scope?: string | undefined;
  readonly locale?: string | undefined;
  readonly timeZone?: string | undefined;
  readonly children?: ReactNode;
}

/** Provides the SDK client, the TanStack `QueryClient`, an optional MUI theme and renderer overrides. */
export function CrudProvider({
  client,
  queryClient,
  theme,
  renderers,
  scope = "",
  locale,
  timeZone,
  children,
}: CrudProviderProps): ReactElement {
  const value = useMemo<CrudContextValue>(
    () => ({ client, queryClient, scope, locale, timeZone, renderers }),
    [client, queryClient, scope, locale, timeZone, renderers],
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
