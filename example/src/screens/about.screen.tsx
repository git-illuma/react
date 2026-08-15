import { NodeToken } from "@illuma/core";
import { useDependency } from "@illuma/react-experimental";
import { BuildProbePanel } from "../ui/side-panels";

interface iTelemetry {
  track(event: string): void;
}

/** Declared, deliberately never provided. */
const TELEMETRY = new NodeToken<iTelemetry>("Telemetry");

/**
 * `optional` covers a token nobody provides, and only that. A service whose
 * constructor throws still throws — a broken dependency is a bug, not an
 * absent one.
 */
const TelemetryStatus = () => {
  const telemetry = useDependency(TELEMETRY, { optional: true });

  return (
    <p data-testid="telemetry-status">
      TELEMETRY resolved to <code>{telemetry === null ? "null" : "an instance"}</code>
    </p>
  );
};

export const AboutScreen = () => (
  <div className="screen">
    <section className="panel">
      <header>
        <h3>About this screen</h3>
      </header>
      <p className="hint">
        Nothing here provides anything. Leaving the ticker screen destroyed its
        container, its feed and the subscription that feed owned — the log below
        records it. The root clock kept running.
      </p>
      <TelemetryStatus />
    </section>

    <BuildProbePanel />
  </div>
);
