import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageShell } from "../core/index.ts";
import type { Bucket } from "./model.ts";
import { StatsCategoryChart } from "./StatsCategoryChart.tsx";
import { StatsDashboard } from "./StatsDashboard.tsx";
import { StatsKpiCards } from "./StatsKpiCards.tsx";
import { StatsTablePanel } from "./StatsTablePanel.tsx";
import { StatsTimeSeries } from "./StatsTimeSeries.tsx";

const meta = {
  title: "Stats/Variants",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KpiCards: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Key figures">
      <StatsKpiCards resource="heroes" />
    </PageShell>
  ),
};

export const TimeSeries: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Records over time">
      <StatsTimeSeries resource="heroes" />
    </PageShell>
  ),
};

export const TimeSeriesMonthly: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Records over time, by month">
      <StatsTimeSeries resource="heroes" bucket="month" />
    </PageShell>
  ),
};

export const TimeSeriesFailed: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="The server rejected the bucket">
      <StatsTimeSeries resource="heroes" bucket={"year" as Bucket} />
    </PageShell>
  ),
};

export const CategoryBar: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Distribution">
      <StatsCategoryChart resource="heroes" />
    </PageShell>
  ),
};

export const CategoryPie: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Distribution">
      <StatsCategoryChart resource="heroes" kind="pie" field="is_locked" />
    </PageShell>
  ),
};

export const TablePanel: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Statistics">
      <StatsTablePanel resource="heroes" />
    </PageShell>
  ),
};

export const Dashboard: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Statistics" maxWidth="xl">
      <StatsDashboard resource="heroes" />
    </PageShell>
  ),
};

/** heroes v1 does not offer `stats`: every variant renders nothing. */
export const HiddenWithoutCapability: Story = {
  render: () => (
    <PageShell title="Heroes v1" subtitle="No statistics capability">
      <Box sx={{ display: "grid", gap: 2 }}>
        <Typography>
          {"Nothing below this line: the server has no stats."}
        </Typography>
        <StatsDashboard resource="heroes" apiVersion="v1" />
      </Box>
    </PageShell>
  ),
};
