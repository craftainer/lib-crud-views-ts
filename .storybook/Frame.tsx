import CssBaseline from "@mui/material/CssBaseline";
import { useColorScheme } from "@mui/material/styles";
import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { CrudProvider } from "../src/core/index.ts";
import { createStubClient, type StubOptions } from "../tests/fixtures/stub.ts";
import { demoTheme } from "./demoTheme.ts";

type Scheme = "light" | "dark";

/** Pushes the toolbar's choice into MUI, which then sets the data attribute. */
function SchemeSync({
  scheme,
  children,
}: {
  scheme: Scheme;
  children: ReactNode;
}) {
  const { setMode } = useColorScheme();
  useEffect(() => setMode(scheme), [scheme, setMode]);
  return children;
}

/** One stub client and QueryClient per story render. */
export function Frame({
  stub,
  scheme,
  children,
}: {
  stub: StubOptions;
  scheme: Scheme;
  children: ReactNode;
}) {
  const [state] = useState(() => ({
    client: createStubClient(stub).client,
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
  }));
  return (
    <CrudProvider
      client={state.client}
      queryClient={state.queryClient}
      theme={demoTheme}
      locale="en-US"
      timeZone="UTC"
    >
      <CssBaseline />
      <SchemeSync scheme={scheme}>{children}</SchemeSync>
    </CrudProvider>
  );
}
