import type { FieldKind, FieldRenderers, RendererOverrides } from "../types.ts";
import {
  ArrayDisplay,
  BooleanDisplay,
  DateDisplay,
  DatetimeDisplay,
  EnumDisplay,
  JsonDisplay,
  NumberDisplay,
  StringDisplay,
} from "./display.tsx";
import {
  BooleanFilter,
  DateFilter,
  DatetimeFilter,
  EnumFilter,
  NoFilter,
  NumberFilter,
  StringFilter,
} from "./filter.tsx";
import {
  ArrayInput,
  BooleanInput,
  DateInput,
  DatetimeInput,
  EnumInput,
  JsonInput,
  NumberInput,
  StringInput,
} from "./input.tsx";

const kinds: Record<FieldKind, Required<FieldRenderers>> = {
  string: { display: StringDisplay, input: StringInput, filter: StringFilter },
  number: { display: NumberDisplay, input: NumberInput, filter: NumberFilter },
  integer: { display: NumberDisplay, input: NumberInput, filter: NumberFilter },
  boolean: {
    display: BooleanDisplay,
    input: BooleanInput,
    filter: BooleanFilter,
  },
  date: { display: DateDisplay, input: DateInput, filter: DateFilter },
  datetime: {
    display: DatetimeDisplay,
    input: DatetimeInput,
    filter: DatetimeFilter,
  },
  enum: { display: EnumDisplay, input: EnumInput, filter: EnumFilter },
  array: { display: ArrayDisplay, input: ArrayInput, filter: NoFilter },
  json: { display: JsonDisplay, input: JsonInput, filter: NoFilter },
};

/** The built-in layer: one entry per `FieldKind`. */
export const builtinRenderers: RendererOverrides = kinds;
