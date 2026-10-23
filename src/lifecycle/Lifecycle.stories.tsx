import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactElement } from "react";
import { within, userEvent, screen } from "storybook/test";
import { lifecycleHeroes } from "../../tests/fixtures/routes/detail.ts";
import {
  FieldDisplay,
  PageShell,
  ResourceGate,
  type FieldValue,
  type ReadyResource,
} from "../core/index.ts";
import {
  ArchiveButton,
  ArchivedToggle,
  DraftControls,
  StatusBadge,
  StatusFilter,
  TrashList,
  statusQuery,
  type StatusFilterValue,
} from "./index.ts";

/** A status column with its filter: the pieces a list composes. */
function StatusList({ ready }: { ready: ReadyResource }): ReactElement {
  const [status, setStatus] = useState<StatusFilterValue>("all");
  const [archived, setArchived] = useState(false);
  const { includeUnpublished, filters } = statusQuery(status);
  const list = ready.hooks.useList({
    filters,
    includeUnpublished,
    includeArchived: archived,
  });
  const name = ready.field("name");
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <StatusFilter ready={ready} value={status} onChange={setStatus} />
        <ArchivedToggle
          ready={ready}
          checked={archived}
          onChange={setArchived}
        />
      </Stack>
      <Table size="small" aria-label="Heroes">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(list.data ?? []).map((row) => (
            <TableRow key={String(row["id"])}>
              <TableCell>
                {name !== undefined && (
                  <FieldDisplay
                    field={name}
                    resource={ready.resource.name}
                    value={row["name"] as FieldValue}
                  />
                )}
              </TableCell>
              <TableCell>
                <StatusBadge ready={ready} record={row} />
              </TableCell>
              <TableCell>
                <DraftControls
                  ready={ready}
                  record={row}
                  id={row["id"] as number}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}

const meta = {
  title: "Lifecycle/Draft and archive",
  parameters: {
    layout: "fullscreen",
    stub: { heroes: lifecycleHeroes() },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderList = (): ReactElement => (
  <PageShell title="Heroes">
    <ResourceGate name="heroes">
      {(ready) => <StatusList ready={ready} />}
    </ResourceGate>
  </PageShell>
);

export const StatusColumnAndFilter: Story = {
  render: renderList,
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Draft");
  },
};

export const DraftsOnly: Story = {
  render: renderList,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Draft" }),
    );
    await within(canvasElement).findByText("The Margin");
  },
};

export const ShowArchived: Story = {
  render: renderList,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("switch", {
        name: "Show archived",
      }),
    );
    await within(canvasElement).findByText("Old Stamp");
  },
};

export const Trash: Story = {
  render: () => (
    <PageShell title="Trash">
      <TrashList resource="heroes" />
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Old Stamp");
  },
};

export const ArchiveWithUndo: Story = {
  render: () => (
    <PageShell title="Captain Ledger">
      <ResourceGate name="heroes">
        {(ready) => <ArchiveButton ready={ready} id={1} />}
      </ResourceGate>
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Archive" }),
    );
    await screen.findByText("Record archived");
  },
};
