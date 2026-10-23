// Stub routes for the form views: a weak ETag per record, `If-Match` checks
// (412) and 422 problem details for the value "INVALID".
import type { JsonObject } from "@craftainer/crud-sdk";
import type { StubRoute } from "../stub.ts";

const versions = new WeakMap<JsonObject, number>();

/** The ETag the stub currently holds for `row`. */
export const etagOf = (row: JsonObject): string =>
  `W/"${String(row["id"])}-${versions.get(row) ?? 1}"`;

/** Changes `row` behind the client's back: its old ETag goes stale. */
export function touch(row: JsonObject): void {
  versions.set(row, (versions.get(row) ?? 1) + 1);
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
