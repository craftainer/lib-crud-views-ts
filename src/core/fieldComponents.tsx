// <FieldDisplay>, <FieldInput> and <FieldFilterInput>: what the views render.
// Each resolves its renderer through the layers (docs/contracts/I4-field-renderers.md).
import {
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { CrudContextRaw } from "./context.ts";
import {
  getRegisteredRenderers,
  resolveRenderer,
  subscribeRegisteredRenderers,
  type RendererByRole,
} from "./registry.ts";
import { builtinRenderers } from "./renderers/builtins.ts";
import type {
  DisplayRendererProps,
  FilterRendererProps,
  InputRendererProps,
  RendererOverrides,
  RendererRole,
} from "./types.ts";

/** Props of the three field components: the renderer props plus a per-component override layer. */
type WithOverrides<P> = P & {
  /** Highest-precedence layer, for this one component. */
  readonly renderers?: RendererOverrides | undefined;
};

/** The layers, nearest first. */
function useRendererLayers(
  own: RendererOverrides | undefined,
): readonly (RendererOverrides | undefined)[] {
  const crud = useContext(CrudContextRaw);
  const registered = useSyncExternalStore(
    subscribeRegisteredRenderers,
    getRegisteredRenderers,
    getRegisteredRenderers,
  );
  return [own, crud?.renderers, registered, builtinRenderers];
}

function pick<R extends RendererRole>(
  role: R,
  props: { field: DisplayRendererProps["field"]; resource: string },
  layers: readonly (RendererOverrides | undefined)[],
): RendererByRole[R] {
  // The built-ins define every role for every kind, so this never misses.
  return resolveRenderer(
    role,
    props.field,
    props.resource,
    layers,
  ) as RendererByRole[R];
}

/** Shows `value` with the resolved display renderer. */
export function FieldDisplay({
  renderers,
  ...props
}: WithOverrides<DisplayRendererProps>): ReactElement {
  const layers = useRendererLayers(renderers);
  return createElement(pick("display", props, layers), props);
}

/** Edits a value with the resolved input renderer. */
export function FieldInput({
  renderers,
  ...props
}: WithOverrides<InputRendererProps>): ReactElement {
  const layers = useRendererLayers(renderers);
  return createElement(pick("input", props, layers), props);
}

/** Edits the filter of a field with the resolved filter renderer. */
export function FieldFilterInput({
  renderers,
  ...props
}: WithOverrides<FilterRendererProps>): ReactElement {
  const layers = useRendererLayers(renderers);
  return createElement(pick("filter", props, layers), props);
}
