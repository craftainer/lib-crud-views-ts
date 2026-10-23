import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { DeleteAction, type DeleteActionProps } from "./DeleteAction.tsx";

/** A record card with its delete action, the way a list row or detail page hosts it. */
function Card(props: Partial<DeleteActionProps>) {
  return (
    <Paper variant="outlined" sx={{ m: 3, p: 2, maxWidth: "sm" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography>Captain Ledger</Typography>
        <DeleteAction name="heroes" id={1} recordLabel="hero" {...props} />
      </Stack>
    </Paper>
  );
}

const meta = {
  title: "Delete/Delete action",
  component: Card,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const press = async (canvasElement: HTMLElement): Promise<void> => {
  const canvas = within(canvasElement);
  await userEvent.click(
    await canvas.findByRole("button", { name: "Delete hero 1" }),
  );
};

export const Immediate: Story = { args: { variant: "immediate" } };

export const Confirm: Story = {
  args: { variant: "confirm" },
  play: async ({ canvasElement }) => {
    await press(canvasElement);
    await within(document.body).findByRole("dialog");
    await within(document.body).findByText("Captain Ledger", {
      selector: "dd *, dd",
    });
  },
};

export const UndoToast: Story = {
  args: { variant: "undo", undoMs: 600_000 },
  play: async ({ canvasElement }) => {
    await press(canvasElement);
    await within(document.body).findByText("Deleting hero 1…");
  },
};

export const SoftDelete: Story = {
  args: { variant: "soft" },
  parameters: { stub: { softDelete: true } },
  play: async ({ canvasElement }) => {
    await press(canvasElement);
    await within(document.body).findByText("Record archived");
  },
};
