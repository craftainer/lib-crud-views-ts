import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { CrudProvider, type CrudProviderProps } from "../src/core/index.ts";
import { createStubClient, type StubOptions } from "./fixtures/stub.ts";
import type { FieldDescriptor } from "../src/core/index.ts";

export const newQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

type Extra = Partial<
  Omit<CrudProviderProps, "client" | "queryClient" | "children">
>;

/** Renders `ui` inside a `CrudProvider` over a stub client. */
export function renderCrud(
  ui: ReactElement,
  stub: StubOptions = {},
  extra: Extra = {},
) {
  const s = createStubClient(stub);
  const queryClient = newQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <CrudProvider client={s.client} queryClient={queryClient} {...extra}>
      {children}
    </CrudProvider>
  );
  return { ...render(ui, { wrapper }), stub: s, queryClient, wrapper };
}

/** A FieldDescriptor with sensible defaults. */
export const field = (
  over: Partial<FieldDescriptor> = {},
): FieldDescriptor => ({
  name: "f",
  label: "F",
  kind: "string",
  format: null,
  nullable: false,
  readOnly: false,
  required: false,
  choices: null,
  itemKind: null,
  constraints: {
    minLength: undefined,
    maxLength: undefined,
    minimum: undefined,
    maximum: undefined,
    pattern: undefined,
  },
  inManifest: true,
  sortable: true,
  filterOps: [],
  numeric: false,
  categorical: false,
  ...over,
});
