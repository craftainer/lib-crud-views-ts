import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useEffect, useState, type ReactElement } from "react";
import type { FieldDescriptor } from "../core/index.ts";

export interface QuickSearchProps {
  /** The string fields to search (`icontains`); see `QueryStateApi.searchFields`. */
  readonly fields: readonly FieldDescriptor[];
  readonly value: string;
  /** The searched field; with several, a selector appears (the API cannot OR fields). */
  readonly field: string | undefined;
  readonly onChange: (value: string) => void;
  readonly onFieldChange: (field: string) => void;
  /** Wait this long after the last keystroke before calling `onChange`. Default 300. */
  readonly debounceMs?: number | undefined;
}

/** A search box: case-insensitive "contains" on one string field. Renders nothing without one. */
export function QuickSearch({
  fields,
  value,
  field,
  onChange,
  onFieldChange,
  debounceMs = 300,
}: QuickSearchProps): ReactElement | null {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    // The URL changed under us (back button, reset): follow it.
    setSeen(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return undefined;
    const timer = setTimeout(() => onChange(text), debounceMs);
    return () => clearTimeout(timer);
  }, [text, value, onChange, debounceMs]);
  if (fields.length === 0) return null;
  const current =
    fields.find((f) => f.name === field) ?? (fields[0] as FieldDescriptor);
  return (
    <Stack
      direction="row"
      spacing={1}
      role="search"
      aria-label="Quick search"
      sx={{ alignItems: "flex-start" }}
    >
      <TextField
        type="search"
        size="small"
        label={`Search ${current.label.toLowerCase()}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        sx={{ minWidth: 0, flex: "1 1 14rem" }}
      />
      {fields.length > 1 && (
        <TextField
          select
          size="small"
          label="Search in"
          value={current.name}
          onChange={(e) => onFieldChange(e.target.value)}
          sx={{ minWidth: "10rem" }}
        >
          {fields.map((f) => (
            <MenuItem key={f.name} value={f.name}>
              {f.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}
