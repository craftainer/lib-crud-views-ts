import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { humanize, type ReadyResource } from "../core/index.ts";
import { parseStats, rounded, type NumericStat } from "./model.ts";
import {
  Aggregate,
  dataStats,
  CapabilityGate,
  QueryBoundary,
  kpiValueSx,
  type ViewProps,
} from "./shared.tsx";

function Kpi({
  label,
  children,
  detail,
}: {
  readonly label: string;
  readonly children: ReactElement;
  readonly detail?: ReactElement | undefined;
}): ReactElement {
  return (
    <Card variant="outlined" component="li" sx={{ listStyle: "none" }}>
      <CardContent>
        <Typography component="h3" variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Box sx={kpiValueSx}>{children}</Box>
        {detail}
      </CardContent>
    </Card>
  );
}

function Range({
  ready,
  stat,
  renderers,
}: {
  readonly ready: ReadyResource;
  readonly stat: NumericStat;
  readonly renderers: ViewProps["renderers"];
}): ReactElement {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}
    >
      {"Range"}
      <Aggregate
        ready={ready}
        name={stat.field}
        value={stat.minimum}
        renderers={renderers}
      />
      {"to"}
      <Aggregate
        ready={ready}
        name={stat.field}
        value={stat.maximum}
        renderers={renderers}
      />
    </Typography>
  );
}

function Cards({
  ready,
  renderers,
}: {
  readonly ready: ReadyResource;
  readonly renderers: ViewProps["renderers"];
}): ReactElement {
  const query = ready.hooks.useStats();
  return (
    <QueryBoundary query={query} label="statistics">
      {(body) => {
        const stats = parseStats(body);
        return (
          <Box
            component="ul"
            aria-label={`${ready.resource.title} key figures`}
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
              gap: 2,
              m: 0,
              p: 0,
            }}
          >
            <Kpi label="Records">
              <Aggregate
                ready={ready}
                name="count"
                value={stats.total}
                renderers={renderers}
              />
            </Kpi>
            {dataStats(ready, stats).map((stat) => (
              <Kpi
                key={stat.field}
                label={`Average ${humanize(stat.field).toLowerCase()}`}
                detail={
                  stat.minimum === null || stat.maximum === null ? undefined : (
                    <Range ready={ready} stat={stat} renderers={renderers} />
                  )
                }
              >
                <Aggregate
                  ready={ready}
                  name={stat.field}
                  value={rounded(stat.average)}
                  renderers={renderers}
                />
              </Kpi>
            ))}
          </Box>
        );
      }}
    </QueryBoundary>
  );
}

/** Variant 1: one card for the record count and one per numeric field (average, with its range). Hidden without the `stats` capability. */
export function StatsKpiCards({
  resource,
  apiVersion,
  renderers,
}: ViewProps): ReactElement {
  return (
    <CapabilityGate
      resource={resource}
      apiVersion={apiVersion}
      capability="stats"
    >
      {(ready) => <Cards ready={ready} renderers={renderers} />}
    </CapabilityGate>
  );
}
