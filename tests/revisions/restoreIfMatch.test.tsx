// Restoring a revision is a PATCH by record id (`useUpdate`), so the SDK
// cache's `autoIfMatch` adds the cached record ETag as `If-Match`.
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
  return { middleware: [cache.middleware, cache.autoIfMatch, spy], sent };
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

describe("restoring a revision with autoIfMatch", () => {
  it("sends If-Match from the cached ETag of that record", async () => {
    const { middleware, sent } = setup();
    const heroes = lifecycleHeroes();
    renderCrud(ui, { heroes, middleware });
    await userEvent.click(
      await screen.findByRole("button", { name: "load record" }),
    );
    const cached = etagOf(heroes[0] as never);
    await restore();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toBe(cached);
  });

  it("sends no If-Match when no ETag is cached", async () => {
    const { middleware, sent } = setup();
    renderCrud(ui, { heroes: lifecycleHeroes(), middleware });
    await restore();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toBeNull();
  });

  it("shows the error alert on a 412 and does not restore", async () => {
    const { middleware, sent } = setup();
    const heroes = lifecycleHeroes();
    renderCrud(ui, { heroes, middleware });
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
});
