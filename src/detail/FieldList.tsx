import type { JsonObject } from "@craftainer/crud-sdk";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import {
  FieldDisplay,
  type FieldDescriptor,
  type FieldValue,
  type RendererOverrides,
} from "../core/index.ts";

export interface FieldListProps {
  readonly resource: string;
  readonly fields: readonly FieldDescriptor[];
  readonly record: JsonObject;
  readonly renderers?: RendererOverrides | undefined;
}

/** A label and value for each field, as a description list. */
export function FieldList({
  resource,
  fields,
  record,
  renderers,
}: FieldListProps): ReactElement {
  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "minmax(0, 1fr) minmax(0, 2fr)",
        },
        columnGap: 3,
        rowGap: 1.5,
        m: 0,
      }}
    >
      {fields.map((field) => (
        <Box key={field.name} sx={{ display: "contents" }}>
          <Typography
            component="dt"
            variant="subtitle2"
            color="text.secondary"
            sx={{ pt: 0.5 }}
          >
            {field.label}
          </Typography>
          <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
            <FieldDisplay
              field={field}
              resource={resource}
              value={record[field.name] as FieldValue}
              record={record as Record<string, FieldValue>}
              renderers={renderers}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
