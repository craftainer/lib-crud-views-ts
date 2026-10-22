// The field-renderer registry (contract I4): selectors, layers and the
// resolver. Precedence: nearest layer wins; inside a layer the most specific
// selector wins (see docs/contracts/I4-field-renderers.md).
import type {
  DisplayRenderer,
  FieldDescriptor,
  FilterRenderer,
  InputRenderer,
  FieldRenderers,
  RendererOverrides,
  RendererRole,
} from "./types.ts";

/** The renderer type of each role. */
export interface RendererByRole {
  readonly display: DisplayRenderer;
  readonly input: InputRenderer;
  readonly filter: FilterRenderer;
}

/** The selectors that match `field` of `resource`, most specific first. */
export function selectorsFor(
  field: FieldDescriptor,
  resource: string,
): readonly string[] {
  const selectors = [`${resource}.${field.name}`];
  if (field.format !== null) {
    selectors.push(`${field.kind}:${field.format}`);
  }
  selectors.push(field.kind);
  return selectors;
}

/** One renderer role resolved from `layers` (nearest first); `undefined` when no layer has one. */
export function resolveRenderer<R extends RendererRole>(
  role: R,
  field: FieldDescriptor,
  resource: string,
  layers: readonly (RendererOverrides | undefined)[],
): RendererByRole[R] | undefined {
  const selectors = selectorsFor(field, resource);
  for (const layer of layers) {
    if (layer === undefined) continue;
    for (const selector of selectors) {
      const found = layer[selector]?.[role] as RendererByRole[R] | undefined;
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

interface Registration {
  readonly selector: string;
  readonly renderers: FieldRenderers;
}

let registrations: readonly Registration[] = [];
let snapshot: RendererOverrides = {};

function rebuild(): void {
  const next: Record<string, FieldRenderers> = {};
  for (const { selector, renderers } of registrations) {
    next[selector] = { ...next[selector], ...renderers };
  }
  snapshot = next;
}

/**
 * Registers renderers process-wide (the layer between `CrudProvider`'s
 * `renderers` and the built-ins). A later registration wins per role. Returns
 * the function that removes exactly this registration, in any order.
 * Prefer the provider's `renderers` prop in apps: this is shared state.
 */
export function registerFieldRenderer(
  selector: string,
  renderers: FieldRenderers,
): () => void {
  const mine: Registration = { selector, renderers };
  registrations = [...registrations, mine];
  rebuild();
  return () => {
    registrations = registrations.filter((r) => r !== mine);
    rebuild();
  };
}

/** The process-wide registrations merged (a new object after every change). */
export function getRegisteredRenderers(): RendererOverrides {
  return snapshot;
}
