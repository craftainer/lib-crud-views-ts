import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
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

/**
 * Tells `onInvalid` when `reason` changes, and clears it when the input
 * unmounts so a hidden field never keeps a form blocked.
 */
function useReportInvalid(
  reason: string | null,
  onInvalid: InputRendererProps["onInvalid"],
): void {
  const callback = useRef(onInvalid);
  const reported = useRef<string | null>(null);
  useEffect(() => {
    callback.current = onInvalid;
  });
  useEffect(() => {
    if (reported.current !== reason) {
      reported.current = reason;
      callback.current?.(reason);
    }
  }, [reason]);
  useEffect(
    () => () => {
      if (reported.current !== null) {
        reported.current = null;
        callback.current?.(null);
      }
    },
    [],
  );
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

/** Why a number is out of the field's bounds, or `null`. */
function numberProblem(
  field: InputRendererProps["field"],
  value: FieldValue,
): string | null {
  if (typeof value !== "number") return null;
  const { minimum, maximum } = field.constraints;
  if (field.kind === "integer" && !Number.isInteger(value)) {
    return "Enter a whole number";
  }
  if (minimum !== undefined && value < minimum) {
    return `Must be at least ${minimum}`;
  }
  if (maximum !== undefined && value > maximum) {
    return `Must be at most ${maximum}`;
  }
  return null;
}

export function NumberInput(props: InputRendererProps): ReactElement {
  const { field, value, onChange } = props;
  const { minimum, maximum } = field.constraints;
  // The browser hands over "" for text that is not a number; remember that.
  const [unparsable, setUnparsable] = useState(false);
  const problem = unparsable ? "Enter a number" : numberProblem(field, value);
  useReportInvalid(problem, props.onInvalid);
  return (
    <TextField
      {...common(props)}
      type="number"
      value={text(value)}
      error={problem !== null || props.error !== undefined}
      helperText={props.error ?? problem ?? props.helperText}
      onChange={(e) => {
        setUnparsable(e.target.value === "" && e.target.validity.badInput);
        onChange(
          e.target.value === "" ? emptyValue(field) : Number(e.target.value),
        );
      }}
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
  const help = props.error ?? props.helperText;
  return (
    <FormControl error={props.error !== undefined} disabled={disabled === true}>
      <FormControlLabel
        label={field.label}
        required={field.required}
        sx={{ ml: 0 }}
        control={
          <Switch
            id={props.id}
            size={size ?? "small"}
            checked={value === true}
            autoFocus={props.autoFocus === true}
            onBlur={onBlur}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
      />
      {help === undefined ? null : <FormHelperText>{help}</FormHelperText>}
    </FormControl>
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
      if (!numeric) return { ok: true, value: items };
      const numbers = items.map(Number);
      return numbers.some(Number.isNaN)
        ? { ok: false }
        : { ok: true, value: numbers };
    },
  );
  const invalid =
    numeric &&
    draft.split(",").some((s) => s.trim() !== "" && Number.isNaN(Number(s)));
  useReportInvalid(invalid ? "Items must be numbers" : null, props.onInvalid);
  return (
    <TextField
      {...common(props)}
      value={draft}
      error={invalid || props.error !== undefined}
      helperText={
        invalid
          ? "Items must be numbers"
          : (props.error ?? props.helperText ?? "Separate items with commas")
      }
      onChange={(e) => {
        const next = edit(e.target.value);
        if (next !== INVALID) onChange(next);
      }}
    />
  );
}

function isJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
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
  // Derived from the text, so it follows resets of the draft.
  const invalid = draft.trim() !== "" && !isJson(draft);
  useReportInvalid(invalid ? "Not valid JSON" : null, props.onInvalid);
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
        if (next !== INVALID) onChange(next);
      }}
    />
  );
}
