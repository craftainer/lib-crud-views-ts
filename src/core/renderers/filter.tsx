import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { ReactElement } from "react";
import { humanize } from "../fields.ts";
import { withOp } from "../filterState.ts";
import type {
  FieldDescriptor,
  FilterOp,
  FilterRendererProps,
  FilterScalar,
} from "../types.ts";

const has = (field: FieldDescriptor, op: FilterOp): boolean =>
  field.filterOps.includes(op);

const scalar = (v: unknown): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";

const label = (field: FieldDescriptor, suffix?: string): string =>
  suffix === undefined ? field.label : `${field.label} ${suffix}`;

export function StringFilter({
  field,
  value,
  onChange,
  size,
}: FilterRendererProps): ReactElement | null {
  const op = (["icontains", "contains", "eq"] as const).find((o) =>
    has(field, o),
  );
  if (op === undefined) return null;
  return (
    <TextField
      size={size ?? "small"}
      fullWidth
      label={label(field)}
      value={scalar(value?.[op])}
      onChange={(e) =>
        onChange(
          withOp(value, op, e.target.value === "" ? undefined : e.target.value),
        )
      }
    />
  );
}

/** `min`/`max` for numbers, dates and datetimes; `eq` when the field has no range operators. */
function RangeFilter({
  field,
  value,
  onChange,
  size,
  type,
  parse,
  show,
}: FilterRendererProps & {
  type: "number" | "date" | "datetime-local";
  /** `null`: the text is no operand (the change is ignored). */
  parse: (raw: string) => FilterScalar | null;
  show: (v: unknown) => string;
}): ReactElement | null {
  const ops = (["min", "max"] as const).filter((o) => has(field, o));
  const used = ops.length > 0 ? ops : has(field, "eq") ? (["eq"] as const) : [];
  if (used.length === 0) return null;
  return (
    <Stack direction="row" spacing={1}>
      {used.map((op) => (
        <TextField
          key={op}
          type={type}
          size={size ?? "small"}
          fullWidth
          label={
            op === "eq"
              ? label(field)
              : label(field, op === "min" ? "from" : "to")
          }
          value={show(value?.[op])}
          onChange={(e) => {
            const operand =
              e.target.value === "" ? undefined : parse(e.target.value);
            if (operand !== null) onChange(withOp(value, op, operand));
          }}
          slotProps={{
            inputLabel: { shrink: type !== "number" ? true : undefined },
          }}
        />
      ))}
    </Stack>
  );
}

export function NumberFilter(props: FilterRendererProps): ReactElement | null {
  return <RangeFilter {...props} type="number" parse={Number} show={scalar} />;
}

export function DateFilter(props: FilterRendererProps): ReactElement | null {
  return <RangeFilter {...props} type="date" parse={String} show={scalar} />;
}

/** Datetime operands are `Date`s; the browser field is read as UTC. */
export function DatetimeFilter(
  props: FilterRendererProps,
): ReactElement | null {
  return (
    <RangeFilter
      {...props}
      type="datetime-local"
      parse={(raw) => {
        const instant = new Date(`${raw}Z`);
        // The browser takes years beyond 9999, which ISO-8601 cannot write unsigned.
        return Number.isNaN(instant.getTime()) ? null : instant;
      }}
      show={(v) =>
        v instanceof Date && !Number.isNaN(v.getTime())
          ? v.toISOString().slice(0, 16)
          : ""
      }
    />
  );
}

export function BooleanFilter({
  field,
  value,
  onChange,
  size,
}: FilterRendererProps): ReactElement | null {
  if (!has(field, "eq")) return null;
  const current = value?.eq;
  return (
    <TextField
      select
      size={size ?? "small"}
      fullWidth
      label={label(field)}
      value={typeof current === "boolean" ? String(current) : ""}
      onChange={(e) =>
        onChange(
          withOp(
            value,
            "eq",
            e.target.value === "" ? undefined : e.target.value === "true",
          ),
        )
      }
    >
      <MenuItem value="">Any</MenuItem>
      <MenuItem value="true">Yes</MenuItem>
      <MenuItem value="false">No</MenuItem>
    </TextField>
  );
}

/** Multi-select over `choices` as `in`, or a single choice as `eq`. */
export function EnumFilter({
  field,
  value,
  onChange,
  size,
}: FilterRendererProps): ReactElement | null {
  const op = has(field, "in") ? "in" : has(field, "eq") ? "eq" : undefined;
  if (op === undefined) return null;
  const selected = value?.[op];
  const many = op === "in";
  return (
    <TextField
      select
      size={size ?? "small"}
      fullWidth
      label={label(field)}
      value={
        many
          ? Array.isArray(selected)
            ? selected.map(String)
            : []
          : scalar(selected)
      }
      onChange={(e) => {
        const raw = e.target.value as unknown as string | string[];
        onChange(withOp(value, op, raw === "" ? undefined : raw));
      }}
      slotProps={{ select: { multiple: many } }}
    >
      {!many && <MenuItem value="">Any</MenuItem>}
      {(field.choices ?? []).map((choice) => (
        <MenuItem key={choice} value={choice}>
          {humanize(choice)}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** For kinds the manifest cannot filter (`array`, `json`): renders nothing. */
export function NoFilter(): null {
  return null;
}
