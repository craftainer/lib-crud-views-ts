// Restoring a revision is a PATCH by record id (`useUpdate`); the view reads
// the record's ETag from `CrudProvider`'s `etags` (the SDK cache) and sends it.
import {
  cachePolicyFromManifest,
  createCache,
  MemoryStore,
} from "@craftainer/crud-sdk/cache";
import { findResource, type Middleware } from "@craftainer/crud-sdk";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RevisionsPanel } from "../../src/revisions/index.ts";
import { lifecycleHeroes } from "../fixtures/routes/detail.ts";
import { etagOf, touch } from "../fixtures/routes/form.ts";
import { stubManifest } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";
import { Ready } from "../ready.tsx";

/** A cache client's middleware plus a spy that records each PATCH's `If-Match` (`null`: none). */
function setup() {
  const entry = findResource(stubManifest as never, "heroes", "v2");
  const cache = createCache({
    store: new MemoryStore(),
    policies: { heroes: cachePolicyFromManifest(entry as never) },
  });
  const sent: (string | null)[] = [];
  const spy: Middleware = (ctx, next) => {
    if (ctx.request.method === "PATCH")
      sent.push(ctx.request.headers.get("if-match"));
    return next(ctx);
  };
  return { middleware: [cache.middleware, spy], sent, cache };
}

const ui = (
  <Ready>
    {(ready) => (
      <>
        <button onClick={() => void ready.handle.get(1)}>load record</button>
        <RevisionsPanel ready={ready} id={1} />
      </>
    )}
  </Ready>
);

const restore = async (): Promise<void> => {
  await userEvent.click(
    await screen.findByRole("button", { name: "Restore revision 101" }),
  );
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Restore" }),
  );
};

describe("restoring a revision with the SDK cache as etags", () => {
  it("sends If-Match from the cached ETag of that record", async () => {
    const { middleware, sent, cache } = setup();
    const heroes = lifecycleHeroes();
    renderCrud(ui, { heroes, middleware }, { etags: cache });
    await userEvent.click(
      await screen.findByRole("button", { name: "load record" }),
    );
    const cached = etagOf(heroes[0] as never);
    await restore();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toBe(cached);
  });

  it("reads the record first when no ETag is cached, then sends its ETag", async () => {
    const { middleware, sent, cache } = setup();
    const heroes = lifecycleHeroes();
    renderCrud(ui, { heroes, middleware }, { etags: cache });
    const current = etagOf(heroes[0] as never);
    await restore();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toBe(current);
  });

  it("refuses to restore, sending nothing, when the provider has no etags", async () => {
    const { middleware, sent } = setup();
    const { stub } = renderCrud(
      ui,
      { heroes: lifecycleHeroes(), middleware },
      { etags: undefined },
    );
    await restore();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /ETag is unknown/,
    );
    expect(sent).toHaveLength(0);
    // Nowhere to look: the record is not even read.
    expect(stub.requests.filter((r) => r.startsWith("GET")).join()).not.toMatch(
      /json\?id=1/,
    );
  });

  it("shows the error alert on a 412 and does not restore", async () => {
    const { middleware, sent, cache } = setup();
    const heroes = lifecycleHeroes();
    renderCrud(ui, { heroes, middleware }, { etags: cache });
    await userEvent.click(
      await screen.findByRole("button", { name: "load record" }),
    );
    await waitFor(() => expect(sent).toHaveLength(0));
    // Another writer changes the record after it was cached: its ETag is stale.
    touch(heroes[0] as never);
    await restore();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /precondition failed/i,
    );
    expect(sent).toHaveLength(1);
  });

  it("sends no If-Match for a resource without conditional requests", async () => {
    const { middleware, sent } = setup();
    renderCrud(
      ui,
      {
        heroes: lifecycleHeroes(),
        middleware,
        manifestPatch: (m) => {
          for (const r of m.resources)
            r.capabilities.conditional_requests = false;
        },
      },
      { etags: undefined },
    );
    await restore();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toBeNull();
  });

  it("shows a lookup that rejects with a non-Error and sends nothing", async () => {
    const { middleware, sent } = setup();
    const etags = { cachedEtag: () => Promise.reject("lookup failed") };
    renderCrud(ui, { heroes: lifecycleHeroes(), middleware }, { etags });
    await restore();
    expect(await screen.findByRole("alert")).toHaveTextContent("lookup failed");
    expect(sent).toHaveLength(0);
  });

  it("cannot be cancelled while the ETag is looked up", async () => {
    const { middleware, sent, cache } = setup();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let hold = false;
    const gate: Middleware = async (ctx, next) => {
      if (hold && ctx.request.method === "GET") await held;
      return next(ctx);
    };
    renderCrud(
      ui,
      { heroes: lifecycleHeroes(), middleware: [gate, ...middleware] },
      { etags: cache },
    );
    await screen.findByRole("button", { name: "Restore revision 101" });
    hold = true;
    await userEvent.click(
      screen.getByRole("button", { name: "Restore revision 101" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restore",
      }),
    );
    // The close request is ignored while the lookup runs.
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    release();
    await waitFor(() => expect(sent).toHaveLength(1));
  });

  it("closes on Cancel before the restore is confirmed, sending nothing", async () => {
    const { middleware, sent, cache } = setup();
    renderCrud(ui, { heroes: lifecycleHeroes(), middleware }, { etags: cache });
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore revision 101" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toHaveLength(0);
  });
});
