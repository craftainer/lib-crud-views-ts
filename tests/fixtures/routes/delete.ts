// Stub routes for the delete views: with `softDelete`, DELETE on heroes v2
// archives the row, lists hide archived rows unless `include_archived=true`,
// and `restore` brings a row back.
import type { StubRoute } from "../stub.ts";

const HEROES = "/api/crud/v1/heroes/v2/json";
const ARCHIVED_AT = "2026-02-03T04:05:06Z";

export const deleteRoutes: StubRoute = ({ request, url, tables, options }) => {
  if (options.softDelete !== true) return undefined;
  const rows = tables.get(HEROES);
  if (rows === undefined) return undefined;
  const id = url.searchParams.get("id");
  const row = rows.find((r) => String(r["id"]) === id);
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (url.pathname === HEROES && request.method === "DELETE") {
    if (row === undefined)
      return json(404, { title: "Not found", status: 404 });
    row["archived_at"] = ARCHIVED_AT;
    return new Response(null, { status: 204 });
  }
  if (url.pathname === `${HEROES}/restore` && request.method === "POST") {
    if (row === undefined)
      return json(404, { title: "Not found", status: 404 });
    row["archived_at"] = null;
    return json(200, { matched: 1, ids: [row["id"]] });
  }
  if (url.pathname === HEROES && request.method === "GET" && id === null) {
    const all = url.searchParams.get("include_archived") === "true";
    return json(
      200,
      rows.filter((r) => all || r["archived_at"] === null),
    );
  }
  return undefined;
};
