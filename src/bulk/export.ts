import type { JsonObject } from "@craftainer/crud-sdk";
import type { FieldDescriptor } from "../core/index.ts";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  // A leading = + - @ (or tab/CR) makes a spreadsheet read the cell as a formula.
  const text =
    typeof value === "string" && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV: a header of field names, then one line per record. Objects and arrays become JSON. */
export function toCsv(
  fields: readonly FieldDescriptor[],
  rows: readonly JsonObject[],
): string {
  const lines = [
    fields.map((f) => cell(f.name)).join(","),
    ...rows.map((row) => fields.map((f) => cell(row[f.name])).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/** Offers `text` to the browser as a file download. */
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv",
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
