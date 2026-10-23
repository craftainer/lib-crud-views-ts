import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";
import {
  FieldFilterInput,
  type FieldDescriptor,
  type FieldFilter,
  type RendererOverrides,
} from "../core/index.ts";

export interface FilterControlProps {
  readonly field: FieldDescriptor;
  readonly resource: string;
  readonly value: FieldFilter | undefined;
  readonly onChange: (value: FieldFilter | undefined) => void;
  readonly renderers?: RendererOverrides | undefined;
}

/** The filter renderer of one field. A datetime filter says its operands are UTC. */
export function FilterControl({
  field,
  resource,
  value,
  onChange,
  renderers,
}: FilterControlProps): ReactElement {
  return (
    <Stack spacing={0.5}>
      <FieldFilterInput
        field={field}
        resource={resource}
        value={value}
        onChange={onChange}
        renderers={renderers}
      />
      {field.kind === "datetime" && (
        <FormHelperText>{`${field.label}: times are UTC`}</FormHelperText>
      )}
    </Stack>
  );
}
