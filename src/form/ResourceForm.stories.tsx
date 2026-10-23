import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ResourceForm } from "./ResourceForm.tsx";

const noop = (): void => {};
// A clicked button keeps a pulsing focus ripple; blur it and let the ripple
// finish so a screenshot never catches it mid-way.
const settle = async (): Promise<void> => {
  (document.activeElement as HTMLElement | null)?.blur();
  await new Promise((r) => setTimeout(r, 900));
};
// Never matches the stub's ETag: the first save is a 412.
const staleEtag = (): string => 'W/"1-999"';

const meta = {
  title: "Form/Resource form",
  component: ResourceForm,
  parameters: { layout: "fullscreen" },
  args: { name: "heroes", recordLabel: "hero" },
} satisfies Meta<typeof ResourceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const CreateWithErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Create" }),
    );
    await canvas.findAllByText("Required");
    await settle();
  },
};

export const InvalidDraft: Story = {
  args: { initial: { name: "Nova", powers: ["light"] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText(/Power level/), "1.5");
    await expect(canvas.getByRole("button", { name: "Create" })).toBeDisabled();
  },
};

export const Edit: Story = { args: { id: 1 } };

export const Sections: Story = { args: { id: 1, layout: "sections" } };

export const Tabs: Story = {
  args: {
    layout: "tabs",
    sections: [
      { title: "Identity", fields: ["name"] },
      { title: "Powers", fields: ["powers", "power_level"] },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Create" }),
    );
    await canvas.findByRole("tab", { name: "Identity (1 error)" });
    await settle();
  },
};

export const Stepper: Story = {
  args: {
    layout: "stepper",
    sections: [
      { title: "Identity", fields: ["name"] },
      { title: "Powers", fields: ["powers", "power_level"] },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await canvas.findByText("Required");
    await settle();
  },
};

export const AutoSave: Story = { args: { id: 1, autoSave: true } };

export const ValidationFromServer: Story = {
  args: { id: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = await canvas.findByDisplayValue("Captain Ledger");
    await userEvent.clear(name);
    await userEvent.type(name, "INVALID");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await canvas.findByText("Value is not allowed");
    await settle();
  },
};

export const Conflict: Story = {
  args: { id: 1, etag: staleEtag },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText(/Name/), "!");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await canvas.findByRole("button", { name: "Overwrite" });
    await settle();
  },
};

export const Dialog: Story = {
  args: { id: 1, presentation: "dialog", open: true, onClose: noop },
};

export const Drawer: Story = {
  args: { id: 1, presentation: "drawer", open: true, onClose: noop },
};

export const LoadingRecord: Story = {
  args: { id: 1 },
  parameters: { stub: { list: "pending", manifest: "pending" } },
};

export const MissingRecord: Story = { args: { id: 99 } };
