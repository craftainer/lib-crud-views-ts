import { describe, expect, it } from "vitest";
import {
  categoricalFields,
  forecastSeries,
  formatBucket,
  parseInstant,
  parsePrediction,
  parseStats,
  rounded,
} from "../../src/stats/model.ts";
import { timeAxis } from "../../src/stats/shared.tsx";

const utc = (s: string): Date => new Date(`${s}T00:00:00Z`);

describe("parseInstant", () => {
  it("reads zoned instants as given and zoneless ones as UTC", () => {
    const expected = utc("2026-01-05").getTime();
    expect(parseInstant("2026-01-05T00:00:00Z")?.getTime()).toBe(expected);
    expect(parseInstant("2026-01-05T00:00:00+00:00")?.getTime()).toBe(expected);
    expect(parseInstant("2026-01-05T01:00:00+01:00")?.getTime()).toBe(expected);
    expect(parseInstant("2026-01-05T00:00:00")?.getTime()).toBe(expected);
  });

  it("rejects anything else", () => {
    expect(parseInstant(5)).toBeNull();
    expect(parseInstant("not a date")).toBeNull();
  });
});

describe("parseStats", () => {
  it("reads a full body, ordering the series", () => {
    const stats = parseStats({
      total: 5,
      numeric: [
        {
          field: "power_level",
          count: 2,
          minimum: 1,
          maximum: 9,
          average: 5,
          total: 10,
        },
      ],
      categorical: [{ field: "is_draft", value: "true", count: 3 }],
      time_series: [
        { bucket_start: "2026-01-06T00:00:00Z", count: 2 },
        { bucket_start: "2026-01-05T00:00:00Z", count: 3 },
        { bucket_start: "broken", count: 9 },
      ],
    });
    expect(stats.total).toBe(5);
    expect(stats.numeric[0]).toEqual({
      field: "power_level",
      count: 2,
      minimum: 1,
      maximum: 9,
      average: 5,
      total: 10,
    });
    expect(stats.categorical).toEqual([
      { field: "is_draft", value: "true", count: 3 },
    ]);
    expect(stats.timeSeries.map((p) => [p.at.toISOString(), p.value])).toEqual([
      ["2026-01-05T00:00:00.000Z", 3],
      ["2026-01-06T00:00:00.000Z", 2],
    ]);
    expect(categoricalFields(stats)).toEqual(["is_draft"]);
  });

  it("degrades a malformed body to empty values", () => {
    const stats = parseStats({
      numeric: [null, { field: null, minimum: "x" }],
      categorical: "no",
      time_series: null,
    });
    expect(stats.total).toBe(0);
    expect(stats.numeric).toEqual([
      {
        field: "",
        count: 0,
        minimum: null,
        maximum: null,
        average: null,
        total: null,
      },
    ]);
    expect(stats.categorical).toEqual([]);
    expect(stats.timeSeries).toEqual([]);
  });
});

describe("parsePrediction", () => {
  it("reads a forecast", () => {
    const p = parsePrediction({
      field: "power_level",
      bucket: "week",
      method: "linear_regression",
      last_known: { bucket_start: "2026-01-12T00:00:00Z", value: 4 },
      predictions: [{ bucket_start: "2026-01-19T00:00:00Z", value: 5 }],
    });
    expect(p.field).toBe("power_level");
    expect(p.bucket).toBe("week");
    expect(p.method).toBe("linear_regression");
    expect(p.lastKnown?.value).toBe(4);
    expect(p.predictions).toHaveLength(1);
  });

  it("degrades a malformed body", () => {
    const p = parsePrediction({
      field: null,
      last_known: "x",
      predictions: [{ bucket_start: "x", value: 1 }],
    });
    expect(p).toMatchObject({
      field: null,
      bucket: "",
      method: "",
      lastKnown: null,
      predictions: [],
    });
    expect(
      parsePrediction({ last_known: { bucket_start: "nope" } }).lastKnown,
    ).toBeNull();
  });
});

describe("formatBucket", () => {
  const at = utc("2026-01-05");
  it("labels in UTC, by bucket size", () => {
    expect(formatBucket(at, "day", "en-US")).toBe("Jan 5, 2026");
    expect(formatBucket(at, "week", "en-US", true)).toBe("Jan 5");
    expect(formatBucket(at, "month", "en-US")).toBe("Jan 2026");
    expect(formatBucket(at, "month", "en-US", true)).toBe("Jan 2026");
  });

  it("does not shift a bucket into the previous day west of UTC", () => {
    const west = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      day: "numeric",
    }).format(at);
    expect(west).toBe("4");
    expect(formatBucket(at, "day", "en-US")).toContain("5");
  });
});

describe("rounded", () => {
  it("rounds to two decimals and keeps null", () => {
    expect(rounded(52.380952)).toBe(52.38);
    expect(rounded(null)).toBeNull();
  });
});

describe("forecastSeries", () => {
  const prediction = (lastKnown: string | null) =>
    parsePrediction({
      field: null,
      bucket: "day",
      method: "linear_regression",
      last_known:
        lastKnown === null ? null : { bucket_start: lastKnown, value: 6 },
      predictions: [
        { bucket_start: "2026-01-13T00:00:00Z", value: 7 },
        { bucket_start: "2026-01-14T00:00:00Z", value: 8 },
      ],
    });
  const history = parseStats({
    time_series: [
      { bucket_start: "2026-01-05T00:00:00Z", count: 3 },
      { bucket_start: "2026-01-08T00:00:00Z", count: 5 },
      { bucket_start: "2026-01-12T00:00:00Z", count: 6 },
    ],
  }).timeSeries;

  it("keeps gaps in the history and anchors the forecast at the last known point", () => {
    const s = forecastSeries(history, prediction("2026-01-12T00:00:00Z"));
    expect(s.at.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-08",
      "2026-01-12",
      "2026-01-13",
      "2026-01-14",
    ]);
    expect(s.known).toEqual([3, 5, 6, null, null]);
    expect(s.forecast).toEqual([null, null, 6, 7, 8]);
  });

  it("adds a last known point the history lacks, and works without history", () => {
    const s = forecastSeries([], prediction("2026-01-12T00:00:00Z"));
    expect(s.known).toEqual([6, null, null]);
    expect(s.forecast).toEqual([6, 7, 8]);
  });

  it("copes without a last known point", () => {
    const s = forecastSeries([], prediction(null));
    expect(s.known).toEqual([null, null]);
    expect(s.forecast).toEqual([7, 8]);
  });
});

describe("timeAxis", () => {
  it("positions by UTC time and labels ticks compactly in UTC", () => {
    const axis = timeAxis([utc("2026-01-05")], "day", "en-US");
    expect(axis.scaleType).toBe("utc");
    expect(axis.data).toEqual([utc("2026-01-05")]);
    expect(axis.label).toBe("Bucket start (UTC)");
    expect(axis.valueFormatter(utc("2026-01-05"))).toBe("Jan 5");
    expect(
      timeAxis([], "month", "en-US").valueFormatter(utc("2026-02-01")),
    ).toBe("Feb 2026");
  });
});
