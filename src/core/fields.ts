// Builds FieldDescriptors from a manifest resource (its `fields` list plus the
// read/create/update JSON Schemas).
import type { FieldSpec, JsonObject, Resource } from "@craftainer/crud-sdk";
import type {
  FieldConstraints,
  FieldDescriptor,
  FieldKind,
  FilterOp,
} from "./types.ts";

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const KINDS: readonly string[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "date",
  "datetime",
  "enum",
];

/** `power_level` -> `Power level`. */
export function humanize(name: string): string {
  const words = name.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface Node {
  readonly type: string | undefined;
  readonly format: string | undefined;
  readonly choices: readonly string[] | undefined;
  readonly nullable: boolean;
  readonly items: JsonObject | undefined;
  readonly constraints: FieldConstraints;
}

function resolveRef(node: JsonObject, root: JsonObject): JsonObject {
  const ref = node["$ref"];
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    return node;
  }
  let target: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    target = isObject(target) ? target[part] : undefined;
  }
  return isObject(target) ? { ...target, ...node, $ref: undefined } : node;
}

const num = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

/** Flattens `$ref`, `anyOf: [X, null]` and `type: [X, "null"]` into one node. */
function readNode(raw: unknown, root: JsonObject): Node {
  let node = isObject(raw) ? resolveRef(raw, root) : {};
  let nullable = false;
  const variants = node["anyOf"] ?? node["oneOf"];
  if (Array.isArray(variants)) {
    const resolved = variants
      .filter(isObject)
      .map((variant) => resolveRef(variant, root));
    const rest = resolved.filter((variant) => variant["type"] !== "null");
    nullable = rest.length < resolved.length;
    node = { ...node, ...rest[0] };
  }
  let type = node["type"];
  if (Array.isArray(type)) {
    nullable = nullable || type.includes("null");
    type = type.find((t) => t !== "null");
  } else if (type === "null") {
    nullable = true;
    type = undefined;
  }
  const enumValues = node["enum"];
  return {
    type: typeof type === "string" ? type : undefined,
    format: typeof node["format"] === "string" ? node["format"] : undefined,
    choices: Array.isArray(enumValues)
      ? enumValues.filter((v): v is string => typeof v === "string")
      : undefined,
    nullable,
    items: isObject(node["items"]) ? node["items"] : undefined,
    constraints: {
      minLength: num(node["minLength"]),
      maxLength: num(node["maxLength"]),
      minimum: num(node["minimum"]),
      maximum: num(node["maximum"]),
      pattern:
        typeof node["pattern"] === "string" ? node["pattern"] : undefined,
    },
  };
}

function schemaKind(node: Node): FieldKind {
  if (node.choices !== undefined) return "enum";
  switch (node.type) {
    case "string":
      return node.format === "date"
        ? "date"
        : node.format === "date-time"
          ? "datetime"
          : "string";
    case "integer":
    case "number":
    case "boolean":
      return node.type;
    case "array":
      return "array";
    default:
      return "json";
  }
}

function properties(schema: JsonObject): JsonObject {
  const props = schema["properties"];
  return isObject(props) ? props : {};
}

function requiredSet(schema: JsonObject): ReadonlySet<string> {
  const list = schema["required"];
  return new Set(
    Array.isArray(list)
      ? list.filter((v): v is string => typeof v === "string")
      : [],
  );
}

function describe(
  name: string,
  spec: FieldSpec | undefined,
  read: JsonObject,
  create: JsonObject,
  update: JsonObject,
): FieldDescriptor {
  const node = readNode(
    properties(read)[name] ??
      properties(create)[name] ??
      properties(update)[name],
    read,
  );
  const kind: FieldKind =
    spec === undefined
      ? schemaKind(node)
      : KINDS.includes(spec.value_type)
        ? (spec.value_type as FieldKind)
        : "string";
  const itemNode = readNode(node.items, read);
  return {
    name,
    label: humanize(name),
    kind,
    format: node.format ?? null,
    nullable: node.nullable,
    readOnly: !(name in properties(create) || name in properties(update)),
    required:
      spec === undefined ? requiredSet(create).has(name) : spec.required,
    choices: spec?.choices ?? node.choices ?? null,
    itemKind: kind === "array" ? schemaKind(itemNode) : null,
    constraints: node.constraints,
    inManifest: spec !== undefined,
    sortable: spec?.sortable ?? false,
    filterOps: (spec?.filter_ops ?? []) as readonly FilterOp[],
    numeric: spec?.numeric ?? false,
    categorical: spec?.categorical ?? false,
  };
}

/**
 * Every field of `resource`, in read-schema order, then manifest fields the
 * read schema does not list. The `id` field is included (read only).
 */
export function describeFields(resource: Resource): readonly FieldDescriptor[] {
  const { read, create, update } = resource.schemas;
  const specs = new Map(resource.fields.map((f) => [f.name, f]));
  const names = [
    ...new Set([
      ...Object.keys(properties(read)),
      ...resource.fields.map((f) => f.name),
    ]),
  ];
  return names.map((name) =>
    describe(name, specs.get(name), read, create, update),
  );
}
