import { makeInjectable, nodeInject } from "@illuma/core";
import { computed, signal } from "@illuma/react-experimental/signals";
import { EventLog } from "./event-log";

/**
 * A root-level resource, to contrast with the screen-level one in `TickerFeed`.
 *
 * The interval belongs to the root container's mount, so it keeps running while
 * you switch screens and stops only when the whole tree goes away. Watch the
 * event log: this one mounts once, `TickerFeed` mounts and unmounts per visit.
 */
class _ClockService {
  private readonly _log = nodeInject(EventLog);

  private _timer?: ReturnType<typeof setInterval>;

  public readonly seconds = signal(0);

  public readonly uptime = computed(() => {
    const total = this.seconds();
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  });

  public onMount(): void {
    this._log.add("ClockService", "onMount — started the root interval");
    this._timer = setInterval(() => this.seconds.update((s) => s + 1), 1000);
  }

  public onUnmount(): void {
    clearInterval(this._timer);
    this._timer = undefined;
    this._log.add("ClockService", "onUnmount — cleared the root interval");
  }
}

export type ClockService = _ClockService;
export const ClockService = makeInjectable(_ClockService);
