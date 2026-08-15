import { createTestScope } from "@illuma/react-experimental/testkit";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { appProviders } from "./providers";
import { TickerScreen } from "./screens/ticker.screen";
import type { iTickerSource, TickListener } from "./services/ticker-source";
import { TICKER_SOURCE } from "./services/ticker-source";

/**
 * A source the test drives by hand. It also counts its listeners, which is how
 * the assertions below check that the mount took the subscription and the
 * unmount gave it back.
 */
class FakeTickerSource implements iTickerSource {
  private readonly _listeners = new Set<TickListener>();

  public get listenerCount(): number {
    return this._listeners.size;
  }

  public subscribe(onTick: TickListener): () => void {
    this._listeners.add(onTick);
    return () => {
      this._listeners.delete(onTick);
    };
  }

  public emit(symbol: string, price: number): void {
    for (const listener of [...this._listeners]) listener({ symbol, price });
  }
}

/**
 * `appProviders` on its own, with this test binding `TICKER_SOURCE` itself.
 *
 * Spreading the application's full provider list and appending an override
 * would not work: a container rejects two providers for the same token. The
 * seam is kept out of `appProviders` for exactly this reason.
 */
function mountScreen() {
  const scope = createTestScope({
    providers: [appProviders, { provide: TICKER_SOURCE, useClass: FakeTickerSource }],
  });

  const source = scope.container.get(TICKER_SOURCE) as FakeTickerSource;

  return { scope, source };
}

const flush = () => act(async () => undefined);

afterEach(cleanup);

describe("ticker screen", () => {
  it("resolves the fake bound by the test, not the live source", () => {
    const { scope, source } = mountScreen();

    expect(source).toBeInstanceOf(FakeTickerSource);

    scope.destroy();
  });

  it("subscribes on mount, renders ticks, and releases on unmount", async () => {
    const { scope, source } = mountScreen();

    const view = render(<TickerScreen />, { wrapper: scope.wrapper });
    await flush();

    expect(source.listenerCount).toBe(1);

    await act(async () => source.emit("ILM", 123.45));

    const feed = within(screen.getByTestId("screen-feed"));
    expect(feed.getByTestId("price-ILM").textContent).toBe("123.45");

    view.unmount();
    await flush();

    expect(source.listenerCount).toBe(0);

    scope.destroy();
  });

  it("keeps exactly one subscription through StrictMode's double mount", async () => {
    const { scope, source } = mountScreen();

    const view = render(
      <StrictMode>
        <TickerScreen />
      </StrictMode>,
      { wrapper: scope.wrapper },
    );
    await flush();

    expect(source.listenerCount).toBe(1);

    view.unmount();
    await flush();

    expect(source.listenerCount).toBe(0);

    scope.destroy();
  });

  it("gives the nested group its own feed and leaves the screen's alone", async () => {
    const { scope, source } = mountScreen();

    render(<TickerScreen />, { wrapper: scope.wrapper });
    await flush();

    await act(async () => source.emit("ILM", 10));

    const outer = within(screen.getByTestId("screen-feed"));
    const nested = within(screen.getByTestId("nested-feed"));

    expect(outer.getByTestId("price-ILM").textContent).toBe("10.00");
    expect(nested.getByTestId("price-ILM").textContent).toBe("500.00");
    expect(screen.getByTestId("outer-ticks").textContent).toContain("1 ticks");

    scope.destroy();
  });

  it("outlives the tree, so the container is still readable after an unmount", async () => {
    const { scope, source } = mountScreen();

    const view = render(<TickerScreen />, { wrapper: scope.wrapper });
    await flush();
    view.unmount();
    await flush();

    expect(scope.container.destroyed).toBe(false);
    expect(scope.container.get(TICKER_SOURCE)).toBe(source);

    scope.destroy();
    expect(scope.container.destroyed).toBe(true);
  });
});
