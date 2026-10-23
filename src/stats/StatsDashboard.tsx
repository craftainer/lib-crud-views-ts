import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement, ReactNode } from "react";
import { CapabilityGate, type ViewProps } from "./shared.tsx";
import { StatsCategoryChart } from "./StatsCategoryChart.tsx";
import { StatsKpiCards } from "./StatsKpiCards.tsx";
import { StatsTablePanel } from "./StatsTablePanel.tsx";
import { StatsTimeSeries } from "./StatsTimeSeries.tsx";

export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Box component="section" aria-label={title}>
      <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** All four statistics variants on one page. Hidden without the `stats` capability. */
export function StatsDashboard(props: ViewProps): ReactElement {
  return (
    <CapabilityGate
      resource={props.resource}
      apiVersion={props.apiVersion}
      capability="stats"
    >
      {() => (
        <Box sx={{ display: "grid", gap: 4 }}>
          <StatsKpiCards {...props} />
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <Section title="Over time">
              <StatsTimeSeries {...props} />
            </Section>
            <Section title="By category">
              <StatsCategoryChart {...props} />
            </Section>
          </Box>
          <StatsTablePanel {...props} />
        </Box>
      )}
    </CapabilityGate>
  );
}
