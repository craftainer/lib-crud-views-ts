import { findResource, type Manifest } from "@craftainer/crud-sdk";
import { describe, expect, it } from "vitest";
import { describeFields } from "../../src/core/index.ts";
import {
  decodeState,
  effectiveFilters,
  encodeState,
  formatOperand,
  initialState,
  isFiltered,
  parseOperand,
  searchableFields,
  sortableFields,
  toCrudQuery,
  type QueryContext,
  type QueryDefaults,
} from "../../src/filter/index.ts";
import { stubManifest } from "../fixtures/stub.ts";

const manifest = stubManifest as unknown as Manifest;
const heroes = describeFields(findResource(manifest, "heroes", "v2")!);
const quests = describeFields(findResource(manifest, "quests")!);
const byName = (name: string) => heroes.find((f) => f.name === name)!;

const ctx = (
  defaults: QueryDefaults = {},
  prefix = "",
  fields = heroes,
): QueryContext => ({
  fields,
  defaults,
  prefix,
  searchField: "name",
  maxPageSize: 99,
});

describe("operands", () => {
  it("parses numbers, booleans, strings and lists", () => {
    expect(parseOperand(byName("power_level"), "min", "5")).toBe(5);
    expect(parseOperand(byName("power_level"), "min", " ")).toBeUndefined();
    expect(parseOperand(byName("power_level"), "min", "x")).toBeUndefined();
    expect(parseOperand(byName("is_draft"), "eq", "true")).toBe(true);
    expect(parseOperand(byName("is_draft"), "eq", "false")).toBe(false);
    expect(parseOperand(byName("is_draft"), "eq", "maybe")).toBeUndefined();
    expect(parseOperand(byName("name"), "icontains", "ada")).toBe("ada");
    expect(parseOperand(byName("name"), "icontains", "")).toBeUndefined();
    expect(parseOperand(byName("power_level"), "in", "1, 2,x")).toEqual([1, 2]);
    expect(parseOperand(byName("power_level"), "in", "x")).toBeUndefined();
  });

  it("rejects fractions for integer fields but keeps them for numbers", () => {
    const whole = { ...byName("power_level"), kind: "integer" as const };
    const loose = { ...byName("power_level"), kind: "number" as const };
    expect(parseOperand(whole, "min", "5")).toBe(5);
    expect(parseOperand(whole, "min", "5.5")).toBeUndefined();
    expect(parseOperand(whole, "in", "1, 2.5, 3")).toEqual([1, 3]);
    expect(parseOperand(loose, "min", "5.5")).toBe(5.5);
  });

  it("keeps commas and backslashes inside list items through a round trip", () => {
    const items = ["Smith, John", "Doe", "a\\b"];
    const text = formatOperand(items);
    expect(text).toBe("Smith\\, John,Doe,a\\\\b");
    expect(parseOperand(byName("name"), "in", text)).toEqual(items);
  });

  it("reads datetimes as UTC, zone-less or not", () => {
    const f = byName("created_at");
    expect(parseOperand(f, "min", "2026-01-02T03:04")).toEqual(
      new Date("2026-01-02T03:04:00Z"),
    );
    expect(parseOperand(f, "min", "2026-01-02T03:04:05.5")).toEqual(
      new Date("2026-01-02T03:04:05.5Z"),
    );
    expect(parseOperand(f, "min", "2026-01-02T03:04:00+02:00")).toEqual(
      new Date("2026-01-02T01:04:00Z"),
    );
    expect(parseOperand(f, "min", "nope")).toBeUndefined();
  });

  it("formats operands", () => {
    expect(formatOperand(new Date("2026-01-02T03:04:00Z"))).toBe(
      "2026-01-02T03:04:00.000Z",
    );
    expect(formatOperand([1, 2])).toBe("1,2");
    expect(formatOperand(true)).toBe("true");
  });
});

describe("field helpers", () => {
  it("finds searchable and sortable fields", () => {
    expect(searchableFields(heroes).map((f) => f.name)).toEqual([
      "name",
      "owner_id",
    ]);
    expect(sortableFields(heroes).map((f) => f.name)).toContain("power_level");
    expect(sortableFields(heroes).map((f) => f.name)).not.toContain("powers");
  });
});

describe("URL codec", () => {
  it("round-trips every part of the state", () => {
    const c = ctx();
    const state = {
      ...initialState(c),
      filters: {
        power_level: { min: 3, max: 9 },
        is_draft: { in: [true, false] },
        created_at: { min: new Date("2026-01-01T00:00:00Z") },
        name: { icontains: "ada" },
      },
      q: "cap",
      qField: "owner_id",
      sort: [
        { field: "power_level", desc: true },
        { field: "name", desc: false },
      ],
      page: 3,
      pageSize: 10,
      includeArchived: true,
      includeUnpublished: true,
    };
    const text = encodeState(state, c);
    expect(decodeState(text, c)).toEqual(state);
  });

  it("writes nothing for the defaults and keeps foreign parameters", () => {
    const c = ctx();
    expect(encodeState(initialState(c), c)).toBe("");
    const next = encodeState({ ...initialState(c), q: "x" }, c, "tab=2&page=7");
    expect(new URLSearchParams(next).get("tab")).toBe("2");
    expect(new URLSearchParams(next).get("page")).toBeNull();
  });

  it("remembers that default filters were cleared", () => {
    const c = ctx({
      filters: { is_locked: { eq: false } },
      sort: [{ field: "name", desc: false }],
      pageSize: 10,
    });
    expect(decodeState("", c).filters).toEqual({ is_locked: { eq: false } });
    expect(decodeState("", c).sort).toEqual([{ field: "name", desc: false }]);
    expect(decodeState("", c).pageSize).toBe(10);
    const cleared = encodeState(
      { ...initialState(c), filters: {}, sort: [] },
      c,
    );
    expect(decodeState(cleared, c).filters).toEqual({});
    expect(decodeState(cleared, c).sort).toEqual([]);
    expect(encodeState(initialState(c), c)).toBe("");
    const changed = encodeState(
      { ...initialState(c), filters: { is_locked: { eq: true } } },
      c,
    );
    expect(decodeState(changed, c).filters).toEqual({
      is_locked: { eq: true },
    });
  });

  it("separates lists by prefix", () => {
    const a = ctx({}, "a.");
    const b = ctx({}, "b.");
    const text = encodeState(
      { ...initialState(a), q: "one", page: 2, filters: { name: { eq: "x" } } },
      a,
    );
    const both = encodeState({ ...initialState(b), q: "two" }, b, text);
    expect(decodeState(both, a).q).toBe("one");
    expect(decodeState(both, a).page).toBe(2);
    expect(decodeState(both, a).filters).toEqual({ name: { eq: "x" } });
    expect(decodeState(both, b).q).toBe("two");
    expect(decodeState(both, b).page).toBe(1);
  });

  it("round-trips the host's page, sort, q and size under the default prefix", () => {
    const host = "page=7&sort=title&q=mine&size=9";
    const c = ctx({}, "l_");
    const state = {
      ...initialState(c),
      q: "ada",
      page: 2,
      pageSize: 25,
      sort: [{ field: "name", desc: true }],
    };
    const text = encodeState(state, c, host);
    const params = new URLSearchParams(text);
    for (const [key, value] of new URLSearchParams(host))
      expect(params.get(key)).toBe(value);
    expect(decodeState(text, c)).toEqual(state);
    // Clearing the list's state leaves the host's parameters alone.
    expect(encodeState(initialState(c), c, text)).toBe(host);
    // The host's parameters alone are not list state.
    expect(decodeState(host, c)).toEqual(initialState(c));
  });

  it("ignores what the resource does not allow", () => {
    const c = ctx();
    const state = decodeState(
      [
        "f=",
        "f.ghost.eq=1",
        "f.id.min=1",
        "f.name.min=1",
        "f.power_level.min=abc",
        "f.power_level.max=7",
        "sort=powers,-name,ghost",
        "qf=power_level",
        "page=0",
        "size=500",
      ].join("&"),
      c,
    );
    expect(state.filters).toEqual({ power_level: { max: 7 } });
    expect(state.sort).toEqual([{ field: "name", desc: true }]);
    expect(state.qField).toBe("name");
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(99);
    expect(decodeState("page=x&size=0", c).page).toBe(1);
    expect(decodeState("sort=", c).sort).toEqual([]);
    expect(decodeState("size=7", c).pageSize).toBe(7);
  });

  it("has no quick-search field on a resource without searchable strings", () => {
    const c: QueryContext = { ...ctx({}, "", quests), searchField: undefined };
    const state = initialState(c);
    expect(state.qField).toBeUndefined();
    expect(encodeState(state, c)).toBe("");
  });
});

describe("SDK query", () => {
  it("builds filters through toQueryFilters, sort and paging", () => {
    const c = ctx();
    const state = {
      ...initialState(c),
      filters: { power_level: { min: 3 }, name: { eq: "Ada" } },
      sort: [
        { field: "power_level", desc: true },
        { field: "name", desc: false },
      ],
      page: 3,
      pageSize: 10,
      includeArchived: true,
      includeUnpublished: true,
    };
    expect(toCrudQuery(state, true)).toEqual({
      filters: { power_level__min: 3, name: "Ada" },
      sort: ["-power_level", "name"],
      skip: 20,
      limit: 11,
      includeArchived: true,
      includeUnpublished: true,
    });
    expect(toCrudQuery(state, false)).not.toHaveProperty("limit");
    expect(toCrudQuery(initialState(c), false)).toEqual({ filters: {} });
  });

  it("adds the quick search as icontains on its field", () => {
    const c = ctx();
    const state = {
      ...initialState(c),
      q: "ada",
      filters: { name: { eq: "x" } },
    };
    expect(effectiveFilters(state)).toEqual({
      name: { eq: "x", icontains: "ada" },
    });
    expect(effectiveFilters({ ...state, qField: undefined })).toBe(
      state.filters,
    );
    expect(effectiveFilters({ ...state, q: "" })).toBe(state.filters);
    expect(toCrudQuery(state, false)).toEqual({
      filters: { name: "x", name__icontains: "ada" },
    });
  });

  it("knows when the list is narrowed", () => {
    const c = ctx();
    expect(isFiltered(initialState(c))).toBe(false);
    expect(isFiltered({ ...initialState(c), q: "a" })).toBe(true);
    expect(
      isFiltered({ ...initialState(c), filters: { name: { eq: "a" } } }),
    ).toBe(true);
    expect(
      isFiltered({ ...initialState(c), filters: { name: { in: [] } } }),
    ).toBe(false);
    expect(
      isFiltered({ ...initialState(c), filters: { name: undefined } }),
    ).toBe(false);
  });
});

describe("number operands", () => {
  it("parses a plain number field", () => {
    const f = { ...byName("power_level"), kind: "number" as const };
    expect(parseOperand(f, "min", "2.5")).toBe(2.5);
  });
});
