import { describe, expect, it } from "vitest";
import { recordStatus, statusQuery } from "../../src/lifecycle/index.ts";

describe("recordStatus", () => {
  it("puts archived before draft before published", () => {
    expect(recordStatus({ archived_at: "2026-01-01T00:00:00Z" })).toBe(
      "archived",
    );
    expect(
      recordStatus({ archived_at: "2026-01-01T00:00:00Z", is_draft: true }),
    ).toBe("archived");
    expect(recordStatus({ archived_at: null, is_draft: true })).toBe("draft");
    expect(recordStatus({ is_draft: false })).toBe("published");
    expect(recordStatus({})).toBe("published");
  });
});

describe("statusQuery", () => {
  it("includes unpublished records unless only published are wanted", () => {
    expect(statusQuery("published")).toEqual({
      includeUnpublished: false,
      filters: {},
    });
    expect(statusQuery("all")).toEqual({
      includeUnpublished: true,
      filters: {},
    });
    expect(statusQuery("draft")).toEqual({
      includeUnpublished: true,
      filters: { is_draft: true },
    });
  });
});
