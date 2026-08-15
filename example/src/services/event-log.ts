import { makeInjectable } from "@illuma/core";
import { signal } from "@illuma/react-experimental/signals";

export interface iLogEntry {
  readonly id: number;
  readonly scope: string;
  readonly message: string;
}

const MAX_ENTRIES = 14;

/**
 * A journal every other service writes to, so the lifecycle you are reading
 * about in the README is visible on screen instead of only in a comment.
 *
 * Provided at the root, which is what makes it survive screen changes: a screen
 * scope resolves the token upwards, finds the provider on the root container,
 * and gets the root's single instance.
 */
class _EventLog {
  private _seq = 0;

  public readonly entries = signal<iLogEntry[]>([]);

  public add(scope: string, message: string): void {
    this._seq += 1;
    const entry: iLogEntry = { id: this._seq, scope, message };
    this.entries.update((prev) => [...prev, entry].slice(-MAX_ENTRIES));
  }
}

export type EventLog = _EventLog;
export const EventLog = makeInjectable(_EventLog);
