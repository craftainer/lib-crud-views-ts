import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { ReactElement } from "react";
import { sortableFields, type SortKey } from "../filter/index.ts";
import type { ReadyResource } from "../core/index.ts";

export interface SortDropdownProps {
  readonly ready: ReadyResource;
  readonly sort: readonly SortKey[];
  readonly onChange: (sort: readonly SortKey[]) => void;
}

const NONE = "";

/** Sort by one field, for layouts with no header row to click. Lists only fields the manifest marks sortable. */
export function SortDropdown({
  ready,
  sort,
  onChange,
}: SortDropdownProps): ReactElement | null {
  const fields = sortableFields(ready.fields);
  if (fields.length === 0) return null;
  const key = sort[0];
  const field =
    key !== undefined && fields.some((f) => f.name === key.field)
      ? key.field
      : NONE;
  return (
    <Stack direction="row" spacing={1}>
      <TextField
        select
        size="small"
        label="Sort by"
        value={field}
        onChange={(e) =>
          onChange(
            e.target.value === NONE
              ? []
              : [{ field: e.target.value, desc: key?.desc ?? false }],
          )
        }
        sx={{ minWidth: "10rem" }}
      >
        <MenuItem value={NONE}>Default order</MenuItem>
        {fields.map((f) => (
          <MenuItem key={f.name} value={f.name}>
            {f.label}
          </MenuItem>
        ))}
      </TextField>
      {field !== NONE && (
        <TextField
          select
          size="small"
          label="Direction"
          value={key?.desc === true ? "desc" : "asc"}
          onChange={(e) =>
            onChange([{ field, desc: e.target.value === "desc" }])
          }
          sx={{ minWidth: "9rem" }}
        >
          <MenuItem value="asc">Ascending</MenuItem>
          <MenuItem value="desc">Descending</MenuItem>
        </TextField>
      )}
    </Stack>
  );
}
