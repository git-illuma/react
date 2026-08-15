import { makeInjectable } from "@illuma/core";
import { computed, external, resource, signal } from "@illuma/signals";
import { act, render, renderHook } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDependency } from "../container/hooks/dependency.hook";
import { IllumaRoot, ProviderGroup } from "../container/provider";
import { flush } from "../container/test-utils";
import { useSignal } from "./hooks/signal.hook";

const SIGNAL_STATE = Symbol.for("@illuma/signals/StateSymbol");

/**
 * The listener set a signal keeps. Reaching into the engine's internals on
 * purpose: whether a subscription outlives the component that made it is the
 * whole question here, and nothing public reports it.
 */
function listenerCount(sig: unknown): number {
  return (sig as Record<symbol, { listeners: Set<unknown> }>)[SIGNAL_STATE].listeners
    .size;
}

/** Collects what React shouts about, so a test can assert on it. */
function captureErrors(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => void lines.push(String(args[0])));

  return { lines, restore: () => spy.mockRestore() };
}

/**
 * `external` re-reads its origin on every access while nothing observes it, so a
 * source that hands back a fresh object each time returns a different identity
 * per read. Handing that read to `useSyncExternalStore` as `getSnapshot` is an
 * infinite render loop, and React says so.
 */
describe("a source that mints a fresh value on every read", () => {
  it("does not break React's snapshot contract", () => {
    const errors = captureErrors();

    const ext = external(
      () => ({ n: 1 }),
      () => () => undefined,
    );

    const { result } = renderHook(() => useSignal(ext));
    errors.restore();

    expect(result.current).toEqual({ n: 1 });
    expect(errors.lines.join("\n")).not.toContain("getSnapshot");
  });

  it("settles instead of re-rendering forever", () => {
    const errors = captureErrors();

    const ext = external(
      () => ({ n: 1 }),
      () => () => undefined,
    );

    const seen: unknown[] = [];
    let bump: () => void = () => {};

    function Reader() {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      seen.push(useSignal(ext));
      return null;
    }

    render(<Reader />);
    const afterMount = seen.length;

    act(() => bump());
    act(() => bump());
    errors.restore();

    // Attaching to the source re-reads it once, which is a real change of
    // identity and costs one catch-up render. After that the value is whatever
    // the signal last announced, so an unrelated render cannot move it.
    expect(afterMount).toBeLessThanOrEqual(2);
    expect(seen.length).toBe(afterMount + 2);
    expect(seen[seen.length - 1]).toBe(seen[afterMount]);
  });
});

describe("the subscription a reader holds", () => {
  it("survives re-renders and is dropped exactly once on unmount", () => {
    let attached = 0;
    let detached = 0;

    const ext = external(
      () => 1,
      () => {
        attached++;
        return () => {
          detached++;
        };
      },
    );

    const { rerender, unmount } = renderHook(() => useSignal(ext));
    rerender();
    rerender();

    expect(attached).toBe(1);
    expect(detached).toBe(0);

    unmount();
    expect(attached).toBe(1);
    expect(detached).toBe(1);
  });

  it("moves to the new signal when the argument changes", () => {
    const first = signal("a");
    const second = signal("b");

    const { result, rerender } = renderHook(({ sig }) => useSignal(sig), {
      initialProps: { sig: first },
    });
    expect(result.current).toBe("a");

    rerender({ sig: second });

    expect(result.current).toBe("b");
    expect(listenerCount(first)).toBe(0);
    expect(listenerCount(second)).toBe(1);

    act(() => second.set("b2"));
    expect(result.current).toBe("b2");

    act(() => first.set("a2"));
    expect(result.current).toBe("b2");
  });

  it("catches up when the signal moves between the render and the commit", () => {
    const sig = signal("before");

    function Reader() {
      const value = useSignal(sig);
      // Layout effects run after the render that read the signal and before the
      // passive effect that subscribes to it — exactly the gap in which a cached
      // snapshot could be left behind.
      useLayoutEffect(() => {
        sig.set("after");
      }, []);
      return <span>{value}</span>;
    }

    const view = render(<Reader />);
    expect(view.container.textContent).toBe("after");
  });

  it("keeps reporting the value a suppressed write left behind", () => {
    const sig = signal(0, { equal: (prev, next) => Math.abs(prev - next) <= 2 });
    let bump: () => void = () => {};

    function Reader() {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      return <span>{useSignal(sig)}</span>;
    }

    const view = render(<Reader />);
    expect(view.container.textContent).toBe("0");

    // `equal` suppresses the notification, so nothing observing the signal was
    // told the value moved. An unrelated render must not leak it either.
    act(() => sig.set(1));
    act(() => bump());
    expect(view.container.textContent).toBe("0");

    act(() => sig.set(10));
    expect(view.container.textContent).toBe("10");
  });
});

describe("rendering on a server", () => {
  it("reads the signal without ever subscribing to it", async () => {
    const { renderToString } = await import("react-dom/server");
    const sig = signal(7);

    function Reader() {
      return <span>{useSignal(sig)}</span>;
    }

    expect(renderToString(<Reader />)).toContain("7");
    expect(listenerCount(sig)).toBe(0);
  });
});

describe("a resource read through the hook", () => {
  it("loads once for several readers and aborts when the last one leaves", async () => {
    let aborted = false;
    const loads = vi.fn(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise<string>((resolve) => {
          abortSignal.addEventListener("abort", () => {
            aborted = true;
          });
          setTimeout(() => resolve("payload"), 20);
        }),
    );
    const res = resource(loads);

    const first = renderHook(() => useSignal(res.state));
    const second = renderHook(() => useSignal(res.data));

    expect(loads).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(aborted).toBe(false);

    second.unmount();
    await flush();
    expect(aborted).toBe(true);
  });
});

/**
 * The seam: a service resolved out of a container hands its signals to a
 * component. Tearing the tree down destroys that container, and the reader's
 * subscription has to go with it — otherwise every mount leaves a listener
 * pinned to a graph nobody can reach.
 */
describe("a signal owned by a scoped service", () => {
  class _Store {
    public readonly count = signal(0);
    public readonly doubled = computed(() => this.count() * 2);
  }
  const Store = makeInjectable(_Store);

  it("loses its reader when the tree unmounts", async () => {
    let captured: _Store | null = null;

    function Leaf() {
      const store = useDependency(Store) as _Store;
      captured = store;
      return <span>{useSignal(store.doubled)}</span>;
    }

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={[Store]}>
          <Leaf />
        </ProviderGroup>
      </IllumaRoot>,
    );
    await flush();

    const store = captured as unknown as _Store;
    expect(view.container.textContent).toBe("0");
    expect(listenerCount(store.doubled)).toBe(1);

    view.unmount();
    await flush();

    expect(listenerCount(store.doubled)).toBe(0);
    expect(listenerCount(store.count)).toBe(0);
  });
});
