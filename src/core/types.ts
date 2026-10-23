// Contract I4 (docs/contracts/I4-field-renderers.md): the field model and the
// renderer prop types. Frozen by VW0; VW1-VW4 code against these names only.
import type { ComponentType } from "react";

/** What a manifest field renders as. `array` and `json` are fallbacks for schema members the manifest `fields` list does not cover. */
export type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "array"
  | "json";

/** The manifest's `filter_ops` vocabulary (`eq` is the bare `field=` form). */
export type FilterOp =
  "eq" | "min" | "max" | "in" | "contains" | "icontains" | "regex";

/** A JSON value as it travels on the wire. */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly FieldValue[]
  | { readonly [key: string]: FieldValue };

/** Validation hints lifted from the read/create/update JSON Schemas. */
export interface FieldConstraints {
  readonly minLength: number | undefined;
  readonly maxLength: number | undefined;
  readonly minimum: number | undefined;
  readonly maximum: number | undefined;
  readonly pattern: string | undefined;
}

/** One field of a resource, merged from the manifest `fields` and `schemas`. */
export interface FieldDescriptor {
  readonly name: string;
  /** Human label derived from `name` (`power_level` -> `Power level`). */
  readonly label: string;
  readonly kind: FieldKind;
  /** The JSON Schema `format` (`email`, `uri`, `uuid`, ...), or `null`. */
  readonly format: string | null;
  /** The value may be `null` (the schema allows it). */
  readonly nullable: boolean;
  /** Neither `create` nor `update` accepts it: show it, never edit it. */
  readonly readOnly: boolean;
  /** `create` requires it. */
  readonly required: boolean;
  /** `enum` choices (from the manifest field, else the schema). */
  readonly choices: readonly string[] | null;
  /** For `array`, the kind of the items. */
  readonly itemKind: FieldKind | null;
  readonly constraints: FieldConstraints;
  /** The manifest lists it as a field: it can be filtered/sorted per `filterOps`/`sortable`. */
  readonly inManifest: boolean;
  readonly sortable: boolean;
  readonly filterOps: readonly FilterOp[];
  readonly numeric: boolean;
  readonly categorical: boolean;
}

/** One operand of a filter. `datetime` filters carry `Date`s, `date` filters `YYYY-MM-DD` strings (the SDK's query builder wants exactly that). */
export type FilterScalar = string | number | boolean | Date;

/** The filter state of one field: operator -> operand (`in` takes an array). Absent or empty means no filter. */
export type FieldFilter = Readonly<
  Partial<Record<FilterOp, FilterScalar | readonly FilterScalar[]>>
>;

/** Filter state of a whole resource: field name -> its filter. */
export type FieldFilters = Readonly<Record<string, FieldFilter | undefined>>;

/** Props every renderer gets. */
interface RendererBase {
  readonly field: FieldDescriptor;
  /** The resource name, for renderers that special-case a field. */
  readonly resource: string;
  readonly size?: "small" | "medium" | undefined;
}

/** Shows a value. `value` is the wire value (`undefined` when the record has no such member). */
export interface DisplayRendererProps extends RendererBase {
  readonly value: FieldValue;
  readonly record?: Readonly<Record<string, FieldValue>> | undefined;
}

/**
 * Edits a value. Wire values in and out: strings for `string`/`enum`/`date`
 * (`YYYY-MM-DD`)/`datetime` (ISO-8601 UTC), numbers for `number`/`integer`,
 * booleans, arrays and JSON for `array`/`json`. A cleared input emits `null`
 * when the field is nullable, else `undefined` (leave the member out).
 */
export interface InputRendererProps extends RendererBase {
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly onBlur?: (() => void) | undefined;
  /** Validation message to show (the form owns validation). */
  readonly error?: string | undefined;
  readonly helperText?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
  readonly id?: string | undefined;
  /**
   * Reports whether the input's own draft is invalid, with the reason: it is
   * called with a message when the draft cannot be turned into a valid value
   * (non-numeric, malformed JSON, out of range) and with `null` when it is
   * valid again (or the input unmounts). A form blocks submit while any field
   * reports a reason. Additive to the frozen I4 (ADR 0002 addendum).
   */
  readonly onInvalid?: ((reason: string | null) => void) | undefined;
}

/** Edits the filter of one field. Emits `undefined` when cleared. */
export interface FilterRendererProps extends RendererBase {
  readonly value: FieldFilter | undefined;
  readonly onChange: (value: FieldFilter | undefined) => void;
}

export type DisplayRenderer = ComponentType<DisplayRendererProps>;
export type InputRenderer = ComponentType<InputRendererProps>;
export type FilterRenderer = ComponentType<FilterRendererProps>;

export type RendererRole = "display" | "input" | "filter";

/** The three renderers for one selector; each is optional. */
export interface FieldRenderers {
  readonly display?: DisplayRenderer;
  readonly input?: InputRenderer;
  readonly filter?: FilterRenderer;
}

/**
 * Selector -> renderers. A selector is `"<resource>.<field>"` (one field),
 * `"<kind>:<format>"` (`string:email`) or `"<kind>"` (`date`).
 */
export type RendererOverrides = Readonly<Record<string, FieldRenderers>>;
