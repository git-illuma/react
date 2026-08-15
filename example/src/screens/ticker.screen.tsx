import type { Provider } from "@illuma/core";
import { createComponent, ProviderGroup } from "@illuma/react-experimental";
import { tickerFeedProviders } from "../services/ticker-feed";
import { FrozenTickerSource, TICKER_SOURCE } from "../services/ticker-source";
import { FeedPanel, OuterTickCount } from "../ui/feed-panel";

/**
 * A subtree with its own binding for `TICKER_SOURCE` and its own `TickerFeed`.
 * The screen above keeps the live source; nothing about it changes.
 */
const reboundSourceProviders: Provider[] = [
  { provide: TICKER_SOURCE, useClass: FrozenTickerSource },
  tickerFeedProviders,
];

const TickerView = () => (
  <div className="screen">
    <FeedPanel
      testId="screen-feed"
      title="Screen scope"
      hint="TICKER_SOURCE resolves upwards to the live source provided at the root."
    />

    <ProviderGroup providers={reboundSourceProviders}>
      <section className="nested">
        <FeedPanel
          testId="nested-feed"
          title="Nested group"
          hint="Same component, same token, a different binding for this subtree only."
        />
        <OuterTickCount />
      </section>
    </ProviderGroup>
  </div>
);

/**
 * `createComponent` is `ProviderGroup` as a wrapper: the screen gets its own
 * container, and everything it provides is destroyed when you navigate away.
 */
export const TickerScreen = createComponent(TickerView, [tickerFeedProviders]);
