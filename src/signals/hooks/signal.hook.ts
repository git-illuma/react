import { isSignal, type ReadonlySignal } from "@illuma/signals";
import { useSyncExternalStore } from "react";

/**
 * React hook to subscribe to a signal and get its current value.
 *
 * @param signalRef - A reference to a signal (can be a regular `signal`, `computed`, `linkedSignal` or `external`).
 * @returns The current value of the signal.
 */
export function useSignal<T>(signalRef: ReadonlySignal<T>): T {
  if (!isSignal(signalRef)) {
    throw new Error("useSignal expects a signal as an argument");
  }

  // A signal is readable synchronously off the server too, so the server
  // snapshot is the same read. Without this argument React throws outright
  // during `renderToString`.
  return useSyncExternalStore(signalRef.subscribe, signalRef, signalRef);
}
