import type { Provider } from "@illuma/core";
import { LIFECYCLE_NODE } from "@illuma/react-experimental";
import { BuildProbe } from "./services/build-probe";
import { ClockService } from "./services/clock.service";
import { EventLog } from "./services/event-log";
import { LiveTickerSource, TICKER_SOURCE } from "./services/ticker-source";

/**
 * Everything the application owns outright. A test wants all of it.
 */
export const appProviders: Provider[] = [
  EventLog,
  BuildProbe,
  { provide: LIFECYCLE_NODE, alias: BuildProbe },
  ClockService,
  { provide: LIFECYCLE_NODE, alias: ClockService },
];

/**
 * The bindings that reach the outside world, kept apart from the rest on
 * purpose: a container rejects two providers for one token, so a test that
 * wants a fake source cannot spread the whole list and append an override. It
 * takes `appProviders` and binds this token itself.
 */
export const platformProviders: Provider[] = [
  { provide: TICKER_SOURCE, useClass: LiveTickerSource },
];

/**
 * Module-level on purpose. `providers` is read once, when the container is
 * built; a fresh array literal on every render would be silently ignored, and
 * the adapter warns about exactly that in development.
 */
export const rootProviders: Provider[] = [appProviders, platformProviders];
