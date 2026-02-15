import { SignalContext } from "./context";
import type {
  iLinkedSignalState,
  iLinkedSignalWithComputation,
  iSignalStateSymb,
  LinkedSignal,
  LinkedSignalArg,
  ReadonlySignal,
} from "./types";
import { SIGNAL_SYMBOL } from "./types";
import { defaultEqual, isSignal } from "./utils";

/**
 * Creates a linked signal that derives its value from another signal or a computation.
 * The linked signal automatically updates when the source signal changes, and can also have its own computation logic.
 * `linkedSignal` value can be `set` or `update`'d directly, which will override the computed value until the next update from the source signal.
 *
 * @param arg - Either a computation that returns a value
 * or a configuration object with a `source`, `computation`,
 * and optional equality function.
 * @returns A linked signal that reflects the computed value based on the source signal.
 *
 * Example usage:
 * ```ts
 * const count = signal(0);
 * const doubleCount = linkedSignal({
 *   source: count,
 *   computation: (val) => val * 2,
 * });
 * // Or simply:
 * // const doubleCount = linkedSignal(() => count() * 2);
 *
 * console.log(doubleCount()); // 0
 * count.set(1);
 * console.log(doubleCount()); // 2
 *
 * doubleCount.set(10);
 * console.log(doubleCount()); // 10 (overridden value)
 * count.set(2);
 * console.log(doubleCount()); // 4 (recomputed from source signal)
 * ```
 *
 * The linked signal will subscribe to the source signal and update its value
 * based on the provided computation whenever the source signal changes.
 * If the linked signal is directly set or updated, it will use that value
 * until the next change from the source signal triggers a recomputation.
 *
 * You can use it with `useSignal` hook in React to subscribe to changes and get the current value of the linked signal.
 * ```tsx
 * const count = signal(0);
 * const doubleCount = linkedSignal(() => count() * 2);
 * function DoubleCounter() {
 *   const currentDoubleCount = useSignal(doubleCount);
 *   return <div>{currentDoubleCount}</div>;
 * }
 * ```
 */
export function linkedSignal<K>(src: () => K): LinkedSignal<K>;
export function linkedSignal<K, T>(
  cfg: iLinkedSignalWithComputation<K, T>,
): LinkedSignal<T>;
export function linkedSignal<K, T = K>(arg: LinkedSignalArg<K, T>): LinkedSignal<K, T> {
  let equal = defaultEqual<T>;

  let srcFn: () => K;
  let sources: Set<ReadonlySignal<K>>;
  let computation: (srcVal: K, prev: { source: K; prevValue: T } | undefined) => T;

  if (typeof arg === "function") {
    if (isSignal(arg)) {
      srcFn = () => arg();
      sources = new Set([arg as ReadonlySignal<K>]);
      computation = (srcVal) => srcVal as unknown as T;
    } else {
      srcFn = () => arg();
      sources = SignalContext.scan(arg);
      computation = () => arg() as unknown as T;
    }
  } else {
    srcFn = arg.source;
    computation = arg.computation;
    sources = new Set([arg.source]);
    equal = arg.equal ?? defaultEqual;
  }

  const _state: iLinkedSignalState<T> = {
    value: computation(srcFn(), undefined),
    listeners: new Set(),
    cleanups: new Set(),
    deps: sources,
  };

  const signalRef = (() => {
    if (SignalContext.isContextOpen) SignalContext.register(signalRef);
    if (_state.listeners.size === 0) {
      const sourceVal = srcFn();
      const next = computation(sourceVal, {
        source: sourceVal,
        prevValue: _state.value,
      });
      _state.value = next;
    }

    return _state.value;
  }) as LinkedSignal<K, T> & iSignalStateSymb<T>;

  const passUpdate = () => {
    if (_state.listeners.size === 0) return;

    const sourceVal = srcFn();
    const next = computation(sourceVal, {
      source: sourceVal,
      prevValue: _state.value,
    });

    if (equal(_state.value, next)) return;

    _state.value = next;
    for (const l of _state.listeners) l(_state.value);
  };

  Object.defineProperty(signalRef, SIGNAL_SYMBOL, { value: _state });

  Object.defineProperty(signalRef, "set", {
    value: (value: T) => {
      const prev = _state.value;
      if (equal(prev, value)) return;

      _state.value = value;
      for (const l of _state.listeners) l(value);
    },
  });

  Object.defineProperty(signalRef, "update", {
    value: (fn: (prev: T) => T) => {
      const prev = _state.value;
      const next = fn(prev);
      signalRef.set(next);
    },
  });

  Object.defineProperty(signalRef, "subscribe", {
    value: (listener: (val: T) => void) => {
      if (_state.listeners.size === 0) {
        for (const caller of _state.deps) {
          const cleanupFn = caller.subscribe(passUpdate);
          _state.cleanups.add(cleanupFn);
        }

        const sourceVal = srcFn();
        const next = computation(sourceVal, {
          source: sourceVal,
          prevValue: _state.value,
        });

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
