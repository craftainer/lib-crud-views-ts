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
  it("resolves a write-only property's $ref against its own schema", () => {
    const r = synthetic(
      {},
      {
        fields: [
          { name: "status", value_type: "enum", required: false },
        ] as unknown as Resource["fields"],
      },
      { status: { $ref: "#/$defs/S" } },
    );
    (r.schemas.create as Record<string, unknown>)["$defs"] = {
      S: { enum: ["on", "off"] },
    };
    expect(byName(r).get("status")).toMatchObject({
      kind: "enum",
      choices: ["on", "off"],
    });
  });

  it("does not call a numeric enum an enum of strings", () => {
    const f = byName(synthetic({ n: { type: "integer", enum: [1, 2] } }));
    expect(f.get("n")).toMatchObject({ kind: "integer" });
  });

  it("does not treat inherited object members as schema properties", () => {
    const f = byName(
      synthetic({ constructor: { type: "string" } }, {}, { name: {} }),
    );
    expect(f.get("constructor")).toMatchObject({
      readOnly: true,
      kind: "string",
    });
  });

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

  it("follows $ref chains, JSON-pointer escapes and Pydantic $defs names", () => {
    const r = synthetic({
      chained: { $ref: "#/$defs/Alias" },
      sibling: { $ref: "#/$defs/Alias", description: "kept" },
      slash: { $ref: "#/$defs/a~1b" },
      tilde: { $ref: "#/$defs/a~0b" },
      encoded: { $ref: "#/$defs/Page%5BHero%5D" },
      stray: { $ref: "#/$defs/100%" },
      loop: { $ref: "#/$defs/Loop" },
      brokenchain: { $ref: "#/$defs/Dangling" },
    });
    const schema = r.schemas.read as Record<string, unknown>;
    schema["$defs"] = {
      Alias: { $ref: "#/$defs/Inner" },
      Inner: { $ref: "#/$defs/Level2" },
      Level2: { enum: ["p", "q"], type: "string" },
      "a/b": { type: "integer" },
      "a~b": { type: "boolean" },
      "Page[Hero]": { type: "string", format: "date" },
      "100%": { type: "number" },
      Loop: { $ref: "#/$defs/Loop" },
      Dangling: { $ref: "#/$defs/Nope" },
    };
    const f = byName(r);
    expect(f.get("chained")).toMatchObject({
      kind: "enum",
      choices: ["p", "q"],
    });
    expect(f.get("sibling")?.kind).toBe("enum");
    expect(f.get("slash")?.kind).toBe("integer");
    expect(f.get("tilde")?.kind).toBe("boolean");
    expect(f.get("encoded")).toMatchObject({ kind: "date", format: "date" });
    expect(f.get("stray")?.kind).toBe("number");
    expect(f.get("loop")?.kind).toBe("json");
    expect(f.get("brokenchain")?.kind).toBe("json");
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
