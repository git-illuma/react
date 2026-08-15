import { NodeToken } from "@illuma/core";

export interface iTick {
  readonly symbol: string;
  readonly price: number;
}

export type TickListener = (tick: iTick) => void;

/**
 * The seam of this application: everything that reaches the outside world hides
 * behind it. The screen depends on this token, never on a concrete source, so a
 * test can bind a fake to it and the rest of the graph is unchanged.
 */
export interface iTickerSource {
  /** Starts delivering ticks. The returned function stops them again. */
  subscribe(onTick: TickListener): () => void;
}

export const TICKER_SOURCE = new NodeToken<iTickerSource>("TickerSource");

const SYMBOLS = ["ILM", "RCT", "SIG"] as const;
const TICK_INTERVAL_MS = 700;

/**
 * The real source. Note what the constructor does not do: it opens no timer.
 *
 * Two separate reasons, and either one alone is enough:
 *
 * 1. The container runs every constructor twice — once against proxy
 *    dependencies to measure the graph, once for real. A timer started in a
 *    constructor is therefore started twice and only ever stopped once.
 * 2. A service may be built by a render React then throws away, and nothing
 *    tells you when that happens. Only a mount is guaranteed to be paired with
 *    an unmount.
 *
 * Here the interval is owned by the subscription instead: it starts with the
 * first listener and stops with the last one. `TickerFeed` is what turns a
 * React mount into that subscription.
 */
export class LiveTickerSource implements iTickerSource {
  private readonly _listeners = new Set<TickListener>();
  private readonly _prices = new Map<string, number>(
    SYMBOLS.map((symbol, i) => [symbol, 100 + i * 25]),
  );

  private _timer?: ReturnType<typeof setInterval>;

  public subscribe(onTick: TickListener): () => void {
    this._listeners.add(onTick);
    if (this._listeners.size === 1) this._start();

    return () => {
      this._listeners.delete(onTick);
      if (this._listeners.size === 0) this._stop();
    };
  }

  private _start(): void {
    this._timer = setInterval(() => {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const previous = this._prices.get(symbol) ?? 100;
      const next = Math.max(1, Math.round((previous + (Math.random() - 0.5) * 6) * 100) / 100);

      this._prices.set(symbol, next);
      for (const listener of [...this._listeners]) listener({ symbol, price: next });
    }, TICK_INTERVAL_MS);
  }

  private _stop(): void {
    clearInterval(this._timer);
    this._timer = undefined;
  }
}

/**
 * A second implementation of the same token, used further down the tree to show
 * that a subtree can be given its own binding. It delivers one burst and stops.
 */
export class FrozenTickerSource implements iTickerSource {
  public subscribe(onTick: TickListener): () => void {
    let live = true;

    queueMicrotask(() => {
      if (!live) return;
      SYMBOLS.forEach((symbol, i) => onTick({ symbol, price: 500 + i }));
    });

    return () => {
      live = false;
    };
  }
}
