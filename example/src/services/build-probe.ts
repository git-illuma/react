import { makeInjectable, nodeInject } from "@illuma/core";
import { EventLog } from "./event-log";

let CONSTRUCTOR_RUNS = 0;

/**
 * Not a pattern to copy — a measurement.
 *
 * The container builds every provider twice: once in a dry run, where each
 * `nodeInject` returns a proxy and the only thing being recorded is which
 * dependencies were asked for, and once for real. This service counts its own
 * constructions so the panel on screen can show you the number instead of
 * asking you to take the README's word for it.
 *
 * Twice is per container, and React decides how many containers to build. In
 * StrictMode the counter reads 3 for the one instance that survives. Do not
 * design against a number — design against the rule it forces: a constructor
 * may build fields and inject dependencies, and must cause nothing to happen.
 */
class _BuildProbe {
  private readonly _log = nodeInject(EventLog);

  public readonly runAtBuild: number;

  constructor() {
    CONSTRUCTOR_RUNS += 1;
    this.runAtBuild = CONSTRUCTOR_RUNS;
  }

  public get constructorRuns(): number {
    return CONSTRUCTOR_RUNS;
  }

  /**
   * The effect a naive service would have put in its constructor. It lives on a
   * mount hook instead, so it happens once, and only for the instance that
   * survived.
   */
  public onMount(): void {
    this._log.add(
      "BuildProbe",
      `one live instance, ${CONSTRUCTOR_RUNS} constructor runs behind it`,
    );
  }
}

export type BuildProbe = _BuildProbe;
export const BuildProbe = makeInjectable(_BuildProbe);
