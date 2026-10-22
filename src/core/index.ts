// Public API of the core (contract I4 lives in docs/contracts/I4-field-renderers.md).
export { CrudProvider } from "./provider.tsx";
export type { CrudProviderProps } from "./provider.tsx";
export { useCrud } from "./context.ts";
export type { CrudContextValue } from "./context.ts";
export { useResource } from "./useResource.ts";
export type {
  FailedResource,
  PendingResource,
  ReadyResource,
  ResourceHooks,
  UseResourceResult,
} from "./useResource.ts";
export { ResourceGate } from "./ResourceGate.tsx";
export type { ResourceGateProps } from "./ResourceGate.tsx";

export { describeFields, humanize } from "./fields.ts";
export {
  getRegisteredRenderers,
  registerFieldRenderer,
  resolveRenderer,
  selectorsFor,
} from "./registry.ts";
export type { RendererByRole } from "./registry.ts";
export { builtinRenderers } from "./renderers/builtins.ts";
export {
  FieldDisplay,
  FieldFilterInput,
  FieldInput,
} from "./fieldComponents.tsx";
export { emptyValue } from "./values.ts";
export { isFilterable, withOp } from "./filterState.ts";
export { toQueryFilters } from "./filters.ts";
export type {
  DisplayRenderer,
  DisplayRendererProps,
  FieldConstraints,
  FieldDescriptor,
  FieldFilter,
  FieldFilters,
  FieldKind,
  FieldRenderers,
  FieldValue,
  FilterOp,
  FilterRenderer,
  FilterRendererProps,
  FilterScalar,
  InputRenderer,
  InputRendererProps,
  RendererOverrides,
  RendererRole,
} from "./types.ts";

export { DialogShell, DrawerShell, PageShell } from "./shells.tsx";
export type {
  DialogShellProps,
  DrawerShellProps,
  OverlayShellProps,
  PageShellProps,
  ShellProps,
} from "./shells.tsx";
