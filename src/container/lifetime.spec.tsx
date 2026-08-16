import { makeInjectable, NodeContainer } from "@illuma/core";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { DiContext } from "./context";
import { useDiContainer } from "./hooks/container.hook";
import { useDependency } from "./hooks/dependency.hook";
import { LIFECYCLE_NODE } from "./lifecycle";
import { IllumaRoot, ProviderGroup } from "./provider";
import { childHookCount, collect, flush } from "./test-utils";

const log: string[] = [];

class _ScopedService {
  constructor() {
    log.push("construct");
  }

  public onMount(): void {
    log.push("mount");
  }

  public onUnmount(): void {
    log.push("unmount");
  }
}
const ScopedService = makeInjectable(_ScopedService);

const withLifecycle = [ScopedService, { provide: LIFECYCLE_NODE, alias: ScopedService }];

function Leaf() {
  useDependency(ScopedService);
  return <span>leaf</span>;
}

beforeEach(() => {
  log.length = 0;
});

describe("scope lifetime", () => {
  it("leaves nothing on the parent after repeated mount/unmount cycles", async () => {
    const root = new NodeContainer();
    root.bootstrap();

    for (let i = 0; i < 10; i++) {
      const { unmount } = render(
        <DiContext.Provider value={root}>
          <ProviderGroup providers={[ScopedService]}>
            <Leaf />
          </ProviderGroup>
        </DiContext.Provider>,
      );
      unmount();
    }

    await collect();
    expect(childHookCount(root)).toBe(0);
  });

  it("survives StrictMode's mount/unmount/mount without destroying the container", async () => {
    const { container: dom } = render(
      <StrictMode>
        <IllumaRoot>
          <ProviderGroup providers={withLifecycle}>
            <Leaf />
          </ProviderGroup>
        </IllumaRoot>
      </StrictMode>,
    );

    await flush();

    expect(dom.textContent).toContain("leaf");
    expect(log.filter((entry) => entry === "mount").length).toBeGreaterThan(0);
  });

  it("destroys the group's own container once the tree is really gone", async () => {
    const root = new NodeContainer();
    root.bootstrap();

    let scoped: NodeContainer | null = null;
    function Capture() {
      scoped = useDiContainer();
      return null;
    }

    const { unmount } = render(
      <DiContext.Provider value={root}>
        <ProviderGroup providers={[ScopedService]}>
          <Capture />
        </ProviderGroup>
      </DiContext.Provider>,
    );

    expect(scoped).not.toBeNull();
    expect((scoped as unknown as NodeContainer).destroyed).toBe(false);

    unmount();
    await collect();

    expect((scoped as unknown as NodeContainer).destroyed).toBe(true);
    expect(root.destroyed).toBe(false);
  });

  it("runs unmount hooks before the container goes away", async () => {
    const { unmount } = render(
      <IllumaRoot>
        <ProviderGroup providers={withLifecycle}>
          <Leaf />
        </ProviderGroup>
      </IllumaRoot>,
    );

    expect(log.indexOf("construct")).toBeLessThan(log.indexOf("mount"));
    expect(log).not.toContain("unmount");

    unmount();
    await flush();

    expect(log.filter((entry) => entry === "mount")).toHaveLength(1);
    expect(log.filter((entry) => entry === "unmount")).toHaveLength(1);
  });
});

/**
 * The core constructs every factory twice by design: once against proxy
 * dependencies to measure the graph, once for real. That trade-off is core's to
 * make. This adapter's job is only to not multiply it — a service must not be
 * constructed more times just because React rendered speculatively.
 */
describe("construction count", () => {
  function counted() {
    const seen = { count: 0 };
    class _Counted {
      constructor() {
        seen.count++;
      }
    }
    return { seen, Counted: makeInjectable(_Counted) };
  }

  it("costs exactly what a bare container costs", async () => {
    const bare = counted();
    const container = new NodeContainer({ instant: false });
    container.provide(bare.Counted);
    container.bootstrap();
    container.get(bare.Counted);

    const viaReact = counted();
    function CountedLeaf() {
      useDependency(viaReact.Counted);
      return <span>leaf</span>;
    }

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={[viaReact.Counted]}>
          <CountedLeaf />
        </ProviderGroup>
      </IllumaRoot>,
    );
    await flush();

    expect(bare.seen.count).toBeGreaterThan(0);
    expect(viaReact.seen.count).toBe(bare.seen.count);

    view.unmount();
    await flush();
  });

  it("adds no more than one construction under StrictMode's double render", async () => {
    const plainRun = counted();
    function PlainLeaf() {
      useDependency(plainRun.Counted);
      return <span>leaf</span>;
    }
    const plain = render(
      <IllumaRoot>
        <ProviderGroup providers={[plainRun.Counted]}>
          <PlainLeaf />
        </ProviderGroup>
      </IllumaRoot>,
    );
    await flush();
    plain.unmount();
    await flush();

    const strictRun = counted();
    function StrictLeaf() {
      useDependency(strictRun.Counted);
      return <span>leaf</span>;
    }
    const strict = render(
      <StrictMode>
        <IllumaRoot>
          <ProviderGroup providers={[strictRun.Counted]}>
            <StrictLeaf />
          </ProviderGroup>
        </IllumaRoot>
      </StrictMode>,
    );
    await flush();
    strict.unmount();
    await flush();

    expect(strictRun.seen.count).toBeLessThanOrEqual(plainRun.seen.count + 1);
  });
});

describe("containers React throws away", () => {
  const gc = (globalThis as { gc?: () => void }).gc;

  it.runIf(gc)(
    "lets StrictMode's discarded twin be collected instead of retaining it",
    async () => {
      const root = new NodeContainer({ instant: false });
      root.bootstrap();

      const view = render(
        <StrictMode>
          <IllumaRoot container={root}>
            <ProviderGroup providers={[ScopedService]}>
              <Leaf />
            </ProviderGroup>
          </IllumaRoot>
        </StrictMode>,
      );
      await flush();

      view.unmount();
      await flush();

      // The committed container destroyed itself; StrictMode's discarded twin
      // never got the chance, and is only reclaimed by the collector.
      expect(childHookCount(root)).toBeGreaterThan(0);

      for (let i = 0; i < 3; i++) {
        gc?.();
        await flush();
      }

      expect(childHookCount(root)).toBe(0);
    },
  );
});

describe("nested groups", () => {
  const parentLog: string[] = [];

  class _ParentService {
    public onMount(): void {
      parentLog.push("parent.onMount");
    }
  }
  const ParentService = makeInjectable(_ParentService);

  class _ChildService {
    public onMount(): void {
      parentLog.push("child.onMount");
    }
  }
  const ChildService = makeInjectable(_ChildService);

  it("does not re-mount an ancestor's lifecycle nodes", async () => {
    parentLog.length = 0;

    render(
      <IllumaRoot>
        <ProviderGroup
          providers={[ParentService, { provide: LIFECYCLE_NODE, alias: ParentService }]}
        >
          <ProviderGroup
            providers={[ChildService, { provide: LIFECYCLE_NODE, alias: ChildService }]}
          >
            <span>leaf</span>
          </ProviderGroup>
        </ProviderGroup>
      </IllumaRoot>,
    );

    await flush();

    expect(parentLog.filter((e) => e === "parent.onMount")).toHaveLength(1);
    expect(parentLog).toContain("child.onMount");
  });
});
