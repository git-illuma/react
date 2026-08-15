import { NodeContainer } from "@illuma/core";
import { IllumaRoot } from "@illuma/react-experimental";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appProviders } from "./providers";
import { FeedPanel } from "./ui/feed-panel";
import { tickerFeedProviders } from "./services/ticker-feed";
import type { iTickerSource, TickListener } from "./services/ticker-source";
import { TICKER_SOURCE } from "./services/ticker-source";

/**
 * Effects never run on a server, so nothing there can own a container's
 * lifetime — and nothing calls `onMount`. This source records whether anybody
 * tried to subscribe during a server render. Nobody should.
 */
class SsrSource implements iTickerSource {
  public subscribed = 0;

  public subscribe(_onTick: TickListener): () => void {
    this.subscribed += 1;
    return () => undefined;
  }
}

describe("server rendering", () => {
  it("renders against a container the request owns, and takes no resources", () => {
    const container = new NodeContainer({ instant: false });
    container.provide([
      appProviders,
      { provide: TICKER_SOURCE, useClass: SsrSource },
      tickerFeedProviders,
    ]);
    container.bootstrap();

    try {
      const html = renderToString(
        <IllumaRoot container={container}>
          <FeedPanel testId="ssr-feed" title="Server" hint="rendered on a server" />
        </IllumaRoot>,
      );

      expect(html).toContain("no ticks yet");
      expect((container.get(TICKER_SOURCE) as SsrSource).subscribed).toBe(0);
    } finally {
      container.destroy();
    }

    expect(container.destroyed).toBe(true);
  });
});
