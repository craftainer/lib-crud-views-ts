// `/stats` and `/predict` of heroes v2, the fixture manifest's one resource
// with both capabilities, shaped like lib-crud-py's `ResourceStatsView` and
// `PredictionView`. The daily series has a real gap (no records on Jan 7,
// Jan 10-11 and Jan 13-25) and the forecast regresses on whole buckets since the first one,
// as the server does, so it follows bucket spacing.
import {
  PROFILE,
  createClient,
  type CrudClient,
  type JsonObject,
} from "@craftainer/crud-sdk";
import manifest from "../manifest.json" with { type: "json" };

const HEROES_V2 = "/api/crud/v1/heroes/v2/json";

const DAY_MS = 86_400_000;

interface Point {
  readonly at: number;
  readonly value: number;
}

const day = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Records created per day, and the sum of `power_level` per day. */
const COUNTS: readonly Point[] = [
  { at: day("2026-01-05"), value: 3 },
  { at: day("2026-01-06"), value: 4 },
  { at: day("2026-01-08"), value: 5 },
  { at: day("2026-01-09"), value: 6 },
  { at: day("2026-01-12"), value: 6 },
  { at: day("2026-01-26"), value: 7 },
];
const POWER_SUMS: readonly Point[] = [
  { at: day("2026-01-05"), value: 60 },
  { at: day("2026-01-06"), value: 80 },
  { at: day("2026-01-08"), value: 90 },
  { at: day("2026-01-09"), value: 110 },
  { at: day("2026-01-12"), value: 300 },
  { at: day("2026-01-26"), value: 520 },
];

type Bucket = "day" | "week" | "month";

function bucketStart(at: number, bucket: Bucket): number {
  if (bucket === "day") return at;
  const date = new Date(at);
  if (bucket === "month") {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  return at - ((date.getUTCDay() + 6) % 7) * DAY_MS;
}

function advance(at: number, bucket: Bucket, steps: number): number {
  if (bucket === "day") return at + steps * DAY_MS;
  if (bucket === "week") return at + steps * 7 * DAY_MS;
  const date = new Date(at);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + steps, 1);
}

function bucketed(points: readonly Point[], bucket: Bucket): Point[] {
  const sums = new Map<number, number>();
  for (const { at, value } of points) {
    const start = bucketStart(at, bucket);
    sums.set(start, (sums.get(start) ?? 0) + value);
  }
  return [...sums]
    .map(([at, value]) => ({ at, value }))
    .sort((a, b) => a.at - b.at);
}

const iso = (at: number): string => new Date(at).toISOString();
const asPoint = ({ at, value }: Point): JsonObject => ({
  bucket_start: iso(at),
  value,
});

/** Whole buckets between two bucket starts, the regression's x. */
function bucketsBetween(from: number, to: number, bucket: Bucket): number {
  let steps = 0;
  while (advance(from, bucket, steps) < to) steps += 1;
  return steps;
}

function stats(bucket: Bucket | null): JsonObject {
  return {
    total: 31,
    numeric: [
      {
        field: "id",
        count: 31,
        minimum: 1,
        maximum: 31,
        average: 16,
        total: 496,
      },
      {
        field: "power_level",
        count: 28,
        minimum: 8,
        maximum: 97,
        average: 52.392857,
        total: 1467,
      },
    ],
    categorical: [
      { field: "is_draft", value: "false", count: 26 },
      { field: "is_draft", value: "true", count: 5 },
      { field: "is_locked", value: "false", count: 28 },
      { field: "is_locked", value: "true", count: 3 },
    ],
    time_series:
      bucket === null
        ? null
        : bucketed(COUNTS, bucket).map(({ at, value }) => ({
            bucket_start: iso(at),
            count: value,
          })),
    lifecycle: { archived: 0, draft: 5, locked: 3 },
  };
}

function predict(
  field: string | null,
  periods: number,
  bucket: Bucket,
): JsonObject | Response {
  const series = bucketed(field === null ? COUNTS : POWER_SUMS, bucket);
  if (series.length < 2) {
    return Response.json(
      {
        title: "Unprocessable Entity",
        status: 422,
        detail:
          "need at least 2 time buckets of history to forecast a trend, got 1",
      },
      { status: 422 },
    );
  }
  const first = series[0]!.at;
  const xs = series.map((p) => bucketsBetween(first, p.at, bucket));
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = series.reduce((a, p) => a + p.value, 0) / series.length;
  const slope =
    xs.reduce((a, x, i) => a + (x - meanX) * (series[i]!.value - meanY), 0) /
    xs.reduce((a, x) => a + (x - meanX) ** 2, 0);
  const last = series[series.length - 1]!;
  const predictions: Point[] = [];
  for (let step = 1; step <= periods; step += 1) {
    const at = advance(last.at, bucket, step);
    const x = bucketsBetween(first, at, bucket);
    predictions.push({ at, value: meanY + slope * (x - meanX) });
  }
  return {
    field,
    bucket,
    method: "linear_regression",
    last_known: asPoint(last),
    predictions: predictions.map(asPoint),
  };
}

/** Answers `/stats` and `/predict` of heroes v2, or `undefined` for any other URL. */
export function statsRoute(url: URL): Response | undefined {
  if (url.pathname === `${HEROES_V2}/stats`) {
    const bucket = url.searchParams.get("bucket");
    if (bucket !== null && !["day", "week", "month"].includes(bucket)) {
      return Response.json(
        { title: "invalid bucket", status: 422 },
        { status: 422 },
      );
    }
    return Response.json(stats(bucket as Bucket | null));
  }
  if (url.pathname === `${HEROES_V2}/predict`) {
    const bucket = (url.searchParams.get("bucket") ?? "day") as Bucket;
    const periods = Number(url.searchParams.get("periods") ?? 4);
    const result = predict(url.searchParams.get("field"), periods, bucket);
    return result instanceof Response ? result : Response.json(result);
  }
  return undefined;
}

/**
 * A client over the fixture manifest whose `/stats` and `/predict` answers
 * come from `answer` first (`undefined` falls through to `statsRoute`), for
 * tests that need an empty, partial or failing body.
 */
export function createStatsClient(
  answer: (url: URL) => Response | undefined = () => undefined,
): CrudClient {
  const stubFetch = async (
    input: Request | string | URL,
  ): Promise<Response> => {
    const url = new URL(new Request(input).url);
    if (url.pathname === "/.well-known/api-catalog") {
      return Response.json({
        linkset: [
          {
            anchor: `${url.origin}/api`,
            describedby: [
              {
                href: "/api/_crud/manifest",
                type: "application/json",
                profile: PROFILE,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/api/_crud/manifest") return Response.json(manifest);
    return (
      answer(url) ??
      statsRoute(url) ??
      Response.json({ title: "Not stubbed", status: 404 }, { status: 404 })
    );
  };
  return createClient({
    baseUrl: "https://stub.test",
    fetch: stubFetch as typeof fetch,
  });
}
