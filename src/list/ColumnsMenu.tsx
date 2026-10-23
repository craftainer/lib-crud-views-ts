import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Popover from "@mui/material/Popover";
import { useId, useState, type ReactElement } from "react";
import type { Column } from "./columns.ts";

export interface ColumnsMenuProps {
  readonly columns: readonly Column[];
  /** Field names currently hidden. */
  readonly hidden: ReadonlySet<string>;
  readonly onChange: (hidden: ReadonlySet<string>) => void;
}

/** A button that opens a checklist of the columns, to show or hide each. */
export function ColumnsMenu({
  columns,
  hidden,
  onChange,
}: ColumnsMenuProps): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-controls={anchor === null ? undefined : id}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Columns
      </Button>
      <Popover
        id={id}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        slotProps={{
          paper: { "aria-label": "Columns", role: "dialog", sx: { p: 2 } },
        }}
      >
        <FormGroup>
          {columns.map((c) => (
            <FormControlLabel
              key={c.field.name}
              label={c.header}
              control={
                <Checkbox
                  size="small"
                  checked={!hidden.has(c.field.name)}
                  onChange={() => {
                    const next = new Set(hidden);
                    if (!next.delete(c.field.name)) next.add(c.field.name);
                    onChange(next);
                  }}
                />
              }
            />
          ))}
        </FormGroup>
      </Popover>
    </>
  );
}
