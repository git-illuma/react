import {
  LifecycleRef,
  makeInjectable,
  NodeContainer,
  NodeToken,
  nodeInject,
} from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import { render } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiContext } from "./context";
import { __resetReactDiagnostics, enableReactDiagnostics } from "./diagnostics";
import { useDiContainer } from "./hooks/container.hook";
import { useDependency } from "./hooks/dependency.hook";
import { LIFECYCLE_NODE } from "./lifecycle";
import { IllumaRoot, ProviderGroup } from "./provider";
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

describe("cross-bundle identity", () => {
  it("keys the context and lifecycle token on globalThis so bundles agree", () => {
    const g = globalThis as Record<symbol, unknown>;

    expect(g[Symbol.for("@illuma/react-experimental/DiContext")]).toBe(DiContext);
    expect(g[Symbol.for("@illuma/react-experimental/LifecycleNode")]).toBe(
      LIFECYCLE_NODE,
    );
  });
});
