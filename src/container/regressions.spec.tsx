import {
  LifecycleRef,
  makeInjectable,
  NodeContainer,
  NodeToken,
  nodeInject,
  type Provider,
} from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import { render } from "@testing-library/react";
import { Activity, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiContext } from "./context";
import { __resetReactDiagnostics, enableReactDiagnostics } from "./diagnostics";
import { useDiContainer } from "./hooks/container.hook";
import { useDependency } from "./hooks/dependency.hook";
import { LIFECYCLE_NODE } from "./lifecycle";
import { IllumaRoot, ProviderGroup } from "./provider";
import { ContainerScope, type ScopeOptions } from "./scope";
import { childHookCount, flush } from "./test-utils";

afterEach(() => {
  __resetReactDiagnostics();
  Illuma.setLogger(null);
});

/**
 * An `<Activity>` that is hidden runs effect cleanups but keeps its state, then
 * re-renders before running effects again when it is shown. A container revived
 * on commit would arrive one render too late.
 */
describe("Activity hide/show", () => {
  const LABEL = new NodeToken<string>("activity-label");

  function Show() {
    return <span>{useDependency(LABEL)}</span>;
  }

  it("resolves against a live container on the render that re-shows it", async () => {
    const tree = (hidden: boolean) => (
      <IllumaRoot>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <ProviderGroup providers={[{ provide: LABEL, factory: () => "alive" }]}>
            <Show />
          </ProviderGroup>
        </Activity>
      </IllumaRoot>
    );

    const view = render(tree(false));
    await flush();
    expect(view.container.textContent).toBe("alive");

    view.rerender(tree(true));
    await flush();

    view.rerender(tree(false));
    await flush();

    expect(view.container.textContent).toBe("alive");
  });

  it("re-parents a nested group instead of rebuilding onto a destroyed parent", async () => {
    const OUTER = new NodeToken<string>("outer");
    const INNER = new NodeToken<string>("inner");

    function Both() {
      return (
        <span>
          {useDependency(OUTER)}/{useDependency(INNER)}
        </span>
      );
    }

    const tree = (hidden: boolean) => (
      <IllumaRoot>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <ProviderGroup providers={[{ provide: OUTER, factory: () => "o" }]}>
            <ProviderGroup providers={[{ provide: INNER, factory: () => "i" }]}>
              <Both />
            </ProviderGroup>
          </ProviderGroup>
        </Activity>
      </IllumaRoot>
    );

    const view = render(tree(false));
    await flush();
    expect(view.container.textContent).toBe("o/i");

    view.rerender(tree(true));
    await flush();
    view.rerender(tree(false));
    await flush();

    expect(view.container.textContent).toBe("o/i");
  });
});

describe("a lifecycle hook that throws", () => {
  it("still releases the scope when onUnmount throws", async () => {
    class _Bad {
      public onUnmount(): void {
        throw new Error("unmount boom");
      }
    }
    const Bad = makeInjectable(_Bad);

    const root = new NodeContainer({ instant: false });
    root.bootstrap();

    const { unmount } = render(
      <DiContext.Provider value={root}>
        <ProviderGroup providers={[Bad, { provide: LIFECYCLE_NODE, alias: Bad }]}>
          <span>leaf</span>
        </ProviderGroup>
      </DiContext.Provider>,
    );

    expect(() => unmount()).toThrow(/unmount boom/);
    await flush();

    expect(childHookCount(root)).toBe(0);
  });

  it("still releases the scope when onMount throws", async () => {
    class _Bad {
      public onMount(): void {
        throw new Error("mount boom");
      }
    }
    const Bad = makeInjectable(_Bad);

    const root = new NodeContainer({ instant: false });
    root.bootstrap();

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <DiContext.Provider value={root}>
          <ProviderGroup providers={[Bad, { provide: LIFECYCLE_NODE, alias: Bad }]}>
            <span>leaf</span>
          </ProviderGroup>
        </DiContext.Provider>,
      ),
    ).toThrow(/mount boom/);

    await flush();
    spy.mockRestore();

    expect(childHookCount(root)).toBe(0);
  });

  it("does not let a destroy hook escape as an unhandled error", async () => {
    class _Leaky {
      private readonly _lifecycle = nodeInject(LifecycleRef);

      public arm(): void {
        this._lifecycle.beforeDestroy(() => {
          throw new Error("destroy boom");
        });
      }
    }
    const Leaky = makeInjectable(_Leaky);

    function Arm() {
      useDependency(Leaky).arm();
      return null;
    }

    const error = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn: vi.fn(), error });

    const { unmount } = render(
      <IllumaRoot>
        <ProviderGroup providers={[Leaky]}>
          <Arm />
        </ProviderGroup>
      </IllumaRoot>,
    );

    expect(() => unmount()).not.toThrow();
    await flush();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("destroy hook threw"),
      expect.any(Error),
    );
  });
});

describe("a container built outside React", () => {
  it("runs its lifecycle hooks without any extra registration", async () => {
    const log: string[] = [];

    class _Clock {
      public onMount(): void {
        log.push("mount");
      }

      public onUnmount(): void {
        log.push("unmount");
      }
    }
    const Clock = makeInjectable(_Clock);

    const own = new NodeContainer({ instant: false });
    own.provide([Clock, { provide: LIFECYCLE_NODE, alias: Clock }]);
    own.bootstrap();

    const { unmount } = render(
      <IllumaRoot container={own}>
        <span>leaf</span>
      </IllumaRoot>,
    );
    await flush();

    expect(log).toEqual(["mount"]);

    unmount();
    await flush();

    expect(log).toEqual(["mount", "unmount"]);
    expect(own.destroyed).toBe(false);

    own.destroy();
  });

  it("stops publishing the caller's container once the prop is dropped", async () => {
    const own = new NodeContainer({ instant: false });
    own.bootstrap();

    let seen: NodeContainer | null = null;
    function Capture() {
      seen = useDiContainer();
      return null;
    }

    const view = render(
      <IllumaRoot container={own}>
        <Capture />
      </IllumaRoot>,
    );
    await flush();
    expect(seen).toBe(own);

    view.rerender(
      <IllumaRoot>
        <Capture />
      </IllumaRoot>,
    );
    await flush();

    expect(seen).not.toBe(own);

    // The caller took ownership back, so destroying it must not reach the tree.
    own.destroy();
    expect((seen as unknown as NodeContainer).destroyed).toBe(false);
  });
});

describe("provider diagnostics", () => {
  it("does not confuse two tokens that share a name", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });
    enableReactDiagnostics();

    const OUTER = new NodeToken<string>("dup");
    const INNER = new NodeToken<string>("dup");

    function ReadInner() {
      return <span>{useDependency(INNER)}</span>;
    }

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={[{ provide: OUTER, factory: () => "o" }]}>
          <ProviderGroup providers={[{ provide: INNER, factory: () => "i" }]}>
            <ReadInner />
          </ProviderGroup>
        </ProviderGroup>
      </IllumaRoot>,
    );

    view.unmount();
    await flush();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("without ever injecting"));
  });
});

describe("the providers-changed warning", () => {
  it("stays quiet for the documented inline provider shape across re-renders", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });

    class _Clock {
      public onMount(): void {}
    }
    const Clock = makeInjectable(_Clock);

    const tree = (
      <IllumaRoot>
        <ProviderGroup providers={[Clock, { provide: LIFECYCLE_NODE, alias: Clock }]}>
          <span>leaf</span>
        </ProviderGroup>
      </IllumaRoot>
    );

    const view = render(tree);
    await flush();

    view.rerender(tree);
    view.rerender(tree);
    await flush();

    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * A scope's container is weakly linked to its parent, which is the only reason
 * it is safe to build one during a render React may throw away. The price of
 * that link is that a discarded container never runs its destroy hooks, so it
 * may only ever hold things that are free to drop.
 */
describe("eager instantiation", () => {
  it("never fills a container React might discard", async () => {
    let runs = 0;
    const TOKEN = new NodeToken<string>("eager-token");

    const view = render(
      <StrictMode>
        <IllumaRoot>
          <ProviderGroup
            {...({ instant: true } as ScopeOptions)}
            providers={[
              {
                provide: TOKEN,
                factory: () => {
                  runs++;
                  return "x";
                },
              },
            ]}
          >
            <span>leaf</span>
          </ProviderGroup>
        </IllumaRoot>
      </StrictMode>,
    );
    await flush();

    // The core still runs a scan pass per container to measure the graph; what
    // must not happen is a second, real construction nobody will ever destroy.
    expect(runs).toBeLessThanOrEqual(2);

    view.unmount();
    await flush();
    expect(runs).toBeLessThanOrEqual(2);
  });
});

/**
 * A render reads the container, then the deferred release of an earlier unmount
 * destroys it, and only then does the commit arrive. React yields between the
 * two whenever the update is a transition, so the microtask that destroys the
 * container lands squarely in that gap. The rebuild on retain is invisible to
 * the render that already ran, which is what the listeners are for.
 */
describe("a release that lands between a render and its commit", () => {
  it("tells listeners that the container they read was replaced", async () => {
    const scope = ContainerScope.create({});
    const read = scope.getContainer();

    scope.retain();
    scope.release();
    await flush();
    expect(read.destroyed).toBe(true);

    const woken = vi.fn();
    scope.subscribe(woken);

    scope.retain();

    expect(woken).toHaveBeenCalledTimes(1);
    expect(scope.getContainer()).not.toBe(read);
    expect(scope.getContainer().destroyed).toBe(false);

    scope.release();
    await flush();
  });

  it("stays quiet when the container it read is still alive", async () => {
    const scope = ContainerScope.create({});
    const woken = vi.fn();
    scope.subscribe(woken);

    scope.retain();
    scope.release();
    scope.retain();
    await flush();

    expect(woken).not.toHaveBeenCalled();
    expect(scope.getContainer().destroyed).toBe(false);

    scope.release();
    await flush();
  });
});

describe("cross-bundle identity", () => {
  it("keys the context and lifecycle token on globalThis so bundles agree", () => {
    const g = globalThis as Record<symbol, unknown>;

    expect(g[Symbol.for("@illuma/react-experimental/DiContext")]).toBe(DiContext);
    expect(g[Symbol.for("@illuma/react-experimental/LifecycleNode")]).toBe(
      LIFECYCLE_NODE,
    );
  });
});

describe("a lifecycle node that throws on mount", () => {
  it("unmounts the nodes that already mounted, instead of stranding them", () => {
    const log: string[] = [];

    class _Good {
      public onMount(): void {
        log.push("good.onMount");
      }

      public onUnmount(): void {
        log.push("good.onUnmount");
      }
    }
    const Good = makeInjectable(_Good);

    class _Bad {
      public onMount(): void {
        throw new Error("mount boom");
      }
    }
    const Bad = makeInjectable(_Bad);

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <IllumaRoot>
          <ProviderGroup
            providers={[
              Good,
              { provide: LIFECYCLE_NODE, alias: Good },
              Bad,
              { provide: LIFECYCLE_NODE, alias: Bad },
            ]}
          >
            <span>leaf</span>
          </ProviderGroup>
        </IllumaRoot>,
      ),
    ).toThrow(/mount boom/);

    spy.mockRestore();

    expect(log).toEqual(["good.onMount", "good.onUnmount"]);
  });
});

describe("provider diagnostics", () => {
  it("sees through a nested provider array", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });
    enableReactDiagnostics();

    class _Unused {}
    const Unused = makeInjectable(_Unused);
    const grouped: Provider[] = [[Unused]];

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={grouped}>
          <span>leaf</span>
        </ProviderGroup>
      </IllumaRoot>,
    );

    view.unmount();
    await flush();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("without ever injecting"));
  });

  it("does not accuse a lifecycle registration of being unused", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });
    enableReactDiagnostics();

    class _Clock {
      public onMount(): void {}
      public onUnmount(): void {}
    }
    const Clock = makeInjectable(_Clock);

    function Leaf() {
      useDependency(Clock);
      return <span>leaf</span>;
    }

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={[Clock, { provide: LIFECYCLE_NODE, alias: Clock }]}>
          <Leaf />
        </ProviderGroup>
      </IllumaRoot>,
    );

    view.unmount();
    await flush();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("the providers-changed warning", () => {
  it("notices a swap between two different nested arrays", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });

    const A = new NodeToken<string>("nested-a");
    const B = new NodeToken<string>("nested-b");
    const groupA: Provider[] = [[{ provide: A, factory: () => "a" }]];
    const groupB: Provider[] = [[{ provide: B, factory: () => "b" }]];

    const tree = (providers: Provider[]) => (
      <IllumaRoot>
        <ProviderGroup providers={providers}>
          <span>leaf</span>
        </ProviderGroup>
      </IllumaRoot>
    );

    const view = render(tree(groupA));
    await flush();
    expect(warn).not.toHaveBeenCalled();

    view.rerender(tree(groupB));
    await flush();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`providers` changed"));
  });

  it("stays quiet when a root is handed a container it did not have before", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });

    class _Svc {}
    const Svc = makeInjectable(_Svc);

    const own = new NodeContainer({ instant: false });
    own.bootstrap();

    const view = render(
      <IllumaRoot providers={[Svc]}>
        <span>leaf</span>
      </IllumaRoot>,
    );
    await flush();

    view.rerender(
      <IllumaRoot container={own}>
        <span>leaf</span>
      </IllumaRoot>,
    );
    await flush();

    expect(warn).not.toHaveBeenCalled();

    own.destroy();
  });
});
