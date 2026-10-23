import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ReactElement } from "react";
import type { ReadyResource } from "../core/index.ts";
import type { StatusFilterValue } from "./status.ts";

export interface StatusFilterProps {
  readonly ready: ReadyResource;
  readonly value: StatusFilterValue;
  readonly onChange: (value: StatusFilterValue) => void;
}

/** Published / Draft / All. Hidden unless `capabilities.draft_publish`. */
export function StatusFilter({
  ready,
  value,
  onChange,
}: StatusFilterProps): ReactElement | null {
  if (!ready.capabilities.draft_publish) return null;
  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        aria-label="Status"
        sx={{ "& .MuiToggleButton-root": { color: "text.primary" } }}
        onChange={(_event, next: StatusFilterValue | null) => {
          if (next !== null) onChange(next);
        }}
      >
        <ToggleButton value="published">Published</ToggleButton>
        <ToggleButton value="draft">Draft</ToggleButton>
        <ToggleButton value="all">All</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
