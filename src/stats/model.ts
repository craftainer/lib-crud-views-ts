// Typed reads of the `/stats` and `/predict` bodies (lib-crud-py's
// `ResourceStatsView` and `PredictionView`). The SDK hands them over as plain
// JSON, so every member is read defensively and an unexpected shape degrades
// to an empty value instead of throwing inside a render.
import type { JsonObject } from "@craftainer/crud-sdk";

/** The time buckets the server aggregates by. */
export type Bucket = "day" | "week" | "month";

export const BUCKETS: readonly Bucket[] = ["day", "week", "month"];

export interface NumericStat {
  readonly field: string;
  readonly count: number;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly average: number | null;
  readonly total: number | null;
}

export interface CategoryCount {
  readonly field: string;
  readonly value: string;
  readonly count: number;
}

export interface SeriesPoint {
  /** Start of the bucket, an instant (the server's buckets are UTC calendar buckets). */
  readonly at: Date;
  readonly value: number;
}

export interface StatsData {
  readonly total: number;
  readonly numeric: readonly NumericStat[];
  readonly categorical: readonly CategoryCount[];
  /** Bucketed record counts; empty unless a bucket was requested. */
  readonly timeSeries: readonly SeriesPoint[];
}

export interface PredictionData {
  /** The forecast numeric field; `null` forecasts the record count. */
  readonly field: string | null;
  readonly bucket: string;
  readonly method: string;
  readonly lastKnown: SeriesPoint | null;
  readonly predictions: readonly SeriesPoint[];
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const objects = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : [];

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

const numOrNull = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

const text = (value: unknown): string =>
  typeof value === "string" ? value : String(value ?? "");

/**
 * Parses a bucket start. The server's buckets are UTC; a value without a zone
 * designator is read as UTC rather than as the browser's local time.
 */
export function parseInstant(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const zoned = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(value);
  const date = new Date(zoned ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function points(rows: readonly JsonObject[], valueKey: string): SeriesPoint[] {
  const result: SeriesPoint[] = [];
  for (const row of rows) {
    const at = parseInstant(row["bucket_start"]);
    if (at !== null) result.push({ at, value: num(row[valueKey]) });
  }
  return result.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Reads a `/stats` body. */
export function parseStats(body: JsonObject): StatsData {
  return {
    total: num(body["total"]),
    numeric: objects(body["numeric"]).map((row) => ({
      field: text(row["field"]),
      count: num(row["count"]),
      minimum: numOrNull(row["minimum"]),
      maximum: numOrNull(row["maximum"]),
      average: numOrNull(row["average"]),
      total: numOrNull(row["total"]),
    })),
    categorical: objects(body["categorical"]).map((row) => ({
      field: text(row["field"]),
      value: text(row["value"]),
      count: num(row["count"]),
    })),
    timeSeries: points(objects(body["time_series"]), "count"),
  };
}

const pointOf = (value: unknown): SeriesPoint | null => {
  if (!isObject(value)) return null;
  const at = parseInstant(value["bucket_start"]);
  return at === null ? null : { at, value: num(value["value"]) };
};

/** Reads a `/predict` body. */
export function parsePrediction(body: JsonObject): PredictionData {
  const field = body["field"];
  return {
    field: typeof field === "string" ? field : null,
    bucket: text(body["bucket"]),
    method: text(body["method"]),
    lastKnown: pointOf(body["last_known"]),
    predictions: points(objects(body["predictions"]), "value"),
  };
}

/** The distinct categorical field names, in first-seen order. */
export function categoricalFields(data: StatsData): string[] {
  return [...new Set(data.categorical.map((row) => row.field))];
}

/**
 * A bucket start as a label, always in UTC: `Jan 5, 2026` for a `day` or
 * `week` bucket, `Jan 2026` for a `month`. `compact` drops the year of a day
 * or week, for axis ticks.
 */
export function formatBucket(
  at: Date,
  bucket: string,
  locale: string | undefined,
  compact = false,
): string {
  const monthly = bucket === "month";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    ...(monthly || !compact ? { year: "numeric" } : {}),
    ...(monthly ? {} : { day: "numeric" }),
  }).format(at);
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Averages and forecasts are fractional; two decimals read well in a card. */
export const rounded = (value: number | null): number | null =>
  value === null ? null : round2(value);

export interface ForecastSeries {
  /** Every x position, oldest first. */
  readonly at: readonly Date[];
  /** Known values (`null` where only the forecast has a point). */
  readonly known: readonly (number | null)[];
  /** The forecast, anchored at the last known point so the lines meet. */
  readonly forecast: readonly (number | null)[];
}

/**
 * Lines up the known series and the forecast on one time axis. The positions
 * are the buckets the server returned, so a gap in the history stays a gap and
 * the forecast follows the bucket spacing; nothing is interpolated.
 */
export function forecastSeries(
  history: readonly SeriesPoint[],
  prediction: PredictionData,
): ForecastSeries {
  const known = new Map<number, number>();
  for (const point of history) known.set(point.at.getTime(), point.value);
  const { lastKnown } = prediction;
  if (lastKnown !== null && !known.has(lastKnown.at.getTime())) {
    known.set(lastKnown.at.getTime(), lastKnown.value);
  }
  const projected = new Map<number, number>();
  if (lastKnown !== null) {
    projected.set(lastKnown.at.getTime(), lastKnown.value);
  }
  for (const point of prediction.predictions) {
    projected.set(point.at.getTime(), point.value);
  }
  const times = [...new Set([...known.keys(), ...projected.keys()])].sort(
    (a, b) => a - b,
  );
  return {
    at: times.map((time) => new Date(time)),
    known: times.map((time) => known.get(time) ?? null),
    forecast: times.map((time) => projected.get(time) ?? null),
  };
}
