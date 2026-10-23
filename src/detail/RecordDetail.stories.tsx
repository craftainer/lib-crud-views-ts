import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, within } from "storybook/test";
import { lifecycleHeroes } from "../../tests/fixtures/routes/detail.ts";
import { FieldInput } from "../core/index.ts";
import { RecordDetail, type DetailFormContext } from "./index.ts";

/** Stands in for VW2's edit form, which an app passes through `renderForm`. */
function FormSlot({ ready, record }: DetailFormContext) {
  const field = ready.field("name");
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        {field !== undefined && (
          <FieldInput
            field={field}
            resource={ready.resource.name}
            value={record["name"] as string}
            onChange={() => {}}
          />
        )}
      </Stack>
    </Paper>
  );
}

const meta = {
  title: "Detail/Record",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {
  render: () => <RecordDetail resource="heroes" id={1} variant="page" />,
};

export const EditFormAsDetail: Story = {
  render: () => (
    <RecordDetail
      resource="heroes"
      id={1}
      variant="form"
      renderForm={(context) => <FormSlot {...context} />}
    />
  ),
};

export const MetadataPanel: Story = {
  render: () => <RecordDetail resource="heroes" id={2} variant="metadata" />,
};

export const Tabs: Story = {
  render: () => <RecordDetail resource="heroes" id={1} variant="tabs" />,
};

export const TabsHistory: Story = {
  parameters: { stub: { heroes: lifecycleHeroes() } },
  render: () => <RecordDetail resource="heroes" id={1} variant="tabs" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "History" }));
    await canvas.findByRole("table", { name: "Audit trail" });
  },
};

export const Dialog: Story = {
  render: () => (
    <RecordDetail
      resource="heroes"
      id={1}
      variant="dialog"
      onClose={() => {}}
    />
  ),
  play: async () => {
    await screen.findByRole("dialog");
    await screen.findByText("Captain Ledger");
  },
};

export const Drawer: Story = {
  render: () => (
    <RecordDetail
      resource="heroes"
      id={1}
      variant="drawer"
      onClose={() => {}}
    />
  ),
  play: async () => {
    await screen.findByText("Captain Ledger");
  },
};

/** A draft shows its status with Publish and Discard draft. */
export const Draft: Story = {
  parameters: { stub: { heroes: lifecycleHeroes() } },
  render: () => <RecordDetail resource="heroes" id={2} variant="page" />,
};

/** An archived record offers Restore. */
export const Archived: Story = {
  parameters: { stub: { heroes: lifecycleHeroes() } },
  render: () => <RecordDetail resource="heroes" id={3} variant="page" />,
};

/** `quests` has no drafts, archive or revisions: none of those controls appear. */
export const NoOptionalFeatures: Story = {
  render: () => <RecordDetail resource="quests" id={1} variant="tabs" />,
};
