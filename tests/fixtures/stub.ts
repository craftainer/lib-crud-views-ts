// A real SDK client over a fake `fetch`: catalog, manifest and in-memory
// records for the fixture manifest's resources. Used by tests and stories.
import {
  CrudClient,
  PROFILE,
  createClient,
  type JsonObject,
} from "@craftainer/crud-sdk";
import manifest from "./manifest.json" with { type: "json" };

export const stubManifest = manifest;

const base = {
  owner_id: "stub-owner",
  is_draft: false,
  archived_at: null,
  publish_at: null,
  unpublish_at: null,
  is_locked: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T09:30:00Z",
};

/** Stable ids and dates: screenshots must not drift. */
export const heroRows: readonly JsonObject[] = [
  {
    ...base,
    id: 1,
    name: "Captain Ledger",
    powers: ["Foresight", "Filing"],
    power_level: 72,
  },
  {
    ...base,
    id: 2,
    name: "The Margin",
    powers: ["Annotation"],
    power_level: 41,
    is_locked: true,
  },
  {
    ...base,
    id: 3,
    name: null,
    powers: null,
    power_level: null,
    is_draft: true,
  },
];

export const questRows: readonly JsonObject[] = [
  {
    id: 1,
    title: "Reconcile the ledger",
    difficulty: "hard",
    due_on: "2026-03-14",
  },
  { id: 2, title: "File the receipts", difficulty: "easy", due_on: null },
];

export interface StubOptions {
  readonly heroes?: readonly JsonObject[];
  readonly quests?: readonly JsonObject[];
  /** `"pending"` never answers the manifest request; `"down"` answers 503. */
  readonly manifest?: "ok" | "pending" | "down";
  /** The list endpoint's answer: `"pending"` never answers, `"error"` is a 500. */
  readonly list?: "ok" | "pending" | "error";
}

export interface Stub {
  readonly client: CrudClient;
  /** `METHOD path?query` of every request, in order. */
  readonly requests: string[];
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** A client whose `fetch` serves the fixture manifest and in-memory rows. */
export function createStubClient(options: StubOptions = {}): Stub {
  const { manifest: manifestMode = "ok", list: listMode = "ok" } = options;
  const tables = new Map<string, JsonObject[]>([
    ["/api/crud/v1/heroes/v2/json", [...(options.heroes ?? heroRows)]],
    ["/api/crud/v1/quests/v1/json", [...(options.quests ?? questRows)]],
  ]);
  const requests: string[] = [];
  let nextId = 100;
  const never = (): Promise<Response> => new Promise(() => {});

  const stubFetch = async (
    input: Request | string | URL,
  ): Promise<Response> => {
    const request = new Request(input);
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (url.pathname === "/.well-known/api-catalog") {
      return json(200, {
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
    if (url.pathname === "/api/_crud/manifest") {
      if (manifestMode === "pending") return never();
      return manifestMode === "down"
        ? json(503, { title: "down", status: 503 })
        : json(200, manifest);
    }
    const rows = tables.get(url.pathname);
    if (rows === undefined)
      return json(404, { title: "Not stubbed", status: 404 });
    const id = url.searchParams.get("id");
    if (request.method === "GET" && id === null) {
      if (listMode === "pending") return never();
      if (listMode === "error")
        return json(500, { title: "boom", status: 500 });
      const skip = Number(url.searchParams.get("skip") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? rows.length);
      return json(200, rows.slice(skip, skip + limit));
    }
    if (request.method === "POST") {
      const created = {
        ...base,
        id: nextId++,
        ...((await request.json()) as JsonObject),
      };
      rows.push(created);
      return json(201, created);
    }
    const row = rows.find((r) => String(r["id"]) === id);
    if (row === undefined)
      return json(404, { title: "Not found", status: 404 });
    if (request.method === "PATCH") {
      Object.assign(row, (await request.json()) as JsonObject);
      return json(200, row);
    }
    if (request.method === "DELETE") {
      rows.splice(rows.indexOf(row), 1);
      return new Response(null, { status: 204 });
    }
    return json(200, row);
  };

  return {
    client: createClient({
      baseUrl: "http://stub.test",
      fetch: stubFetch as typeof fetch,
    }),
    requests,
  };
}
