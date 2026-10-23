// Pieces the stats and prediction variants share: the capability gate, the
// query states, the field descriptors for aggregates and the chart colors.
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/material/styles";
import type { UseQueryResult } from "@tanstack/react-query";
import type { JsonObject } from "@craftainer/crud-sdk";
import type { ReactElement, ReactNode } from "react";
import { formatBucket, type NumericStat, type StatsData } from "./model.ts";
import {
  FieldDisplay,
  ResourceGate,
  humanize,
  type FieldDescriptor,
  type FieldKind,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";

/** Props every stats and prediction variant takes. */
export interface ViewProps {
  /** The manifest resource name (`"heroes"`). */
  readonly resource: string;
  readonly apiVersion?: string | undefined;
  /** Field-renderer overrides, passed to every `FieldDisplay` the view renders. */
  readonly renderers?: RendererOverrides | undefined;
}

/**
 * Loads the resource and renders `children` only when the server offers
 * `capability`; without it the view renders nothing (hidden, not disabled).
 */
export function CapabilityGate({
  resource,
  apiVersion,
  capability,
  children,
}: {
  readonly resource: string;
  readonly apiVersion: string | undefined;
  readonly capability: "stats" | "predict";
  readonly children: (ready: ReadyResource) => ReactNode;
}): ReactElement {
  return (
    <ResourceGate name={resource} apiVersion={apiVersion}>
      {(ready) => (ready.capabilities[capability] ? children(ready) : null)}
    </ResourceGate>
  );
}

/** The loading and error states of one query; `children` gets the body once it is there. */
export function QueryBoundary({
  query,
  label,
  children,
}: {
  readonly query: UseQueryResult<JsonObject>;
  /** What is loading, for the spinner's accessible name (`"statistics"`). */
  readonly label: string;
  readonly children: (body: JsonObject) => ReactNode;
}): ReactElement {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error !== null) {
    return <Alert severity="warning">{query.error.message}</Alert>;
  }
  return (
    <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
      <CircularProgress aria-label={`Loading ${label}`} />
    </Box>
  );
}

/** A descriptor for a field the manifest does not describe (aggregates still have a name). */
function syntheticField(name: string, kind: FieldKind): FieldDescriptor {
  return {
    name,
    label: humanize(name),
    kind,
    format: null,
    nullable: true,
    readOnly: true,
    required: false,
    choices: null,
    itemKind: null,
    constraints: {
      minLength: undefined,
      maxLength: undefined,
      minimum: undefined,
      maximum: undefined,
      pattern: undefined,
    },
    inManifest: false,
    sortable: false,
    filterOps: [],
    numeric: kind === "number",
    categorical: kind !== "number",
  };
}

/**
 * The descriptor an aggregate of `name` is displayed with. An average or a
 * forecast of an `integer` field is fractional, so it shows as a `number`.
 */
export function aggregateField(
  ready: ReadyResource,
  name: string,
  value: number | null,
): FieldDescriptor {
  const base = ready.field(name) ?? syntheticField(name, "number");
  return base.kind === "integer" && value !== null && !Number.isInteger(value)
    ? { ...base, kind: "number" }
    : base;
}

/** The descriptor and wire value a categorical count row is displayed with. */
export function categoryField(
  ready: ReadyResource,
  name: string,
): FieldDescriptor {
  return ready.field(name) ?? syntheticField(name, "string");
}

/** Category values travel as strings; a boolean field's display wants a boolean. */
export const categoryValue = (
  field: FieldDescriptor,
  raw: string,
): string | boolean =>
  field.kind === "boolean" ? raw.toLowerCase() === "true" : raw;

/** A number rendered by the field's display renderer, at card or table size. */
export function Aggregate({
  ready,
  name,
  value,
  renderers,
}: {
  readonly ready: ReadyResource;
  readonly name: string;
  readonly value: number | null;
  readonly renderers: RendererOverrides | undefined;
}): ReactElement {
  return (
    <FieldDisplay
      field={aggregateField(ready, name, value)}
      resource={ready.resource.name}
      value={value}
      renderers={renderers}
    />
  );
}

export type ChartColors = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
];

/** The `index`-th color, cycling. */
export const colorAt = (colors: ChartColors, index: number): string =>
  colors[index % colors.length] as string;

/** Categorical series colors from the theme: CSS variables when the theme has them, so dark mode follows. */
export function useChartColors(): ChartColors {
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  return [
    palette.primary.main,
    palette.secondary.main,
    palette.info.main,
    palette.warning.main,
    palette.success.main,
    palette.error.main,
  ];
}

/** Lets the label, number and detail of a card read as one block. */
export const kpiValueSx = {
  "&& > *": { font: "inherit", color: "inherit" },
  typography: "h4",
  fontVariantNumeric: "tabular-nums",
} as const;

/** The numeric aggregates worth showing: the id column's statistics say nothing. */
export const dataStats = (
  ready: ReadyResource,
  stats: StatsData,
): readonly NumericStat[] =>
  stats.numeric.filter((stat) => stat.field !== ready.resource.id_field);

/**
 * A chart with its accessible name and a visible caption. The charts' own
 * `title` prop would put an `aria-label` on a role-less element, which axe
 * rejects, so the label lives on a `figure`.
 */
export function ChartFigure({
  title,
  caption,
  children,
}: {
  readonly title: string;
  readonly caption: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Box component="figure" aria-label={title} sx={{ m: 0 }}>
      {children}
      <Typography
        component="figcaption"
        variant="caption"
        color="text.secondary"
      >
        {caption}
      </Typography>
    </Box>
  );
}

/** The x axis of a chart over UTC buckets: positioned by real time, so gaps stay gaps, and labelled in UTC. */
export function timeAxis(
  at: readonly Date[],
  bucket: string,
  locale: string | undefined,
): {
  scaleType: "utc";
  data: Date[];
  tickNumber: number;
  height: number;
  label: string;
  valueFormatter: (value: Date) => string;
} {
  return {
    scaleType: "utc",
    data: [...at],
    tickNumber: 6,
    // Room for tick labels and the axis label; the default height leaves the labels no space.
    height: 56,
    label: "Bucket start (UTC)",
    valueFormatter: (value) => formatBucket(value, bucket, locale, true),
  };
}
