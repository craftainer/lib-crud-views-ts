import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageShell } from "../core/index.ts";
import { PredictionChart } from "./PredictionChart.tsx";
import { PredictionKpi } from "./PredictionKpi.tsx";
import { PredictionTable } from "./PredictionTable.tsx";
import { PredictionsDashboard } from "./PredictionsDashboard.tsx";

const meta = {
  title: "Predictions/Variants",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chart: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Forecast of records created per day">
      <PredictionChart resource="heroes" />
    </PageShell>
  ),
};

export const ChartOfField: Story = {
  render: () => (
    <PageShell
      title="Heroes"
      subtitle="Forecast of summed power level per week"
    >
      <PredictionChart
        resource="heroes"
        field="power_level"
        bucket="week"
        periods={3}
      />
    </PageShell>
  ),
};

export const Table: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Forecast table">
      <PredictionTable resource="heroes" periods={5} />
    </PageShell>
  ),
};

export const NextPeriodKpi: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Next period">
      <Box sx={{ maxWidth: "24rem" }}>
        <PredictionKpi resource="heroes" field="power_level" />
      </Box>
    </PageShell>
  ),
};

export const Dashboard: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Predictions" maxWidth="xl">
      <PredictionsDashboard resource="heroes" />
    </PageShell>
  ),
};

/** One month of history is too little: the server answers 422 and says so. */
export const InsufficientHistory: Story = {
  render: () => (
    <PageShell title="Heroes" subtitle="Forecast by month">
      <PredictionChart resource="heroes" bucket="month" />
    </PageShell>
  ),
};

/** heroes v1 does not offer `predict`: every variant renders nothing. */
export const HiddenWithoutCapability: Story = {
  render: () => (
    <PageShell title="Heroes v1" subtitle="No predict capability">
      <Box sx={{ display: "grid", gap: 2 }}>
        <Typography>
          {"Nothing below this line: the server cannot predict."}
        </Typography>
        <PredictionsDashboard resource="heroes" apiVersion="v1" />
      </Box>
    </PageShell>
  ),
};
