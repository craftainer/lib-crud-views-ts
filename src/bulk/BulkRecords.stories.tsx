import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, within } from "storybook/test";
import { lifecycleHeroes } from "../../tests/fixtures/routes/detail.ts";
import { manyHeroes } from "../../tests/fixtures/routes/list.ts";
import { PageShell } from "../core/index.ts";
import { BulkRecords } from "./index.ts";

const meta = {
  title: "Bulk/Records",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const tick = async (canvasElement: HTMLElement, id: number): Promise<void> => {
  await userEvent.click(
    await within(canvasElement).findByRole("checkbox", {
      name: `Select record ${id}`,
    }),
  );
};

export const NothingSelected: Story = {
  render: () => (
    <PageShell title="Heroes">
      <BulkRecords resource="heroes" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Captain Ledger");
  },
};

export const SelectionToolbar: Story = {
  parameters: { stub: { heroes: lifecycleHeroes(), listDrafts: true } },
  render: () => (
    <PageShell title="Heroes">
      <BulkRecords resource="heroes" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await tick(canvasElement, 1);
    await tick(canvasElement, 2);
    await within(canvasElement).findByText("2 selected");
  },
};

export const SelectAllMatching: Story = {
  render: () => (
    <PageShell title="Heroes matching “Captain”">
      <BulkRecords
        resource="heroes"
        filters={{ name: { icontains: "captain" } }}
      />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await tick(canvasElement, 1);
    await userEvent.click(
      await within(canvasElement).findByRole("button", {
        name: "Select all matching the filter",
      }),
    );
    await within(canvasElement).findByText(
      "All records matching the filter are selected",
    );
  },
};

export const ConfirmDelete: Story = {
  render: () => (
    <PageShell title="Heroes">
      <BulkRecords resource="heroes" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await tick(canvasElement, 1);
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Delete" }),
    );
    await screen.findByRole("dialog");
  },
};

/** More records match than `bulk.max_matched`: the server answers 400 and the toolbar says why. */
export const OverTheLimit: Story = {
  parameters: { stub: { heroes: manyHeroes(1001) } },
  render: () => (
    <PageShell title="Heroes">
      <BulkRecords
        resource="heroes"
        filters={{ power_level: { min: 0 } }}
        limit={5}
      />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await tick(canvasElement, 1);
    await userEvent.click(
      await within(canvasElement).findByRole("button", {
        name: "Select all matching the filter",
      }),
    );
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Delete" }),
    );
    await userEvent.click(
      await within(await screen.findByRole("dialog")).findByRole("button", {
        name: "Delete",
      }),
    );
    await within(canvasElement).findByText(/at most 1000 records/);
  },
};

/** `quests` has no draft or publish: Publish is not offered. */
export const NoPublish: Story = {
  render: () => (
    <PageShell title="Quests">
      <BulkRecords resource="quests" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await tick(canvasElement, 1);
    await within(canvasElement).findByText("1 selected");
  },
};
