import type { Resource } from "@craftainer/crud-sdk";
import { describe, expect, it } from "vitest";
import { describeFields, humanize } from "../../src/core/fields.ts";
import { stubManifest } from "../fixtures/stub.ts";

const resource = (name: string, version: string): Resource =>
  stubManifest.resources.find(
    (r) => r.name === name && r.api_version === version,
  ) as unknown as Resource;

const byName = (r: Resource) =>
  new Map(describeFields(r).map((f) => [f.name, f]));

describe("humanize", () => {
  it("turns snake and kebab case into a sentence", () => {
    expect(humanize("power_level")).toBe("Power level");
    expect(humanize("due-on")).toBe("Due on");
  });
});

describe("describeFields on the fixture manifest", () => {
  it("describes heroes v2", () => {
    const f = byName(resource("heroes", "v2"));
    expect([...f.keys()].slice(0, 4)).toEqual([
      "id",
      "name",
      "powers",
      "power_level",
    ]);
    expect(f.get("id")).toMatchObject({
      kind: "integer",
      readOnly: true,
      inManifest: true,
      sortable: true,
    });
    expect(f.get("name")).toMatchObject({
      kind: "string",
      nullable: true,
      required: true,
      readOnly: false,
      label: "Name",
      constraints: { minLength: 1, maxLength: 200 },
    });
    expect(f.get("powers")).toMatchObject({
      kind: "array",
      itemKind: "string",
      inManifest: false,
      filterOps: [],
    });
    expect(f.get("power_level")).toMatchObject({
      kind: "integer",
      nullable: true,
      numeric: true,
    });
    expect(f.get("created_at")).toMatchObject({
      kind: "datetime",
      readOnly: true,
    });
    expect(f.get("is_draft")).toMatchObject({
      kind: "boolean",
      categorical: true,
    });
  });

  it("describes quests with an enum behind $ref and a nullable date", () => {
    const f = byName(resource("quests", "v1"));
    expect(f.get("difficulty")).toMatchObject({
      kind: "enum",
      choices: ["easy", "hard", "deadly"],
    });
    expect(f.get("due_on")).toMatchObject({
      kind: "date",
      nullable: true,
      format: "date",
    });
    expect(f.get("title")?.itemKind).toBeNull();
  });
});

const synthetic = (
  read: Record<string, unknown>,
  extra: Partial<Resource> = {},
  create: Record<string, unknown> = {},
  update: Record<string, unknown> = {},
): Resource =>
  ({
    fields: [],
    schemas: {
      read: { properties: read, $defs: { Level: { enum: ["a", "b"] } } },
      create: { properties: create, required: ["req"] },
      update: { properties: update },
      draft: null,
    },
    ...extra,
  }) as unknown as Resource;

describe("describeFields on odd schemas", () => {
  it("infers kinds from schema types and formats", () => {
    const f = byName(
      synthetic({
        s: { type: "string" },
        d: { type: "string", format: "date" },
        dt: { type: "string", format: "date-time" },
        i: { type: "integer" },
        n: { type: "number", minimum: 0, maximum: 5 },
        b: { type: "boolean" },
        e: { enum: ["x", "y", 3] },
        a: { type: "array", items: { type: "integer" } },
        a2: { type: "array" },
        o: { type: "object" },
        nul: { type: "null" },
        none: undefined,
        multi: { type: ["string", "null"], pattern: "^a" },
        union: { oneOf: [{ type: "integer" }, { type: "null" }] },
        bare: { anyOf: [{ type: "null" }] },
        ref: { $ref: "#/$defs/Level" },
        badref: { $ref: "elsewhere" },
        missing: { $ref: "#/$defs/Nope" },
        notobj: "string",
        deep: { $ref: "#/nope/deeper" },
      }),
    );
    const kinds = Object.fromEntries([...f].map(([k, v]) => [k, v.kind]));
    expect(kinds).toMatchObject({
      s: "string",
      d: "date",
      dt: "datetime",
      i: "integer",
      n: "number",
      b: "boolean",
      e: "enum",
      a: "array",
      a2: "array",
      o: "json",
      nul: "json",
      none: "json",
      multi: "string",
      union: "integer",
      bare: "json",
      ref: "enum",
      badref: "json",
      missing: "json",
      notobj: "json",
    });
    expect(f.get("e")?.choices).toEqual(["x", "y"]);
    expect(f.get("a")?.itemKind).toBe("integer");
    expect(f.get("a2")?.itemKind).toBe("json");
    expect(f.get("n")?.constraints).toMatchObject({ minimum: 0, maximum: 5 });
    expect(f.get("multi")).toMatchObject({ nullable: true });
    expect(f.get("multi")?.constraints.pattern).toBe("^a");
    expect(f.get("union")?.nullable).toBe(true);
    expect(f.get("nul")?.nullable).toBe(true);
  });

  it("derives readOnly and required from create/update, and falls back to the spec", () => {
    const r = synthetic(
      {
        req: { type: "string" },
        upd: { type: "string" },
        ro: { type: "string" },
      },
      {
        fields: [
          {
            name: "only",
            value_type: "weird",
            filter_ops: ["eq"],
            sortable: false,
            choices: null,
            numeric: false,
            categorical: false,
            read_only: false,
            required: true,
          },
        ],
      } as Partial<Resource>,
      { req: { type: "string" } },
      { upd: { type: "string" } },
    );
    const f = byName(r);
    expect(f.get("req")).toMatchObject({ readOnly: false, required: true });
    expect(f.get("upd")).toMatchObject({ readOnly: false, required: false });
    expect(f.get("ro")?.readOnly).toBe(true);
    // A manifest field the read schema does not list: kind from the spec, unknown types are strings.
    expect(f.get("only")).toMatchObject({
      kind: "string",
      inManifest: true,
      required: true,
      nullable: false,
    });
  });

  it("treats a create schema without a required list as all optional", () => {
    const r = {
      fields: [],
      schemas: {
        read: { properties: { a: { type: "string" } } },
        create: { properties: { a: { type: "string" } } },
        update: {},
        draft: null,
      },
    } as unknown as Resource;
    expect(describeFields(r)[0]).toMatchObject({
      readOnly: false,
      required: false,
    });
  });

  it("copes with schemas that have no properties", () => {
    const r = {
      fields: [],
      schemas: { read: {}, create: {}, update: {}, draft: null },
    } as unknown as Resource;
    expect(describeFields(r)).toEqual([]);
  });
});
