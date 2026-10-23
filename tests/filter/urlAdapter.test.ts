import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultUrlAdapter,
  memoryUrlAdapter,
  windowUrlAdapter,
} from "../../src/filter/index.ts";

describe("memoryUrlAdapter", () => {
  it("reads, writes and notifies until unsubscribed", () => {
    const adapter = memoryUrlAdapter("a=1");
    const listener = vi.fn();
    const off = adapter.subscribe(listener);
    expect(adapter.read()).toBe("a=1");
    adapter.write("b=2", "push");
    expect(adapter.read()).toBe("b=2");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    adapter.write("", "replace");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("starts empty", () => {
    expect(memoryUrlAdapter().read()).toBe("");
  });
});

describe("windowUrlAdapter", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("keeps the query string in the address and follows history", () => {
    window.history.replaceState(null, "", "/heroes?x=1#top");
    const adapter = windowUrlAdapter();
    const listener = vi.fn();
    const off = adapter.subscribe(listener);
    expect(adapter.read()).toBe("x=1");

    adapter.write("q=ada", "push");
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/heroes?q=ada#top");
    expect(adapter.read()).toBe("q=ada");
    const length = window.history.length;

    adapter.write("", "replace");
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(length);
    expect(listener).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(listener).toHaveBeenCalledTimes(3);
    off();
    window.dispatchEvent(new PopStateEvent("popstate"));
    adapter.write("a=1", "push");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("shares one default adapter", () => {
    expect(defaultUrlAdapter()).toBe(defaultUrlAdapter());
  });
});
