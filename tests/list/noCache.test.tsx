// A cache policy that is NOT revalidate-only must not leave the table on the
// copy that just proved stale: the reload after a conflict bypasses the cache.
import type { JsonObject, Middleware } from "@craftainer/crud-sdk";
import {
  MemoryStore,
  cachePolicyFromManifest,
  createCache,
} from "@craftainer/crud-sdk/cache";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { memoryUrlAdapter } from "../../src/filter/index.ts";
import { ResourceList } from "../../src/list/index.ts";
import { heroRows } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";

vi.setConfig({ testTimeout: 30_000 });

const grid = { disableVirtualization: true };
const wait = { timeout: 8000 };

function setup(middleware: Middleware[] = []) {
  const heroes: JsonObject[] = heroRows.map((r) => ({ ...r }));
  const cache = createCache({
    store: new MemoryStore(),
    policies: {
      heroes: cachePolicyFromManifest({
        cache: { max_age: 60, stale_while_revalidate: 60, etag: true },
      }),
    },
  });
  cache.setEventsActive("heroes", true);
  const view = renderCrud(
    <ResourceList
      resource="heroes"
      urlAdapter={memoryUrlAdapter()}
      gridProps={grid}
      columns={["id", "name"]}
      editable
    />,
    { heroes, cache, middleware },
    { etags: cache },
  );
  return { ...view, heroes, user: userEvent.setup() };
}

const edit = async (
  user: ReturnType<typeof userEvent.setup>,
  from: string,
  text: string,
): Promise<void> => {
  await user.dblClick(await screen.findByText(from, {}, wait));
  const input = await screen.findByRole("textbox", {}, wait);
  await user.clear(input);
  await user.type(input, `${text}{Enter}`);
};

describe("the table under a cache policy with max_age > 0", () => {
  it("reloads the list from the server after a conflict, not from the cache", async () => {
    const view = setup();
    await screen.findByText("Captain Ledger", {}, wait);
    view.heroes[0]!["name"] = "Changed elsewhere";
    await edit(view.user, "Captain Ledger", "Captain Index");
    expect(
      await screen.findByText(/changed elsewhere/, {}, wait),
    ).toBeInTheDocument();
    await view.user.keyboard("{Escape}"); // leave the failed cell
    // The grid shows the server's row (the cached page still said "Captain Ledger").
    expect(
      await screen.findByText("Changed elsewhere", {}, wait),
    ).toBeVisible();
    expect(view.stub.requests.some((r) => r.startsWith("PATCH"))).toBe(false);
  });

  it("leaves a failed reload to the list's own error state", async () => {
    let failing = false;
    const fail: Middleware = (ctx, next) =>
      failing && ctx.op === "list"
        ? Promise.resolve(
            new Response(JSON.stringify({ title: "down", status: 500 }), {
              status: 500,
              headers: { "content-type": "application/problem+json" },
            }),
          )
        : next(ctx);
    const view = setup([fail]);
    await screen.findByText("Captain Ledger", {}, wait);
    view.heroes[0]!["name"] = "Changed elsewhere";
    failing = true;
    await edit(view.user, "Captain Ledger", "Captain Index");
    // The reload failed: the list shows its own error, nothing was written.
    expect(await screen.findByRole("alert", {}, wait)).toBeInTheDocument();
    expect(view.stub.requests.some((r) => r.startsWith("PATCH"))).toBe(false);
  });
});
