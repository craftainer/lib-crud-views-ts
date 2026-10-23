import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, within } from "storybook/test";
import { lifecycleHeroes } from "../../tests/fixtures/routes/detail.ts";
import { PageShell } from "../core/index.ts";
import { RecordRevisions } from "./index.ts";

const meta = {
  title: "Revisions/History",
  parameters: { layout: "fullscreen", stub: { heroes: lifecycleHeroes() } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ListWithRestore: Story = {
  render: () => (
    <PageShell title="Revisions of Captain Ledger">
      <RecordRevisions resource="heroes" id={1} variant="list" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole("list", { name: "Revisions" });
  },
};

export const RestoreConfirm: Story = {
  render: () => (
    <PageShell title="Revisions of Captain Ledger">
      <RecordRevisions resource="heroes" id={1} variant="list" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", {
        name: "Restore revision 101",
      }),
    );
    await screen.findByRole("dialog");
  },
};

export const AuditTable: Story = {
  render: () => (
    <PageShell title="Audit trail">
      <RecordRevisions resource="heroes" id={1} variant="audit" />
    </PageShell>
  ),
};

export const FieldDiff: Story = {
  render: () => (
    <PageShell title="Compare revisions">
      <RecordRevisions resource="heroes" id={1} variant="diff" />
    </PageShell>
  ),
};

export const Preview: Story = {
  render: () => (
    <PageShell title="Preview a revision">
      <RecordRevisions resource="heroes" id={1} variant="preview" />
    </PageShell>
  ),
};
