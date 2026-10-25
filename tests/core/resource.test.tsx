import { createTheme } from "@mui/material/styles";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  CrudProvider,
  ResourceGate,
  useCrud,
  useResource,
  type ReadyResource,
} from "../../src/core/index.ts";
import { useFormat } from "../../src/core/context.ts";
import { newQueryClient, renderCrud } from "../helpers.tsx";
import { createStubClient, type StubOptions } from "../fixtures/stub.ts";
import { Fragment, type ReactNode } from "react";

function hookWith(stub: StubOptions, name: string, apiVersion?: string) {
  const s = createStubClient(stub);
  const queryClient = newQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CrudProvider client={s.client} queryClient={queryClient}>
      {children}
    </CrudProvider>
  );
  return {
    ...renderHook(() => useResource(name, apiVersion), { wrapper }),
    stub: s,
    queryClient,
  };
}

async function ready(
  stub: StubOptions = {},
  name = "heroes",
  apiVersion?: string,
) {
  const h = hookWith(stub, name, apiVersion);
  await waitFor(() => expect(h.result.current.status).toBe("ready"));
  return { ...h, view: h.result.current as ReadyResource };
}

describe("CrudProvider", () => {
  it("throws from useCrud outside a provider, and useFormat falls back to defaults", () => {
    expect(() => renderHook(() => useCrud())).toThrow(/CrudProvider/);
    expect(renderHook(() => useFormat()).result.current).toEqual({
      locale: undefined,
      timeZone: undefined,
    });
  });

  it("exposes its settings and wraps the tree in the given theme", () => {
    const s = createStubClient();
    const queryClient = newQueryClient();
    const theme = createTheme({ palette: { primary: { main: "#123456" } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CrudProvider
        client={s.client}
        queryClient={queryClient}
        theme={theme}
        scope="u1"
        locale="fr"
        timeZone="UTC"
      >
        {children}
      </CrudProvider>
    );
    const { result } = renderHook(() => useCrud(), { wrapper });
    expect(result.current).toMatchObject({
      client: s.client,
      queryClient,
      namespace: { client: "https://stub.test", scope: "u1" },
      namespaceError: undefined,
      locale: "fr",
      timeZone: "UTC",
    });
  });

  it("provides a QueryClient to descendants", () => {
    const queryClient = newQueryClient();
    const s = createStubClient();
    const { result } = renderHook(() => useCrud().queryClient, {
      wrapper: ({ children }) => (
        <CrudProvider client={s.client} queryClient={queryClient}>
          <Fragment>{children}</Fragment>
        </CrudProvider>
      ),
    });
    expect(result.current).toBe(queryClient);
    expect(QueryClientProvider).toBeDefined();
  });
});

describe("useResource", () => {
  it("starts pending, then returns the highest api_version with capabilities and fields", async () => {
    const h = hookWith({}, "heroes");
    expect(h.result.current).toEqual({ status: "pending", error: null });
    await waitFor(() => expect(h.result.current.status).toBe("ready"));
    const view = h.result.current as ReadyResource;
    expect(view.resource.api_version).toBe("v2");
    expect(view.capabilities).toBe(view.resource.capabilities);
    expect(view.capabilities.revisions).toBe(true);
    expect(view.fields.map((f) => f.name)).toContain("powers");
    expect(view.field("name")?.kind).toBe("string");
    expect(view.field("nope")).toBeUndefined();
    expect(view.handle.resource).toBe(view.resource);
  });

  it("resolves a given api_version and keeps the hooks stable between renders", async () => {
    const h = await ready({}, "heroes", "v1");
    expect(h.view.resource.api_version).toBe("v1");
    h.rerender();
    expect(h.result.current).toBe(h.view);
  });

  it("errors on an unknown resource, with and without a version", async () => {
    const a = hookWith({}, "nope");
    await waitFor(() => expect(a.result.current.status).toBe("error"));
    expect(a.result.current.error?.message).toMatch(/no resource "nope" for/);
    const b = hookWith({}, "heroes", "v9");
    await waitFor(() => expect(b.result.current.status).toBe("error"));
    expect(b.result.current.error?.message).toMatch(/heroes" v9/);
  });

  it("errors when the manifest cannot be loaded", async () => {
    const h = hookWith({ manifest: "down" }, "heroes");
    await waitFor(() => expect(h.result.current.status).toBe("error"));
  });

  it("errors when the resource handle cannot be built", async () => {
    const h = hookWith({}, "heroes");
    await waitFor(() => expect(h.result.current.status).toBe("ready"));
    // A second hook on a client whose handle query fails after the manifest loaded.
    const s = createStubClient();
    await s.client.manifest();
    const boom = new Error("handle failed");
    s.client.resource = () => Promise.reject(boom);
    const queryClient = newQueryClient();
    const { result } = renderHook(() => useResource("heroes"), {
      wrapper: ({ children }) => (
        <CrudProvider client={s.client} queryClient={queryClient}>
          {children}
        </CrudProvider>
      ),
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(boom);
  });

  it("lists, reads, and paginates through the hooks", async () => {
    const { view, queryClient } = await ready();
    const list = renderHook(() => view.hooks.useList({ limit: 2 }), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(list.result.current.data).toHaveLength(2));
    const one = renderHook(() => view.hooks.useRecord(1), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() =>
      expect(one.result.current.data).toMatchObject({
        id: 1,
        name: "Captain Ledger",
      }),
    );
    const infinite = renderHook(
      () => view.hooks.useInfiniteList({}, { limit: 2 }),
      { wrapper: wrapperFor(queryClient) },
    );
    await waitFor(() =>
      expect(infinite.result.current.data?.pages).toHaveLength(1),
    );
    await act(async () => {
      await infinite.result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(infinite.result.current.data?.pages).toHaveLength(2),
    );
    expect(infinite.result.current.hasNextPage).toBe(false);
  });

  it("exposes the stats, predict and revisions hooks", async () => {
    const { view, queryClient } = await ready();
    for (const useHook of [
      () => view.hooks.useStats().isSuccess, // served by tests/fixtures/routes/stats.ts
      () => view.hooks.usePredict().isSuccess,
      () => view.hooks.useRevisions(1).isError,
    ]) {
      const { result } = renderHook(useHook, {
        wrapper: wrapperFor(queryClient),
      });
      await waitFor(() => expect(result.current).toBe(true)); // the stub serves no revisions route
    }
  });

  it("creates, updates and deletes through the mutation hooks", async () => {
    const { view, queryClient, stub } = await ready();
    const w = wrapperFor(queryClient);
    const create = renderHook(() => view.hooks.useCreate(), { wrapper: w });
    await act(async () => {
      await create.result.current.mutateAsync({ name: "New", powers: ["x"] });
    });
    const update = renderHook(() => view.hooks.useUpdate(), { wrapper: w });
    await act(async () => {
      await update.result.current.mutateAsync({
        id: 100,
        patch: { name: "Renamed" },
        ifMatch: '"v1"',
      });
    });
    const remove = renderHook(() => view.hooks.useDelete(), { wrapper: w });
    await act(async () => {
      await remove.result.current.mutateAsync(100);
    });
    expect(stub.requests.filter((r) => /^(POST|PATCH|DELETE)/.test(r))).toEqual(
      [
        "POST /api/crud/v1/heroes/v2/json",
        "PATCH /api/crud/v1/heroes/v2/json?id=100",
        "DELETE /api/crud/v1/heroes/v2/json?id=100",
      ],
    );
  });

  it("keeps two api versions in separate cache entries", async () => {
    const v1 = await ready({}, "heroes", "v1");
    expect(v1.view.queryName).toBe("heroes@v1");
    const h = hookWith({}, "heroes");
    await waitFor(() => expect(h.result.current.status).toBe("ready"));
    expect((h.result.current as ReadyResource).queryName).toBe("heroes");
    expect(
      v1.queryClient
        .getQueryCache()
        .findAll({ queryKey: ["crud-views", "handle"] }),
    ).toHaveLength(1);
  });
});

function wrapperFor(queryClient: ReturnType<typeof newQueryClient>) {
  const s = createStubClient();
  return ({ children }: { children: ReactNode }) => (
    <CrudProvider client={s.client} queryClient={queryClient}>
      {children}
    </CrudProvider>
  );
}

describe("ResourceGate", () => {
  it("shows a spinner, then the children", async () => {
    renderCrud(
      <ResourceGate name="heroes">
        {(r) => <p>{`ready ${r.resource.name}`}</p>}
      </ResourceGate>,
    );
    expect(
      screen.getByRole("progressbar", { name: "Loading" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("ready heroes")).toBeInTheDocument();
  });

  it("shows custom pending and fallback content", async () => {
    renderCrud(
      <ResourceGate
        name="heroes"
        pending={<p>wait</p>}
        fallback={(e) => <p>{`custom: ${e.name}`}</p>}
      >
        {() => null}
      </ResourceGate>,
      { manifest: "down" },
    );
    expect(screen.getByText("wait")).toBeInTheDocument();
    expect(await screen.findByText(/custom:/)).toBeInTheDocument();
  });

  it("renders nothing when the fallback returns null", async () => {
    renderCrud(
      <ResourceGate name="ghost" fallback={() => null}>
        {() => null}
      </ResourceGate>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falls back to an error alert", async () => {
    renderCrud(<ResourceGate name="ghost">{() => null}</ResourceGate>);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no resource "ghost"/,
    );
  });
});
