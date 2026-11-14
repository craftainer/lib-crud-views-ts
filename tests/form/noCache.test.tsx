// A cache policy that is NOT revalidate-only (max_age > 0 with the event
// stream "connected") must not weaken the optimistic-concurrency check: the
// read before a save and the reload after a conflict bypass the SDK cache.
import type { JsonObject } from "@craftainer/crud-sdk";
import {
  MemoryStore,
  cachePolicyFromManifest,
  createCache,
} from "@craftainer/crud-sdk/cache";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ResourceForm } from "../../src/index.ts";
import { touch } from "../fixtures/routes/form.ts";
import { heroRows } from "../fixtures/stub.ts";
import { renderCrud } from "../helpers.tsx";

function cachingSetup(props: { etag?: () => string } = {}) {
  const heroes: JsonObject[] = heroRows.map((r) => ({ ...r }));
  const cache = createCache({
    store: new MemoryStore(),
    policies: {
      heroes: cachePolicyFromManifest({
        cache: { max_age: 60, stale_while_revalidate: 60, etag: true },
      }),
    },
  });
  cache.setEventsActive("heroes", true); // fresh hits are served without the network
  const view = renderCrud(
    <ResourceForm name="heroes" id={1} {...props} />,
    { heroes, cache },
    { etags: cache },
  );
  const patches = (): string[] =>
    view.stub.requests.filter((r) => r.startsWith("PATCH"));
  const reads = (): string[] =>
    view.stub.requests.filter(
      (r) => r === "GET /api/crud/v1/heroes/v2/json?id=1",
    );
  return { ...view, heroes, patches, reads, user: userEvent.setup() };
}

describe("the form under a cache policy with max_age > 0", () => {
  it("detects an out-of-band change between load and save (no lost update)", async () => {
    const view = cachingSetup();
    await view.user.type(await screen.findByLabelText(/Name/), "!");
    expect(view.reads()).toHaveLength(1); // the load; cached fresh
    // Someone else changes the record. The event stream has not told us yet.
    view.heroes[0]!["name"] = "Changed elsewhere";
    touch(view.heroes[0] as JsonObject);
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(/This record was changed since you opened it/),
    ).toBeInTheDocument();
    expect(view.patches()).toHaveLength(0);
    expect(view.reads()).toHaveLength(2); // the pre-write read hit the network
  });

  it("shows the server's record on Reload after a conflict, not the cached copy", async () => {
    const view = cachingSetup();
    await view.user.type(await screen.findByLabelText(/Name/), "!");
    view.heroes[0]!["name"] = "Changed elsewhere";
    touch(view.heroes[0] as JsonObject);
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Reload" });
    await view.user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Name/)).toHaveValue("Changed elsewhere"),
    );
    expect(screen.queryByText(/changed since you opened/)).toBeNull();
  });

  it("still saves when nothing changed, sending the validator of the fresh read", async () => {
    const view = cachingSetup();
    await view.user.type(await screen.findByLabelText(/Name/), "!");
    await view.user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(view.patches()).toHaveLength(1);
    expect(view.heroes[0]?.["name"]).toBe("Captain Ledger!");
  });
});
