import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";
import { useState, type ReactElement } from "react";
import { useCrud } from "../core/index.ts";
import { BUCKETS, parseStats, type Bucket } from "./model.ts";
import {
  CapabilityGate,
  ChartFigure,
  QueryBoundary,
  timeAxis,
  useChartColors,
  type ViewProps,
} from "./shared.tsx";
import type { ReadyResource } from "../core/index.ts";

export interface BucketPickerProps {
  readonly value: Bucket;
  readonly onChange: (bucket: Bucket) => void;
}

/** Day / week / month toggle, labelled and keyboard-operable. */
export function BucketPicker({
  value,
  onChange,
}: BucketPickerProps): ReactElement {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      aria-label="Bucket size"
      onChange={(_event, next: Bucket | null) => {
        if (next !== null) onChange(next);
      }}
    >
      {BUCKETS.map((bucket) => (
        <ToggleButton
          key={bucket}
          value={bucket}
          sx={{ color: "text.primary" }}
        >
          {bucket}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function Series({
  ready,
  bucket,
}: {
  readonly ready: ReadyResource;
  readonly bucket: Bucket;
}): ReactElement {
  const { locale } = useCrud();
  const [color] = useChartColors();
  const query = ready.hooks.useStats({ bucket });
  return (
    <QueryBoundary query={query} label="time series">
      {(body) => {
        const { timeSeries } = parseStats(body);
        if (timeSeries.length === 0) {
          return (
            <Typography color="text.secondary">
              {"No records in this period."}
            </Typography>
          );
        }
        return (
          <ChartFigure
            title={`${ready.resource.title} created per ${bucket}`}
            caption={`Records created per ${bucket}; buckets are UTC calendar buckets and empty ones are left out.`}
          >
            <LineChart
              height={280}
              skipAnimation
              hideLegend
              xAxis={[
                timeAxis(
                  timeSeries.map((point) => point.at),
                  bucket,
                  locale,
                ),
              ]}
              yAxis={[{ label: "Records", min: 0 }]}
              series={[
                {
                  id: "count",
                  label: "Records",
                  data: timeSeries.map((point) => point.value),
                  color,
                  showMark: true,
                  curve: "linear",
                  connectNulls: true,
                },
              ]}
            />
          </ChartFigure>
        );
      }}
    </QueryBoundary>
  );
}

export interface StatsTimeSeriesProps extends ViewProps {
  /** The initial bucket size. Default `"day"`. */
  readonly bucket?: Bucket | undefined;
}

/**
 * Variant 2: records created per UTC bucket as a line chart, with a
 * day/week/month toggle. Buckets with no records are absent from the server's
 * series and stay absent on the time axis. Hidden without the `stats`
 * capability.
 */
export function StatsTimeSeries({
  resource,
  apiVersion,
  bucket: initial = "day",
}: StatsTimeSeriesProps): ReactElement {
  const [bucket, setBucket] = useState<Bucket>(initial);
  return (
    <CapabilityGate
      resource={resource}
      apiVersion={apiVersion}
      capability="stats"
    >
      {(ready) => (
        <Box component="section" aria-label="Records over time">
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <BucketPicker value={bucket} onChange={setBucket} />
          </Box>
          <Series ready={ready} bucket={bucket} />
        </Box>
      )}
    </CapabilityGate>
  );
}
