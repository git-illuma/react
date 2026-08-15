import { isSignal, type ReadonlySignal } from "@illuma/signals";
import { useRef, useSyncExternalStore } from "react";

interface iSignalStore<T> {
  readonly signal: ReadonlySignal<T>;
  readonly subscribe: (onStoreChange: () => void) => () => void;
  readonly getSnapshot: () => T;
}

/**
 * `useSyncExternalStore` requires two consecutive `getSnapshot` calls with no
 * notification in between to return the very same value, and reading a signal
 * does not promise that: `external` re-reads its origin on every access while
 * nothing observes it, so a source that hands back a fresh object each time
 * yields a different identity per call. React answers that with an infinite
 * render loop.
 *
 * So the value React sees is the last one the signal announced, not whatever a
 * read would produce right now. The subscription carries the value with it, and
 * subscribing emits the current one straight away, so the cache cannot start out
 * behind the signal.
 */
function createStore<T>(signalRef: ReadonlySignal<T>): iSignalStore<T> {
  let snapshot = signalRef();

  return {
    signal: signalRef,
    subscribe: (onStoreChange) =>
      signalRef.subscribe((value) => {
        snapshot = value;
        onStoreChange();
      }),
    getSnapshot: () => snapshot,
  };
}

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

  const store = useRef<iSignalStore<T> | null>(null);
  if (store.current?.signal !== signalRef) store.current = createStore(signalRef);

  // A signal is readable synchronously off the server too, so the server
  // snapshot is the same getter. Without this argument React throws outright
  // during `renderToString`.
  const { subscribe, getSnapshot } = store.current;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
