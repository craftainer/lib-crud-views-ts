import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { JsonObject } from "@craftainer/crud-sdk";
import { describe, expect, it } from "vitest";
import {
  CrudProvider,
  useCrud,
  ResourceGate,
  useResource,
  type ReadyResource,
} from "../../src/core/index.ts";
import { TrashList, useInvalidateResource } from "../../src/lifecycle/index.ts";
import { newQueryClient } from "../helpers.tsx";
import { createStubClient, heroRows, type Stub } from "../fixtures/stub.ts";

const named = (name: string): readonly JsonObject[] =>
  heroRows.map((row) => ({ ...row, name: `${name} ${String(row["id"])}` }));

function providerFor(
  stub: Stub,
  queryClient: QueryClient,
  scope?: string,
): (props: { children: ReactNode }) => ReactNode {
  return ({ children }) => (
    <CrudProvider client={stub.client} queryClient={queryClient} scope={scope}>
      {children}
    </CrudProvider>
  );
}

interface Mounted {
  ready: ReadyResource | undefined;
  names: string[] | undefined;
}

function ListProbe({
  ready,
  out,
}: {
  readonly ready: ReadyResource;
  readonly out: Mounted;
}): null {
  const list = ready.hooks.useList();
  out.ready = ready;
  out.names = list.data?.map((row) => String(row["name"]));
  return null;
}

/** Mounts the heroes list over `stub`; resolves once it has data. */
async function mountList(
  stub: Stub,
  queryClient: QueryClient,
  scope?: string,
): Promise<{ ready: ReadyResource; names: string[] }> {
  const out: Mounted = { ready: undefined, names: undefined };
  const Wrapper = providerFor(stub, queryClient, scope);
  render(
    <Wrapper>
      <ResourceGate name="heroes">
        {(ready) => <ListProbe ready={ready} out={out} />}
      </ResourceGate>
    </Wrapper>,
  );
  await waitFor(() => expect(out.names).toBeDefined());
  return { ready: out.ready as ReadyResource, names: out.names ?? [] };
}

const keysOf = (queryClient: QueryClient): string[] =>
  queryClient
    .getQueryCache()
    .getAll()
    .map((q) => JSON.stringify(q.queryKey));

describe("the query namespace", () => {
  it("is undefined until client.namespace() settles, then the client id and the caller's scope", async () => {
    const stub = createStubClient();
    const { result } = renderHook(() => useCrud().namespace, {
      wrapper: providerFor(stub, newQueryClient()),
    });
    expect(result.current).toBeUndefined();
    await waitFor(() =>
      expect(result.current).toEqual({
        client: "http://stub.test",
        scope: "anon",
      }),
    );
  });

  it("takes the scope from the bearer token, and the id from the client", async () => {
    const stub = createStubClient({ token: "secret", id: "main" });
    const { result } = renderHook(() => useCrud().namespace, {
      wrapper: providerFor(stub, newQueryClient()),
    });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.client).toBe("main");
    expect(result.current?.scope).not.toBe("anon");
    expect(result.current?.scope).toBe(await stub.client.scope());
  });

  it("uses the provider's scope as given, without asking the client", () => {
    const stub = createStubClient({ tokenError: new Error("no token") });
    const { result } = renderHook(() => useCrud(), {
      wrapper: providerFor(stub, newQueryClient(), "u1"),
    });
    expect(result.current.namespace).toEqual({
      client: "http://stub.test",
      scope: "u1",
    });
    expect(result.current.namespaceError).toBeUndefined();
  });

  it.each([
    ["an Error", new Error("no token"), "no token"],
    ["something else", "denied", "denied"],
  ])(
    "fails useResource when client.namespace() rejects with %s",
    async (_, cause, message) => {
      const stub = createStubClient({ tokenError: cause });
      const { result } = renderHook(() => useResource("heroes"), {
        wrapper: providerFor(stub, newQueryClient()),
      });
      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(message);
      expect(stub.requests).toEqual([]);
    },
  );

  it("never shows a previous client's namespace after the client changes", async () => {
    const a = createStubClient({ id: "a" });
    const b = createStubClient({ id: "b" });
    const queryClient = newQueryClient();
    const seen: (string | undefined)[] = [];
    function Probe(): null {
      seen.push(useCrud().namespace?.client);
      return null;
    }
    const tree = (stub: Stub): ReactNode => (
      <CrudProvider client={stub.client} queryClient={queryClient}>
        <Probe />
      </CrudProvider>
    );
    const view = render(tree(a));
    await waitFor(() => expect(seen.at(-1)).toBe("a"));
    const from = seen.length;
    view.rerender(tree(b));
    await waitFor(() => expect(seen.at(-1)).toBe("b"));
    expect(seen.slice(from)).not.toContain("a");
    expect(seen[from]).toBeUndefined();
  });

  it.each([
    ["answer", {}],
    ["failure", { tokenError: new Error("late") }],
  ])(
    "ignores an %s that arrives after the client changed",
    async (_, options) => {
      const a = createStubClient({ id: "a", ...options });
      const b = createStubClient({ id: "b" });
      const queryClient = newQueryClient();
      const seen: (string | undefined)[] = [];
      function Probe(): null {
        seen.push(useCrud().namespace?.client);
        return null;
      }
      const tree = (stub: Stub): ReactNode => (
        <CrudProvider client={stub.client} queryClient={queryClient}>
          <Probe />
        </CrudProvider>
      );
      const view = render(tree(a));
      view.rerender(tree(b));
      await waitFor(() => expect(seen.at(-1)).toBe("b"));
      expect(seen).not.toContain("a");
    },
  );
});

describe("two clients or scopes on one QueryClient", () => {
  it("never share manifests, lists or handles", async () => {
    const queryClient = newQueryClient();
    const a = createStubClient({ heroes: named("a"), id: "a" });
    const b = createStubClient({ heroes: named("b"), id: "b" });
    const one = await mountList(a, queryClient);
    const two = await mountList(b, queryClient);
    expect(one.names[0]).toMatch(/^a /);
    expect(two.names[0]).toMatch(/^b /);
    // Each client fetched its own manifest and list: nothing was borrowed.
    expect(a.requests.filter((r) => r.includes("heroes"))).toHaveLength(1);
    expect(b.requests.filter((r) => r.includes("heroes"))).toHaveLength(1);
    const keys = keysOf(queryClient);
    expect(keys).toContain('["crud","a","_manifest","anon"]');
    expect(keys).toContain('["crud","b","_manifest","anon"]');
    expect(keys).toContain('["crud","a","heroes","anon","list"]');
    expect(keys).toContain('["crud","b","heroes","anon","list"]');
  });

  it("never share entries when only the scope differs", async () => {
    const queryClient = newQueryClient();
    const a = createStubClient({ heroes: named("one"), token: "t1" });
    const b = createStubClient({ heroes: named("two"), token: "t2" });
    const one = await mountList(a, queryClient);
    const two = await mountList(b, queryClient);
    expect(one.ready.namespace.client).toBe(two.ready.namespace.client);
    expect(one.ready.namespace.scope).not.toBe(two.ready.namespace.scope);
    expect(one.names[0]).toMatch(/^one /);
    expect(two.names[0]).toMatch(/^two /);
    expect(b.requests.filter((r) => r.includes("heroes"))).toHaveLength(1);
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["crud", "http://stub.test", "heroes"] }),
    ).toHaveLength(2);
  });

  it("never share entries when the provider names the scope", async () => {
    const queryClient = newQueryClient();
    const a = createStubClient({ heroes: named("one") });
    const b = createStubClient({ heroes: named("two") });
    const one = await mountList(a, queryClient, "u1");
    const two = await mountList(b, queryClient, "u2");
    expect(one.names[0]).toMatch(/^one /);
    expect(two.names[0]).toMatch(/^two /);
    expect(keysOf(queryClient)).toEqual(
      expect.arrayContaining([
        '["crud","http://stub.test","heroes","u1","list"]',
        '["crud","http://stub.test","heroes","u2","list"]',
      ]),
    );
  });

  it("are refreshed by a write on the same client, other clients are left alone", async () => {
    const queryClient = newQueryClient();
    const a1 = createStubClient({ id: "a", token: "t1" });
    const a2 = createStubClient({ id: "a", token: "t2" });
    const other = createStubClient({ id: "b" });
    const writer = await mountList(a1, queryClient);
    await mountList(a2, queryClient);
    await mountList(other, queryClient);
    const lists = (stub: Stub): number =>
      stub.requests.filter((r) => r.startsWith("GET") && r.includes("heroes"))
        .length;
    const before = { a2: lists(a2), other: lists(other) };
    const create = renderHook(() => writer.ready.hooks.useCreate(), {
      wrapper: providerFor(a1, queryClient),
    });
    await act(async () => {
      await create.result.current.mutateAsync({ name: "New", powers: ["x"] });
    });
    expect(lists(a2)).toBeGreaterThan(before.a2);
    expect(lists(other)).toBe(before.other);
  });
});

describe("useInvalidateResource", () => {
  it("invalidates every version and scope of the resource on this client only", async () => {
    const queryClient = newQueryClient();
    const stub = createStubClient({ id: "a" });
    const seed = (key: readonly unknown[]): void => {
      queryClient.setQueryData(key, []);
    };
    seed(["crud", "a", "heroes", "s1", "list"]);
    seed(["crud", "a", "heroes@v1", "s2", "record", 1]);
    seed(["crud", "a", "quests", "s1", "list"]);
    seed(["crud", "a", "_manifest", "s1"]);
    seed(["crud", "b", "heroes", "s1", "list"]);
    const { result } = renderHook(() => useInvalidateResource("heroes"), {
      wrapper: providerFor(stub, queryClient, "s1"),
    });
    await act(async () => {
      await result.current();
    });
    const invalidated = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.isInvalidated)
      .map((q) => JSON.stringify(q.queryKey));
    expect(invalidated.sort()).toEqual([
      '["crud","a","heroes","s1","list"]',
      '["crud","a","heroes@v1","s2","record",1]',
    ]);
  });
});

describe("the trash query", () => {
  it("is keyed by client, resource and scope, so a resource invalidation covers it", async () => {
    const stub = createStubClient({ id: "a" });
    const queryClient = newQueryClient();
    const Wrapper = providerFor(stub, queryClient, "u1");
    render(
      <Wrapper>
        <TrashList resource="heroes" />
      </Wrapper>,
    );
    await screen.findByText(/trash is empty|Restore/i);
    expect(keysOf(queryClient)).toContain('["crud","a","heroes","u1","trash"]');
  });
});
