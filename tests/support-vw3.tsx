// Shared by the detail, revisions, bulk and lifecycle tests.
import type { ReactElement, ReactNode } from "react";
import { ResourceGate, type ReadyResource } from "../src/core/index.ts";

/** Renders `children(ready)` for a loaded resource (heroes v2 unless told otherwise). */
export function Ready({
  name = "heroes",
  apiVersion,
  children,
}: {
  name?: string;
  apiVersion?: string;
  children: (ready: ReadyResource) => ReactNode;
}): ReactElement {
  return (
    <ResourceGate name={name} apiVersion={apiVersion}>
      {children}
    </ResourceGate>
  );
}
