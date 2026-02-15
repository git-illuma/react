import { SignalContext } from "./context";
import type {
  iComputedSignalState,
  iSignalOptions,
  iSignalStateSymb,
  ReadonlySignal,
} from "./types";
import { SIGNAL_SYMBOL } from "./types";
import { defaultEqual } from "./utils";

/**
 * Creates a computed signal that derives its value from other signals.
 * It automatically tracks dependencies and updates when any of the dependencies change.
 *
 * @param computation - A function that computes the value of the signal based on other signals.
 * @param opts - Optional configuration for the computed signal, including a custom equality function.
 * @returns A readonly signal that updates its value based on the provided computation.
 *
 * Example usage:
 * ```ts
 * const count = signal(0);
 * const doubleCount = computed(() => count() * 2);
 *
 * console.log(doubleCount()); // 0
 * count.set(1);
 * console.log(doubleCount()); // 2
 * ```
 *
 * The computed signal will only recompute its value when one of its dependencies changes, and it will use the provided equality function to determine if the new value is different from the old value before notifying listeners.
 */
export function computed<T>(
  computation: () => T,
  opts?: iSignalOptions<T>,
): ReadonlySignal<T> {
  const equal = opts?.equal ?? defaultEqual;

  const _state: iComputedSignalState<T> = {
    value: computation(),
    listeners: new Set(),
    cleanups: new Set(),
    deps: SignalContext.scan(computation),
  };

  const passUpdate = () => {
    if (_state.listeners.size === 0) return;

    const next = computation();
    if (equal(_state.value, next)) return;

    _state.value = next;
    for (const l of _state.listeners) l(_state.value);
  };

  const signalRef = (() => {
    if (SignalContext.isContextOpen) SignalContext.register(signalRef);
    if (_state.listeners.size === 0) {
      const next = computation();
      _state.value = next;
    }

    return _state.value;
  }) as ReadonlySignal<T> & iSignalStateSymb<T>;

  Object.defineProperty(signalRef, SIGNAL_SYMBOL, { value: _state });

  Object.defineProperty(signalRef, "subscribe", {
    value: (listener: (val: T) => void) => {
      if (_state.listeners.size === 0) {
        for (const caller of _state.deps) {
          const cleanupFn = caller.subscribe(passUpdate);
          _state.cleanups.add(cleanupFn);
        }

        const next = computation();
        _state.value = next;
        listener(next);
      }

      _state.listeners.add(listener);

      return () => {
        _state.listeners.delete(listener);
        if (_state.listeners.size === 0) {
          for (const cleanupFn of _state.cleanups) cleanupFn();
          _state.cleanups.clear();
        }
      };
    },
  });

  Object.freeze(signalRef);
  return signalRef;
}
