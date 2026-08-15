import { MultiNodeToken, makeInjectable, NodeToken } from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestScope } from "../testkit";
import { __resetReactDiagnostics, enableReactDiagnostics } from "./diagnostics";
import { useDependency } from "./hooks/dependency.hook";
import { IllumaRoot, ProviderGroup } from "./provider";
import { flush } from "./test-utils";

const LABEL = new NodeToken<string>("label");
const PLUGIN = new MultiNodeToken<string>("plugin");

function Show({ token }: { token: NodeToken<string> }) {
  return <span>{useDependency(token)}</span>;
}

afterEach(() => {
  __resetReactDiagnostics();
  Illuma.setLogger(null);
});

describe("hierarchical resolution", () => {
  it("falls through to an ancestor when the nearest group does not provide", () => {
    const { container: dom } = render(
      <IllumaRoot providers={[{ provide: LABEL, factory: () => "from-root" }]}>
        <ProviderGroup>
          <Show token={LABEL} />
        </ProviderGroup>
      </IllumaRoot>,
    );

    expect(dom.textContent).toBe("from-root");
  });

  it("lets a nearer group shadow an ancestor", () => {
    const { container: dom } = render(
      <IllumaRoot providers={[{ provide: LABEL, factory: () => "from-root" }]}>
        <ProviderGroup providers={[{ provide: LABEL, factory: () => "from-group" }]}>
          <Show token={LABEL} />
        </ProviderGroup>
      </IllumaRoot>,
    );

    expect(dom.textContent).toBe("from-group");
  });

  it("honours skipSelf by starting the lookup at the parent", () => {
    function SkipSelf() {
      return <span>{useDependency(LABEL, { skipSelf: true })}</span>;
    }

    const { container: dom } = render(
      <IllumaRoot providers={[{ provide: LABEL, factory: () => "from-root" }]}>
        <ProviderGroup providers={[{ provide: LABEL, factory: () => "from-group" }]}>
          <SkipSelf />
        </ProviderGroup>
      </IllumaRoot>,
    );

    expect(dom.textContent).toBe("from-root");
  });

  it("returns null for an optional token nobody provides", () => {
    function Optional() {
      const value = useDependency(LABEL, { optional: true });
      return <span>{value === null ? "absent" : value}</span>;
    }

    const { container: dom } = render(
      <IllumaRoot>
        <Optional />
      </IllumaRoot>,
    );

    expect(dom.textContent).toBe("absent");
  });

  it("does not swallow a failing constructor behind `optional`", () => {
    class _Broken {
      constructor() {
        throw new Error("boom");
      }
    }
    const Broken = makeInjectable(_Broken);

    function ReadBroken() {
      useDependency(Broken, { optional: true });
      return null;
    }

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <IllumaRoot providers={[Broken]}>
          <ReadBroken />
        </IllumaRoot>,
      ),
    ).toThrow(/boom/);

    spy.mockRestore();
  });
});

describe("multi providers", () => {
  it("collects every contribution made in the same container", () => {
    function Plugins() {
      return <span>{useDependency(PLUGIN).join(",")}</span>;
    }

    const { container: dom } = render(
      <IllumaRoot
        providers={[
          { provide: PLUGIN, factory: () => "a" },
          { provide: PLUGIN, factory: () => "b" },
        ]}
      >
        <Plugins />
      </IllumaRoot>,
    );

    expect(dom.textContent).toBe("a,b");
  });
});

describe("missing root", () => {
  it("names the problem instead of failing deep inside the container", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Show token={LABEL} />)).toThrow(/No DI container found/);

    spy.mockRestore();
  });
});

describe("server rendering", () => {
  it("renders to a string against a container owned by the caller", () => {
    const scope = createTestScope({
      providers: [{ provide: LABEL, factory: () => "server-side" }],
    });

    const html = renderToString(
      <IllumaRoot container={scope.container}>
        <Show token={LABEL} />
      </IllumaRoot>,
    );

    expect(html).toContain("server-side");

    scope.destroy();
    expect(scope.container.destroyed).toBe(true);
  });
});

describe("testkit", () => {
  it("restages the graph through a single token swap", () => {
    class _Api {
      public name(): string {
        return "real";
      }
    }
    const Api = makeInjectable(_Api);

    class FakeApi {
      public name(): string {
        return "fake";
      }
    }

    function ApiName() {
      return <span>{useDependency(Api).name()}</span>;
    }

    const scope = createTestScope({
      providers: [{ provide: Api, useClass: FakeApi }],
    });

    const { container: dom } = render(<ApiName />, { wrapper: scope.wrapper });

    expect(dom.textContent).toBe("fake");
    scope.destroy();
  });

  it("keeps the container usable after the tree unmounts", () => {
    const scope = createTestScope({
      providers: [{ provide: LABEL, factory: () => "kept" }],
    });

    const view = render(<Show token={LABEL} />, { wrapper: scope.wrapper });
    view.unmount();

    expect(scope.container.destroyed).toBe(false);
    expect(scope.container.get(LABEL)).toBe("kept");

    scope.destroy();
  });
});

describe("diagnostics", () => {
  it("reports providers that nothing ever injected", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });
    enableReactDiagnostics();

    class _Unused {}
    const Unused = makeInjectable(_Unused);

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={[Unused]}>
          <span>leaf</span>
        </ProviderGroup>
      </IllumaRoot>,
    );

    view.unmount();
    await flush();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("without ever injecting"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unused"));
  });

  it("stays quiet when every provider was used", async () => {
    const warn = vi.fn();
    Illuma.setLogger({ log: vi.fn(), warn, error: vi.fn() });
    enableReactDiagnostics();

    const view = render(
      <IllumaRoot>
        <ProviderGroup providers={[{ provide: LABEL, factory: () => "used" }]}>
          <Show token={LABEL} />
        </ProviderGroup>
      </IllumaRoot>,
    );

    view.unmount();
    await flush();

    expect(warn).not.toHaveBeenCalled();
  });
});
