import type { ReactNode } from "react";
import { ResourceGate, type ReadyResource } from "../../src/core/index.ts";
import type { StubOptions } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";

/** Renders `ui` once the resource has loaded, inside a provider over the stub. */
export function renderReady(
  ui: (ready: ReadyResource) => ReactNode,
  options: {
    name?: string;
    version?: string;
    stub?: StubOptions;
  } = {},
) {
  const { name = "heroes", version, stub } = options;
  return renderCrud(
    <ResourceGate name={name} apiVersion={version}>
      {ui}
    </ResourceGate>,
    stub,
  );
}
