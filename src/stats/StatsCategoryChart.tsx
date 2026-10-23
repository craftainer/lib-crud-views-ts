import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useState, type ReactElement } from "react";
import { humanize, type ReadyResource } from "../core/index.ts";
import { categoricalFields, parseStats, type StatsData } from "./model.ts";
import {
  CapabilityGate,
  ChartFigure,
  colorAt,
  QueryBoundary,
  useChartColors,
  type ViewProps,
} from "./shared.tsx";

export type CategoryChartKind = "bar" | "pie";

/** `true` / `false` and enum values, as a chart label. */
const labelOf = (raw: string): string => humanize(raw);

function Chart({
  ready,
  stats,
  field,
  kind,
}: {
  readonly ready: ReadyResource;
  readonly stats: StatsData;
  readonly field: string;
  readonly kind: CategoryChartKind;
}): ReactElement {
  const colors = useChartColors();
  const rows = stats.categorical.filter((row) => row.field === field);
  const title = `${ready.resource.title} by ${humanize(field).toLowerCase()}`;
  const caption = `Number of records for each value of ${humanize(field)}.`;
  if (kind === "pie") {
    return (
      <ChartFigure title={title} caption={caption}>
        <PieChart
          height={280}
          skipAnimation
          series={[
            {
              innerRadius: 40,
              paddingAngle: 2,
              data: rows.map((row, index) => ({
                id: row.value,
                label: labelOf(row.value),
                value: row.count,
                color: colorAt(colors, index),
              })),
            },
          ]}
        />
      </ChartFigure>
    );
  }
  return (
    <ChartFigure title={title} caption={caption}>
      <BarChart
        height={280}
        skipAnimation
        hideLegend
        xAxis={[
          {
            scaleType: "band",
            data: rows.map((row) => labelOf(row.value)),
            colorMap: {
              type: "ordinal",
              values: rows.map((row) => labelOf(row.value)),
              colors: rows.map((_row, index) => colorAt(colors, index)),
            },
          },
        ]}
        yAxis={[{ label: "Records", min: 0 }]}
        series={[
          { id: "count", label: "Records", data: rows.map((r) => r.count) },
        ]}
      />
    </ChartFigure>
  );
}

function Panel({
  ready,
  kind,
  initialField,
}: {
  readonly ready: ReadyResource;
  readonly kind: CategoryChartKind;
  readonly initialField: string | undefined;
}): ReactElement {
  const [chosen, setChosen] = useState<string | undefined>(initialField);
  const [shape, setShape] = useState<CategoryChartKind>(kind);
  const query = ready.hooks.useStats();
  return (
    <QueryBoundary query={query} label="distribution">
      {(body) => {
        const stats = parseStats(body);
        const fields = categoricalFields(stats);
        const field =
          chosen !== undefined && fields.includes(chosen) ? chosen : fields[0];
        if (field === undefined) {
          return (
            <Typography color="text.secondary">
              {"No categorical fields to chart."}
            </Typography>
          );
        }
        return (
          <>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <TextField
                select
                size="small"
                label="Field"
                value={field}
                sx={{ minWidth: "12rem" }}
                onChange={(event) => setChosen(event.target.value)}
              >
                {fields.map((name) => (
                  <MenuItem key={name} value={name}>
                    {humanize(name)}
                  </MenuItem>
                ))}
              </TextField>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={shape}
                aria-label="Chart type"
                onChange={(_event, next: CategoryChartKind | null) => {
                  if (next !== null) setShape(next);
                }}
              >
                <ToggleButton value="bar" sx={{ color: "text.primary" }}>
                  {"Bar"}
                </ToggleButton>
                <ToggleButton value="pie" sx={{ color: "text.primary" }}>
                  {"Pie"}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Chart ready={ready} stats={stats} field={field} kind={shape} />
          </>
        );
      }}
    </QueryBoundary>
  );
}

export interface StatsCategoryChartProps extends ViewProps {
  /** The initial chart. Default `"bar"`. */
  readonly kind?: CategoryChartKind | undefined;
  /** The categorical field shown first. Default: the first the server reports. */
  readonly field?: string | undefined;
}

/**
 * Variant 3: the value distribution of a boolean or enum field as a bar or pie
 * chart, with a field picker and a chart-type toggle. Hidden without the
 * `stats` capability.
 */
export function StatsCategoryChart({
  resource,
  apiVersion,
  kind = "bar",
  field,
}: StatsCategoryChartProps): ReactElement {
  return (
    <CapabilityGate
      resource={resource}
      apiVersion={apiVersion}
      capability="stats"
    >
      {(ready) => (
        <Box component="section" aria-label="Distribution">
          <Panel ready={ready} kind={kind} initialField={field} />
        </Box>
      )}
    </CapabilityGate>
  );
}
