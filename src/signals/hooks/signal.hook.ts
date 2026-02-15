import { useSyncExternalStore } from "react";
import type { ReadonlySignal } from "../core/types";

/**
 * React hook to subscribe to a signal and get its current value.
 *
 * @param signalRef - A reference to a signal (can be a regular `signal`, `computed`, or `linkedSignal`).
 * @returns The current value of the signal.
 */
export function useSignal<T>(signalRef: ReadonlySignal<T>): T {
  return useSyncExternalStore(signalRef.subscribe, signalRef);
}
