import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DialogShell, DrawerShell, PageShell } from "./index.ts";

const body = (
  <Typography>
    The shell frames whatever a view renders into it; the theme supplies every
    color, size and radius.
  </Typography>
);
const noop = (): void => {};

const meta = {
  title: "Core/Shells",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {
  render: () => (
    <PageShell
      title="Heroes"
      subtitle="Everyone the ledger tracks"
      breadcrumbs={[
        <Link key="home" href="#home">
          Home
        </Link>,
        "Heroes",
      ]}
      actions={<Button variant="contained">Add hero</Button>}
    >
      {body}
    </PageShell>
  ),
};

export const Dialog: Story = {
  render: () => (
    <DialogShell
      open
      onClose={noop}
      title="Edit hero"
      actions={<Button variant="contained">Save</Button>}
    >
      {body}
    </DialogShell>
  ),
};

export const Drawer: Story = {
  render: () => (
    <DrawerShell
      open
      onClose={noop}
      title="Hero details"
      actions={<Button variant="contained">Save</Button>}
    >
      {body}
    </DrawerShell>
  ),
};
