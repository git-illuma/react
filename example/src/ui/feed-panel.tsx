import { useDependency } from "@illuma/react-experimental";
import { useSignal } from "@illuma/react-experimental/signals";
import { TickerFeed } from "../services/ticker-feed";

interface iFeedPanelProps {
  readonly title: string;
  readonly hint: string;
  readonly testId: string;
}

/**
 * One component, resolved against whichever container is nearest. Rendered
 * directly under the screen it reads the screen's feed; rendered inside the
 * nested group on the same screen it reads that group's own feed, bound to a
 * different source. Neither instance knows the other exists.
 */
export const FeedPanel = ({ title, hint, testId }: iFeedPanelProps) => {
  const feed = useDependency(TickerFeed);

  const rows = useSignal(feed.rows);
  const ticks = useSignal(feed.ticks);
  const live = useSignal(feed.live);

  return (
    <section className="panel" data-testid={testId}>
      <header>
        <h3>{title}</h3>
        <span className={live ? "badge badge-live" : "badge"}>
          {live ? `${ticks} ticks` : "waiting"}
        </span>
      </header>
      <p className="hint">{hint}</p>
      <table>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="muted">
                no ticks yet
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.symbol}>
                <td>{row.symbol}</td>
                <td data-testid={`price-${row.symbol}`}>{row.price.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
};

/**
 * `skipSelf` starts the lookup at the parent container, so this reads the
 * screen's feed even though the nearest container provides one of its own.
 * Dropping the modifier — or passing `{ self: true }` — would read the nearest
 * one instead.
 */
export const OuterTickCount = () => {
  const outer = useDependency(TickerFeed, { skipSelf: true });
  const ticks = useSignal(outer.ticks);

  return (
    <p className="hint" data-testid="outer-ticks">
      the screen's own feed, reached with <code>skipSelf</code>: {ticks} ticks
    </p>
  );
};
