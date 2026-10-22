import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import type { ReactElement, ReactNode } from "react";
import { useResource, type ReadyResource } from "./useResource.ts";

export interface ResourceGateProps {
  readonly name: string;
  readonly apiVersion?: string | undefined;
  /** Shown while the manifest loads. Default: a spinner. */
  readonly pending?: ReactNode;
  /** Shown on failure (unknown resource, network). Default: an error alert. */
  readonly fallback?: ((error: Error) => ReactNode) | undefined;
  readonly children: (ready: ReadyResource) => ReactNode;
}

/** Renders `children` once the resource is loaded; the common loading and error states otherwise. */
export function ResourceGate({
  name,
  apiVersion,
  pending,
  fallback,
  children,
}: ResourceGateProps): ReactElement {
  const state = useResource(name, apiVersion);
  if (state.status === "pending") {
    return (
      <>
        {pending ?? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress aria-label="Loading" />
          </Box>
        )}
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        {fallback?.(state.error) ?? (
          <Alert severity="error">{state.error.message}</Alert>
        )}
      </>
    );
  }
  return <>{children(state)}</>;
}
