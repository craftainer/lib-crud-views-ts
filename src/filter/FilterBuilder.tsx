import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement } from "react";
import {
  isFilterable,
  withOp,
  type FieldDescriptor,
  type FieldFilter,
  type FieldFilters,
  type FilterOp,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { FilterControl } from "./FilterControl.tsx";
import { formatOperand, parseOperand } from "./queryState.ts";

export interface FilterBuilderProps {
  readonly ready: ReadyResource;
  readonly filters: FieldFilters;
  readonly onChange: (filters: FieldFilters) => void;
  readonly renderers?: RendererOverrides | undefined;
}

interface Condition {
  readonly field: string;
  readonly op: FilterOp;
}

/** Operators the built-in filter renderers edit one at a time; the others get a text box. */
const RENDERED: Readonly<Record<string, readonly FilterOp[]>> = {
  string: ["eq", "contains", "icontains"],
  number: ["eq", "min", "max"],
  integer: ["eq", "min", "max"],
  date: ["eq", "min", "max"],
  datetime: ["eq", "min", "max"],
  enum: ["eq", "in"],
  boolean: ["eq"],
};

const OP_LABEL: Readonly<Record<FilterOp, string>> = {
  eq: "equals",
  min: "at least",
  max: "at most",
  in: "is one of",
  contains: "contains",
  icontains: "contains (any case)",
  regex: "matches pattern",
};

const keyOf = (c: Condition): string => `${c.field}\u0000${c.op}`;

/** The conditions the filters already hold, in field then operator order. */
function conditionsOf(filters: FieldFilters): Condition[] {
  return Object.keys(filters).flatMap((field) =>
    Object.keys(filters[field] ?? {}).map((op) => ({
      field,
      op: op as FilterOp,
    })),
  );
}

interface OperandProps {
  readonly field: FieldDescriptor;
  readonly op: FilterOp;
  readonly resource: string;
  readonly value: FieldFilter | undefined;
  readonly onChange: (value: FieldFilter | undefined) => void;
  readonly renderers?: RendererOverrides | undefined;
}

/** The operand of one condition: the field's own filter renderer restricted to the operator, or a text box. */
function Operand({ field, op, ...rest }: OperandProps): ReactElement {
  if (RENDERED[field.kind]?.includes(op) === true) {
    return <FilterControl field={{ ...field, filterOps: [op] }} {...rest} />;
  }
  return <TextOperand field={field} op={op} {...rest} />;
}

const textOf = (operand: FieldFilter[FilterOp] | undefined): string =>
  operand === undefined ? "" : formatOperand(operand);

/** The text box of a condition. It keeps what was typed while that does not parse yet, and follows filters changed from outside (Clear all, Back). */
function TextOperand({
  field,
  op,
  value,
  onChange,
}: OperandProps): ReactElement {
  const operand = value?.[op];
  const [text, setText] = useState(textOf(operand));
  const [seen, setSeen] = useState(operand);
  if (operand !== seen) {
    setSeen(operand);
    // Typed text that already means this operand stays as typed.
    if (textOf(parseOperand(field, op, text)) !== textOf(operand)) {
      setText(textOf(operand));
    }
  }
  return (
    <TextField
      size="small"
      fullWidth
      label={`${field.label} ${OP_LABEL[op]}`}
      helperText={
        op === "in"
          ? field.kind === "datetime"
            ? "Comma-separated, times are UTC"
            : "Comma-separated"
          : undefined
      }
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(withOp(value, op, parseOperand(field, op, e.target.value)));
      }}
    />
  );
}

/**
 * A list of conditions, each "field, operator, operand". Operands use the
 * field's filter renderer where it edits that operator, a text box otherwise.
 * Several conditions on one field combine as the API does: all must hold.
 */
export function FilterBuilder({
  ready,
  filters,
  onChange,
  renderers,
}: FilterBuilderProps): ReactElement {
  const keyField = ready.resource.id_field;
  const filterable = ready.fields.filter(
    (f) => isFilterable(f) && f.name !== keyField,
  );
  // Conditions added but not yet given an operand; the rest come from `filters`.
  const [pending, setPending] = useState<readonly Condition[]>([]);
  const present = conditionsOf(filters);
  const rows = [
    ...present,
    ...pending.filter((p) => !present.some((c) => keyOf(c) === keyOf(p))),
  ];
  const setOperand = (c: Condition, value: FieldFilter | undefined): void => {
    // Clearing the operand must not make the row vanish under the cursor.
    if (!pending.some((p) => keyOf(p) === keyOf(c)))
      setPending([...pending, c]);
    onChange({ ...filters, [c.field]: value });
  };
  const drop = (c: Condition): void => {
    setPending(pending.filter((p) => keyOf(p) !== keyOf(c)));
    onChange({
      ...filters,
      [c.field]: withOp(filters[c.field], c.op, undefined),
    });
  };
  const move = (from: Condition, to: Condition): void => {
    setPending([...pending.filter((p) => keyOf(p) !== keyOf(from)), to]);
    onChange({
      ...filters,
      [from.field]: withOp(filters[from.field], from.op, undefined),
    });
  };
  const add = (): void => {
    const field =
      filterable.find((f) => !rows.some((c) => c.field === f.name)) ??
      filterable[0];
    if (field === undefined) return;
    const op = field.filterOps[0] as FilterOp;
    // Every field has a condition already: do not queue a twin of one.
    if (
      [...rows, ...pending].some((c) => c.field === field.name && c.op === op)
    )
      return;
    setPending([
      ...pending,
      { field: field.name, op: field.filterOps[0] as FilterOp },
    ]);
  };
  return (
    <Stack component="section" aria-label="Filter builder" spacing={2}>
      {rows.map((c, index) => {
        const field = filterable.find((f) => f.name === c.field);
        const label = `Condition ${index + 1}`;
        // The filters still hold it (and the server still gets it), so show it to be removed.
        if (field === undefined) {
          return (
            <Stack
              key={keyOf(c)}
              direction="row"
              role="group"
              aria-label={label}
              sx={{ gap: 1, alignItems: "center" }}
            >
              <Typography color="text.secondary">
                {`${c.field} ${OP_LABEL[c.op]} (not filterable here)`}
              </Typography>
              <Button
                aria-label={`Remove ${label.toLowerCase()}`}
                onClick={() => drop(c)}
              >
                Remove
              </Button>
            </Stack>
          );
        }
        return (
          <Stack
            key={keyOf(c)}
            direction="row"
            role="group"
            aria-label={label}
            useFlexGap
            sx={{ flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}
          >
            <TextField
              select
              size="small"
              label="Field"
              value={c.field}
              onChange={(e) => {
                const next = ready.field(e.target.value) as FieldDescriptor;
                move(c, {
                  field: next.name,
                  op: next.filterOps[0] as FilterOp,
                });
              }}
              sx={{ minWidth: "10rem" }}
            >
              {filterable.map((f) => (
                <MenuItem key={f.name} value={f.name}>
                  {f.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Operator"
              value={c.op}
              onChange={(e) =>
                move(c, { field: c.field, op: e.target.value as FilterOp })
              }
              sx={{ minWidth: "10rem" }}
            >
              {field.filterOps.map((op) => (
                <MenuItem key={op} value={op}>
                  {OP_LABEL[op]}
                </MenuItem>
              ))}
            </TextField>
            <Stack sx={{ minWidth: "12rem", flex: "1 1 12rem" }}>
              <Operand
                field={field}
                op={c.op}
                resource={ready.resource.name}
                value={filters[c.field]}
                onChange={(value) => setOperand(c, value)}
                renderers={renderers}
              />
            </Stack>
            <Button
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={() => drop(c)}
            >
              Remove
            </Button>
          </Stack>
        );
      })}
      <Stack direction="row" spacing={1}>
        <Button onClick={add}>Add condition</Button>
        {rows.length > 0 && (
          <Button
            onClick={() => {
              setPending([]);
              onChange({});
            }}
          >
            Clear all
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
