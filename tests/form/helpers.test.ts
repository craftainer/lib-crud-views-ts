import {
  PreconditionFailed,
  ProblemError,
  ValidationFailed,
} from "@craftainer/crud-sdk";
import { describe, expect, it } from "vitest";
import {
  describeFailure,
  groupFields,
  validateAll,
  validateValue,
} from "../../src/form/index.ts";
import { field } from "../helpers.tsx";

const constraints = (
  over: Partial<ReturnType<typeof field>["constraints"]>,
) => ({
  ...field().constraints,
  ...over,
});

describe("validateValue", () => {
  it("requires a value, except for booleans", () => {
    const required = field({ required: true });
    for (const empty of [undefined, null, "", []]) {
      expect(validateValue(required, empty)).toBe("Required");
    }
    expect(validateValue(field(), undefined)).toBeNull();
    expect(
      validateValue(field({ kind: "boolean", required: true }), undefined),
    ).toBeNull();
    expect(validateValue(required, 0)).toBeNull();
    expect(validateValue(required, false)).toBeNull();
  });

  it("checks integer, minimum and maximum", () => {
    const f = field({
      kind: "integer",
      constraints: constraints({ minimum: 2, maximum: 5 }),
    });
    expect(validateValue(f, 2.5)).toBe("Enter a whole number");
    expect(validateValue(f, 1)).toBe("Must be at least 2");
    expect(validateValue(f, 6)).toBe("Must be at most 5");
    expect(validateValue(f, 3)).toBeNull();
    // A number field accepts fractions and has open bounds by default.
    expect(validateValue(field({ kind: "number" }), 2.5)).toBeNull();
  });

  it("checks string length and pattern", () => {
    const f = field({
      constraints: constraints({ minLength: 2, maxLength: 3, pattern: "^a" }),
    });
    expect(validateValue(f, "a")).toBe("Must be at least 2 characters");
    expect(validateValue(f, "abcd")).toBe("Must be at most 3 characters");
    expect(validateValue(f, "bcd")).toBe("Does not match the expected format");
    expect(validateValue(f, "abc")).toBeNull();
    // A Python-only pattern cannot be checked here and is left to the server.
    const odd = field({ constraints: constraints({ pattern: "(?P<x>a)" }) });
    expect(validateValue(odd, "zzz")).toBeNull();
    expect(validateValue(field(), "anything")).toBeNull();
    expect(validateValue(field({ kind: "array" }), ["x"])).toBeNull();
  });

  it("counts string length in code points, not UTF-16 code units", () => {
    const f = field({
      constraints: constraints({ minLength: 2, maxLength: 2 }),
    });
    // Two emoji are four UTF-16 code units but two code points.
    expect(validateValue(f, "\u{1F600}\u{1F600}")).toBeNull();
    expect(validateValue(f, "\u{1F600}")).toBe("Must be at least 2 characters");
    expect(validateValue(f, "\u{1F600}ab")).toBe(
      "Must be at most 2 characters",
    );
  });

  it("collects the errors of a whole form", () => {
    const fields = [field({ name: "a", required: true }), field({ name: "b" })];
    expect(validateAll(fields, { b: "x" })).toEqual({ a: "Required" });
  });
});

describe("groupFields", () => {
  const fields = [
    field({ name: "a", required: true }),
    field({ name: "b" }),
    field({ name: "c" }),
  ];

  it("defaults to Required and Optional, dropping empty groups", () => {
    expect(groupFields(fields, undefined)).toEqual([
      { title: "Required", fields: ["a"] },
      { title: "Optional", fields: ["b", "c"] },
    ]);
    expect(groupFields([fields[1]!], undefined)).toEqual([
      { title: "Optional", fields: ["b"] },
    ]);
  });

  it("uses given sections, ignores unknown names and collects the rest", () => {
    expect(
      groupFields(fields, [
        { title: "One", fields: ["c", "nope"] },
        { title: "Gone", fields: ["nope"] },
      ]),
    ).toEqual([
      { title: "One", fields: ["c"] },
      { title: "Other", fields: ["a", "b"] },
    ]);
  });
});

describe("describeFailure", () => {
  const names = ["name", "powers"];

  it("flags a 412 as a conflict", () => {
    expect(
      describeFailure(
        new PreconditionFailed({ status: 412, title: "Precondition Failed" }),
        names,
      ),
    ).toEqual({ conflict: true, fieldErrors: {}, message: null });
  });

  it("maps 422 errors onto fields by their loc, keeping the first per field", () => {
    const failure = describeFailure(
      new ValidationFailed({
        status: 422,
        title: "Unprocessable",
        errors: [
          { loc: ["body", "name"], msg: "too short", type: "x" },
          { loc: ["body", "name"], msg: "second", type: "x" },
          { loc: ["body", "powers", 0], msg: "bad item", type: "x" },
          { loc: ["body", "ghost"], msg: "unknown", type: "x" },
          { loc: ["body"], msg: "whole body", type: "x" },
        ],
      }),
      names,
    );
    expect(failure.fieldErrors).toEqual({
      name: "too short",
      powers: "bad item",
    });
    expect(failure.message).toBe("ghost: unknown; whole body");
    expect(failure.conflict).toBe(false);
  });

  it("maps 422 errors that all land on fields to no alert text", () => {
    const failure = describeFailure(
      new ValidationFailed({
        status: 422,
        title: "x",
        errors: [{ loc: ["name"], msg: "m", type: "t" }],
      }),
      names,
    );
    expect(failure.message).toBeNull();
  });

  it("describes other problems and plain errors", () => {
    expect(
      describeFailure(
        new ProblemError({ status: 423, title: "Locked", detail: "by Ada" }),
        names,
      ).message,
    ).toBe("Locked: by Ada");
    expect(
      describeFailure(new ProblemError({ status: 500, title: "Boom" }), names)
        .message,
    ).toBe("Boom");
    expect(describeFailure(new Error("offline"), names).message).toBe(
      "offline",
    );
    expect(describeFailure("weird", names).message).toBe(
      "The record could not be saved",
    );
  });
});
