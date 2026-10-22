import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { FieldDisplay } from "./fieldComponents.tsx";
import { PageShell } from "./shells.tsx";
import { ResourceGate } from "./ResourceGate.tsx";
import type { ReadyResource } from "./useResource.ts";

/** A bare table built only from the core: the first-use example for view authors. */
function HeroTable({ ready }: { ready: ReadyResource }): ReactElement {
  const { hooks, fields, resource } = ready;
  const list = hooks.useList({ limit: 10 });
  const shown = fields.filter((f) =>
    ["name", "powers", "power_level", "is_draft", "updated_at"].includes(
      f.name,
    ),
  );
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {shown.map((f) => (
            <TableCell key={f.name}>{f.label}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {(list.data ?? []).map((row) => (
          <TableRow key={String(row["id"])}>
            {shown.map((f) => (
              <TableCell key={f.name}>
                <FieldDisplay
                  field={f}
                  resource={resource.name}
                  value={row[f.name] as never}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const meta = {
  title: "Core/Resource gate",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  render: () => (
    <PageShell
      title="Heroes"
      subtitle="Rendered from the manifest by the core alone"
    >
      <ResourceGate name="heroes">
        {(ready) => <HeroTable ready={ready} />}
      </ResourceGate>
    </PageShell>
  ),
};

export const Loading: Story = {
  parameters: { stub: { manifest: "pending" } },
  render: () => <ResourceGate name="heroes">{() => null}</ResourceGate>,
};

export const ManifestDown: Story = {
  parameters: { stub: { manifest: "down" } },
  render: () => (
    <PageShell title="Heroes">
      <ResourceGate name="heroes">{() => null}</ResourceGate>
    </PageShell>
  ),
};

export const UnknownResource: Story = {
  render: () => (
    <PageShell title="Ghosts">
      <ResourceGate name="ghosts">{() => null}</ResourceGate>
    </PageShell>
  ),
};
