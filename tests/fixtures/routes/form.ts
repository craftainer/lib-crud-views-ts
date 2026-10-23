// Stub routes for the form views: a weak ETag per record, `If-Match` checks
// (412) and 422 problem details for the value "INVALID".
import type { JsonObject } from "@craftainer/crud-sdk";
import type { StubRoute } from "../stub.ts";

/**
 * The one ETag rule of the stub: derived from the record's id and `updated_at`,
 * so apps can compute it from a list row too (the list endpoint sends no ETag).
 * `If-Match` is checked only for weak `W/"` values that differ (412); any other
 * value passes, as for an opaque server.
 */
export const etagOf = (row: JsonObject): string =>
  `W/"${String(row["id"])}-${String(row["updated_at"])}"`;

/** Changes `row` behind the client's back: `updated_at` moves on, so its old ETag goes stale. */
export function touch(row: JsonObject): void {
  row["updated_at"] = new Date(
    Date.parse(String(row["updated_at"])) + 1000,
  ).toISOString();
}

const problem = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify({ status, ...body }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

export const formRoutes: StubRoute = async ({ request, url, tables }) => {
  const rows = tables.get(url.pathname);
  const id = url.searchParams.get("id");
  if (rows === undefined || id === null) return undefined;
  const row = rows.find((r) => String(r["id"]) === id);
  if (row === undefined) return undefined;
  const headers = { "Content-Type": "application/json", ETag: etagOf(row) };
  if (request.method === "GET") {
    return new Response(JSON.stringify(row), { status: 200, headers });
  }
  if (request.method !== "PATCH") return undefined;
  const match = request.headers.get("If-Match");
  // Only the stub's own weak tags are checked; other values pass, as for an opaque server.
  if (match?.startsWith('W/"') === true && match !== etagOf(row)) {
    return problem(412, { title: "Precondition Failed" });
  }
  const patch = (await request.json()) as JsonObject;
  if (Object.values(patch).includes("LOCKED")) {
    return problem(423, { title: "Locked", detail: "held by Ada" });
  }
  const bad = Object.entries(patch).filter(([, v]) => v === "INVALID");
  if (bad.length > 0) {
    return new Response(
      JSON.stringify({
        title: "Unprocessable Entity",
        status: 422,
        detail: bad.map(([name]) => ({
          loc: ["body", name],
          msg: "Value is not allowed",
          type: "value_error",
        })),
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/problem+json" },
      },
    );
  }
  Object.assign(row, patch);
  touch(row);
  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { "Content-Type": "application/json", ETag: etagOf(row) },
  });
};
