import { useDependency } from "@illuma/react-experimental";
import { useSignal } from "@illuma/react-experimental/signals";
import { BuildProbe } from "../services/build-probe";
import { ClockService } from "../services/clock.service";
import { EventLog } from "../services/event-log";

/**
 * Reads a root service from a component that sits below two nested containers.
 * Resolution walks up until it finds the provider, exactly as it does in the
 * core container — React's tree is the container tree here.
 */
export const ClockBadge = () => {
  const clock = useDependency(ClockService);
  const uptime = useSignal(clock.uptime);

  return (
    <div className="clock">
      root container up for <strong>{uptime}</strong>
    </div>
  );
};

export const EventLogPanel = () => {
  const log = useDependency(EventLog);
  const entries = useSignal(log.entries);

  return (
    <section className="panel log">
      <header>
        <h3>Lifecycle log</h3>
      </header>
      <p className="hint">
        Oldest first. Switch screens and watch which lines repeat: the root clock
        mounts once, every screen feed mounts and unmounts with its scope. Under
        StrictMode the whole sequence runs twice on the first mount, on purpose.
      </p>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <code>{entry.scope}</code> {entry.message}
          </li>
        ))}
      </ol>
    </section>
  );
};

/**
 * The number that makes the constructor rule concrete. One live instance of
 * `BuildProbe` exists, and the container built it more times than that.
 */
export const BuildProbePanel = () => {
  const probe = useDependency(BuildProbe);

  return (
    <section className="panel probe">
      <header>
        <h3>Constructor runs</h3>
      </header>
      <p>
        <strong>{probe.constructorRuns}</strong> constructor runs produced the one
        instance this component is holding.
      </p>
      <p className="hint">
        The container measures a provider's dependencies by building it once
        against proxies before building it for real — so twice per container,
        and React is free to build more than one container per mount. Under
        StrictMode this counter reads 3. Treat the number as unbounded: the rule
        is that a constructor causes nothing to happen.
      </p>
    </section>
  );
};
