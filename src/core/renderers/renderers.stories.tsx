import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactElement } from "react";
import {
  FieldDisplay,
  FieldFilterInput,
  FieldInput,
} from "../fieldComponents.tsx";
import type { FieldDescriptor, FieldFilter, FieldValue } from "../types.ts";

const base: FieldDescriptor = {
  name: "field",
  label: "Field",
  kind: "string",
  format: null,
  nullable: false,
  readOnly: false,
  required: false,
  choices: null,
  itemKind: null,
  constraints: {
    minLength: undefined,
    maxLength: undefined,
    minimum: undefined,
    maximum: undefined,
    pattern: undefined,
  },
  inManifest: true,
  sortable: true,
  filterOps: [],
  numeric: false,
  categorical: false,
};

/** One field in its three roles: display, input and filter. */
function Gallery({
  field,
  value: initial,
  filter: initialFilter,
}: {
  field: FieldDescriptor;
  value: FieldValue;
  filter?: FieldFilter;
}): ReactElement {
  const [value, setValue] = useState<FieldValue>(initial);
  const [filter, setFilter] = useState<FieldFilter | undefined>(initialFilter);
  return (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 480 }}>
      <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
        <Typography variant="overline" color="text.secondary">
          Display
        </Typography>
        <FieldDisplay field={field} resource="demo" value={value} />
      </Stack>
      <Divider />
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary">
          Input
        </Typography>
        <FieldInput
          field={field}
          resource="demo"
          value={value}
          onChange={setValue}
        />
      </Stack>
      <Divider />
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary">
          Filter
        </Typography>
        <FieldFilterInput
          field={field}
          resource="demo"
          value={filter}
          onChange={setFilter}
        />
      </Stack>
    </Stack>
  );
}

const meta = {
  title: "Core/Field renderers",
  component: Gallery,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {
    field: {
      ...base,
      name: "name",
      label: "Name",
      required: true,
      filterOps: ["eq", "icontains", "contains"],
    },
    value: "Captain Ledger",
    filter: { icontains: "ledger" },
  },
};

export const Email: Story = {
  args: {
    field: {
      ...base,
      name: "contact",
      label: "Contact",
      format: "email",
      filterOps: ["eq"],
    },
    value: "ledger@example.com",
  },
};

export const Integer: Story = {
  args: {
    field: {
      ...base,
      name: "power_level",
      label: "Power level",
      kind: "integer",
      nullable: true,
      numeric: true,
      filterOps: ["eq", "min", "max"],
    },
    value: 72,
    filter: { min: 40 },
  },
};

export const Number: Story = {
  args: {
    field: {
      ...base,
      name: "ratio",
      label: "Ratio",
      kind: "number",
      filterOps: ["min", "max"],
    },
    value: 0.375,
  },
};

export const Boolean: Story = {
  args: {
    field: {
      ...base,
      name: "is_locked",
      label: "Is locked",
      kind: "boolean",
      categorical: true,
      filterOps: ["eq"],
    },
    value: true,
    filter: { eq: true },
  },
};

export const Date: Story = {
  args: {
    field: {
      ...base,
      name: "due_on",
      label: "Due on",
      kind: "date",
      format: "date",
      nullable: true,
      filterOps: ["min", "max"],
    },
    value: "2026-03-14",
    filter: { min: "2026-03-01" },
  },
};

export const Datetime: Story = {
  args: {
    field: {
      ...base,
      name: "updated_at",
      label: "Updated at",
      kind: "datetime",
      format: "date-time",
      readOnly: true,
      filterOps: ["min", "max"],
    },
    value: "2026-01-02T09:30:00Z",
  },
};

export const Enum: Story = {
  args: {
    field: {
      ...base,
      name: "difficulty",
      label: "Difficulty",
      kind: "enum",
      required: true,
      categorical: true,
      choices: ["easy", "hard", "deadly"],
      filterOps: ["eq", "in"],
    },
    value: "hard",
    filter: { in: ["hard", "deadly"] },
  },
};

export const Array: Story = {
  args: {
    field: {
      ...base,
      name: "powers",
      label: "Powers",
      kind: "array",
      itemKind: "string",
      inManifest: false,
    },
    value: ["Foresight", "Filing"],
  },
};

export const Json: Story = {
  args: {
    field: {
      ...base,
      name: "extra",
      label: "Extra",
      kind: "json",
      nullable: true,
      inManifest: false,
    },
    value: { tags: ["a", "b"], depth: 2 },
  },
};

export const Empty: Story = {
  args: {
    field: {
      ...base,
      name: "title",
      label: "Title",
      nullable: true,
      filterOps: ["icontains"],
    },
    value: null,
  },
};
