import { SignalContext } from "./context";
import type {
  iReadonlySignalState,
  iSignalOptions,
  iSignalStateSymb,
  WritableSignal,
} from "./types";
import { SIGNAL_SYMBOL } from "./types";
import { defaultEqual } from "./utils";

/**
 * An atomic piece of state that can be read and updated.
 * These are used to update the UI and trigger computations when their value changes.
 * A signal can be created with an optional default value and an equality function to determine when updates should trigger.
 *
 * Example usage:
 * ```ts
 * const count = signal(0);
 * const unsubscribe = count.subscribe((val) => console.log("Count changed:", val));
 * count.set(1); // Logs: "Count changed: 1"
 * count.update((prev) => prev + 1); // Logs: "Count changed: 2"
 * unsubscribe(); // Stops logging changes
 * ```
 *
 * You can use it with `useSignal` hook in React to subscribe to changes and get the current value of the signal.
 * ```tsx
 * const count = signal(0);
 * function Counter() {
 *   const currentCount = useSignal(count);
 *   return <div>{currentCount}</div>;
 * }
 * ```
 */
export function signal<T>(): WritableSignal<T | undefined>;
export function signal<T>(defaultValue: T, opts?: iSignalOptions<T>): WritableSignal<T>;
export function signal<T>(
  defaultValue?: T | undefined,
  opts?: iSignalOptions<T>,
): WritableSignal<T | undefined> {
  const equal = opts?.equal ?? defaultEqual;
  const _state: iReadonlySignalState<T | undefined> = {
    value: defaultValue,
    listeners: new Set(),
  };

  const signalRef = (() => {
    if (SignalContext.isContextOpen) SignalContext.register(signalRef);
    return _state.value;
  }) as WritableSignal<T | undefined> & iSignalStateSymb<T | undefined>;

  Object.defineProperty(signalRef, SIGNAL_SYMBOL, { value: _state });

  Object.defineProperty(signalRef, "set", {
    value: (value: T) => {
      const prev = _state.value as T;
      if (equal(prev, value)) return;

      _state.value = value;
      for (const l of _state.listeners) l(value);
    },
  });

  Object.defineProperty(signalRef, "update", {
    value: (fn: (prev: T) => T) => {
      const prev = _state.value as T;
      const next = fn(prev);
      signalRef.set(next);
    },
  });

  Object.defineProperty(signalRef, "subscribe", {
    value: (listener: (val: T | undefined) => void) => {
      _state.listeners.add(listener);
      return () => _state.listeners.delete(listener);
    },
  });

  Object.freeze(signalRef);
  return signalRef;
}
