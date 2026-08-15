import { makeInjectable, nodeInject, type Provider } from "@illuma/core";
import { LIFECYCLE_NODE } from "@illuma/react-experimental";
import { computed, signal } from "@illuma/react-experimental/signals";
import { EventLog } from "./event-log";
import { type iTick, TICKER_SOURCE } from "./ticker-source";

/**
 * The screen's own service. One instance per container that provides it, which
 * here means one per mounted screen — and one more for the panel below that
 * rebinds `TICKER_SOURCE` in a nested group.
 *
 * The subscription is the resource, and it is taken on mount, released on
 * unmount, and never touched by the constructor.
 */
class _TickerFeed {
  private readonly _source = nodeInject(TICKER_SOURCE);
  private readonly _log = nodeInject(EventLog);

  private _stop?: () => void;

  public readonly prices = signal<Record<string, number>>({});
  public readonly ticks = signal(0);

  /**
   * Derived state stays in the service. React never recomputes it — the signal
   * graph does, and only when something actually reads it.
   */
  public readonly rows = computed(() =>
    Object.entries(this.prices())
      .map(([symbol, price]) => ({ symbol, price }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  );

  public readonly live = computed(() => this.ticks() > 0);

  public onMount(): void {
    this._log.add("TickerFeed", "onMount — subscribed to TICKER_SOURCE");
    this._stop = this._source.subscribe((tick) => this._apply(tick));
  }

  public onUnmount(): void {
    this._stop?.();
    this._stop = undefined;
    this._log.add("TickerFeed", "onUnmount — released the subscription");
  }

  private _apply(tick: iTick): void {
    this.prices.update((prev) => ({ ...prev, [tick.symbol]: tick.price }));
    this.ticks.update((n) => n + 1);
  }
}

export type TickerFeed = _TickerFeed;
export const TickerFeed = makeInjectable(_TickerFeed);

/**
 * A service with lifecycle hooks needs two registrations: one that provides it,
 * one that lists it under `LIFECYCLE_NODE` so its group calls the hooks. A
 * provider array nests, so both can travel as a single entry.
 */
export const tickerFeedProviders: Provider = [
  TickerFeed,
  { provide: LIFECYCLE_NODE, alias: TickerFeed },
];
