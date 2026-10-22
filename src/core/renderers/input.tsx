import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useId, useState, type ReactElement } from "react";
import { humanize } from "../fields.ts";
import { emptyValue } from "../values.ts";
import type { FieldValue, InputRendererProps } from "../types.ts";

function common(props: InputRendererProps): {
  id: string | undefined;
  label: string;
  size: "small" | "medium";
  fullWidth: true;
  required: boolean;
  disabled: boolean;
  autoFocus: boolean;
  error: boolean;
  helperText: string | undefined;
  onBlur: (() => void) | undefined;
} {
  return {
    id: props.id,
    label: props.field.label,
    size: props.size ?? "small",
    fullWidth: true,
    required: props.field.required,
    disabled: props.disabled === true,
    autoFocus: props.autoFocus === true,
    error: props.error !== undefined,
    helperText: props.error ?? props.helperText,
    onBlur: props.onBlur,
  };
}

const text = (value: FieldValue): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

export function StringInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const { maxLength, minLength, pattern } = field.constraints;
  const type =
    field.format === "email"
      ? "email"
      : field.format === "uri"
        ? "url"
        : "text";
  return (
    <TextField
      {...common(props)}
      type={type}
      multiline={maxLength !== undefined && maxLength > 200}
      minRows={3}
      value={text(value)}
      onChange={(e) =>
        onChange(e.target.value === "" ? emptyValue(field) : e.target.value)
      }
      slotProps={{ htmlInput: { maxLength, minLength, pattern } }}
    />
  );
}

export function NumberInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const { minimum, maximum } = field.constraints;
  return (
    <TextField
      {...common(props)}
      type="number"
      value={text(value)}
      onChange={(e) =>
        onChange(
          e.target.value === "" ? emptyValue(field) : Number(e.target.value),
        )
      }
      slotProps={{
        htmlInput: {
          min: minimum,
          max: maximum,
          step: field.kind === "integer" ? 1 : "any",
        },
      }}
    />
  );
}

export function BooleanInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange, disabled, onBlur, size } = props;
  return (
    <FormControlLabel
      label={field.label}
      disabled={disabled === true}
      control={
        <Switch
          size={size ?? "small"}
          checked={value === true}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.checked)}
        />
      }
    />
  );
}

export function DateInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  return (
    <TextField
      {...common(props)}
      type="date"
      value={text(value).slice(0, 10)}
      onChange={(e) =>
        onChange(e.target.value === "" ? emptyValue(field) : e.target.value)
      }
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}

/** Edits an ISO-8601 UTC timestamp; the browser's `datetime-local` field is read as UTC. */
export function DatetimeInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const toLocal = (v: FieldValue): string => {
    const date = new Date(text(v));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
  };
  return (
    <TextField
      {...common(props)}
      type="datetime-local"
      value={toLocal(value)}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(
          raw === "" ? emptyValue(field) : new Date(`${raw}Z`).toISOString(),
        );
      }}
      helperText={props.error ?? props.helperText ?? "UTC"}
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}

export function EnumInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const labelId = useId();
  return (
    <TextField
      {...common(props)}
      select
      value={text(value)}
      onChange={(e) =>
        onChange(e.target.value === "" ? emptyValue(field) : e.target.value)
      }
      slotProps={{ inputLabel: { id: labelId }, select: { labelId } }}
    >
      {!field.required && (
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
      )}
      {(field.choices ?? []).map((choice) => (
        <MenuItem key={choice} value={choice}>
          {humanize(choice)}
        </MenuItem>
      ))}
    </TextField>
  );
}

const INVALID = Symbol("invalid");
type Parsed = { ok: true; value: FieldValue } | { ok: false };

/**
 * Keeps the typed text while it has no valid value yet, and follows outside
 * changes of `value` (React's "adjust state during render" pattern).
 */
function useDraft(
  value: FieldValue,
  toText: (v: FieldValue) => string,
  fromText: (raw: string) => Parsed,
): [string, (raw: string) => FieldValue | typeof INVALID] {
  const key = JSON.stringify(value);
  const [draft, setDraft] = useState(() => toText(value));
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    const parsed = fromText(draft);
    if (!parsed.ok || JSON.stringify(parsed.value) !== key) {
      setDraft(toText(value));
    }
  }
  return [
    draft,
    (raw) => {
      setDraft(raw);
      const parsed = fromText(raw);
      return parsed.ok ? parsed.value : INVALID;
    },
  ];
}

export function ArrayInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const numeric = field.itemKind === "number" || field.itemKind === "integer";
  const [draft, edit] = useDraft(
    value,
    (v) => (Array.isArray(v) ? v.join(", ") : ""),
    (raw) => {
      const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      if (items.length === 0) return { ok: true, value: emptyValue(field) };
      return { ok: true, value: numeric ? items.map(Number) : items };
    },
  );
  return (
    <TextField
      {...common(props)}
      value={draft}
      helperText={
        props.error ?? props.helperText ?? "Separate items with commas"
      }
      onChange={(e) => {
        // Splitting on commas always yields a value.
        onChange(edit(e.target.value) as FieldValue);
      }}
    />
  );
}

export function JsonInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const [draft, edit] = useDraft(
    value,
    (v) => (v === null || v === undefined ? "" : JSON.stringify(v, null, 2)),
    (raw) => {
      if (raw.trim() === "") return { ok: true, value: emptyValue(field) };
      try {
        return { ok: true, value: JSON.parse(raw) as FieldValue };
      } catch {
        return { ok: false };
      }
    },
  );
  const [invalid, setInvalid] = useState(false);
  return (
    <TextField
      {...common(props)}
      multiline
      minRows={3}
      value={draft}
      error={invalid || props.error !== undefined}
      helperText={
        invalid ? "Not valid JSON" : (props.error ?? props.helperText)
      }
      slotProps={{ htmlInput: { style: { fontFamily: "monospace" } } }}
      onChange={(e) => {
        const next = edit(e.target.value);
        setInvalid(next === INVALID);
        if (next !== INVALID) onChange(next);
      }}
    />
  );
}
