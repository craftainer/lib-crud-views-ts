// Which fields go in which section of a form.
import type { FieldDescriptor } from "../core/index.ts";

/** A titled group of fields, by field name. */
export interface FormSection {
  readonly title: string;
  readonly fields: readonly string[];
}

export type FormLayoutKind = "flat" | "sections" | "tabs" | "stepper";

/**
 * The sections of a form. Given `sections`, fields they do not name go to a
 * trailing "Other" section; without them, required fields come first under
 * "Required", the rest under "Optional". Empty sections are dropped.
 */
export function groupFields(
  fields: readonly FieldDescriptor[],
  sections: readonly FormSection[] | undefined,
): readonly FormSection[] {
  const names = new Set(fields.map((f) => f.name));
  const given =
    sections === undefined
      ? [
          {
            title: "Required",
            fields: fields.filter((f) => f.required).map((f) => f.name),
          },
          {
            title: "Optional",
            fields: fields.filter((f) => !f.required).map((f) => f.name),
          },
        ]
      : sections.map((s) => ({
          title: s.title,
          fields: s.fields.filter((name) => names.has(name)),
        }));
  const used = new Set(given.flatMap((s) => s.fields));
  const rest = fields.map((f) => f.name).filter((name) => !used.has(name));
  return [...given, { title: "Other", fields: rest }].filter(
    (s) => s.fields.length > 0,
  );
}
