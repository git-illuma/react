export const SIGNAL_SYMBOL = Symbol("illuma-state-signal");

/**
 * Defines an equality function for signals.
 */
export interface iSignalOptions<T> {
  /**
   * Equality function compares the current and next values of a signal to determine if they are considered equal.
   * When equal, the signal will not notify its listeners of a change, even if the value has been updated.
   * This is useful for optimizing performance by preventing unnecessary updates when the value has not meaningfully changed.
   */
  equal?: (prev: T, next: T) => boolean;
}

/**
 * @internal
 * Provides access to current signal state.
 */
export interface iSignalStateSymb<T> {
  readonly [SIGNAL_SYMBOL]: iReadonlySignalState<T>;
}

// Readonly signal
/**
 * A signal that can be read but not directly modified.
 */
export type ReadonlySignal<T> = (() => T) & {
  /**
   * Allows listeners to subscribe to changes in the signal's value. Returns an unsubscribe function.
   */
  readonly subscribe: (listener: (val: T) => void) => () => void;
};

/**
 * @internal
 * Represents the internal state of a readonly signal, including its current value and listeners.
 */
export interface iReadonlySignalState<T> {
  value: T;
  readonly listeners: Set<(val: T) => void>;
}

/**
 * A signal that can be both read and modified.
 * It extends the ReadonlySignal with additional methods for updating its value.
 */
export type WritableSignal<T> = ReadonlySignal<T> & {
  /**
   * Sets the signal's value to the provided value.
   * New value will be compared with the current using the equality function,
   * and if they are not equal, listeners will be notified of the change.
   */
  readonly set: (val: T) => void;

  /**
   * Updates the signal's value based on a function that receives the current value and returns the new value.
   * This is useful for updating the signal based on its previous state without needing to read it separately.
   * Will also use the equality function to determine if the new value is different from the current value before notifying listeners.
   */
  readonly update: (fn: (prev: T) => T) => void;
};

/**
 * @internal
 * Represents the internal state of a computed signal,
 * which includes its current value, listeners, dependencies,
 * and cleanup functions.
 */
export interface iComputedSignalState<T> extends iReadonlySignalState<T> {
  readonly deps: Set<ReadonlySignal<unknown>>;
  readonly cleanups: Set<() => void>;
}

/**
 * A signal that derives its value from other signals based on `computation` and can also be updated directly.
 * When the value is set directly, it will be challenged against an equality function
 * to determine if the update should trigger listeners.
 */
export type LinkedSignal<K, T = K> = WritableSignal<T>;

/** @internal */
export type LinkedSignalArg<K, T> = iLinkedSignalWithComputation<K, T> | (() => K);

/**
 * Explicit configuration for creating a linked signal with a custom computation function.
 * This allows you to specify a source signal, a computation function that derives the linked signal's value from the source signal,
 * and an optional equality function to control when updates should trigger.
 */
export interface iLinkedSignalWithComputation<K, T> {
  /** Any signal to derive the value from */
  readonly source: ReadonlySignal<K>;
  /** Function to compute the linked signal's value based on the source signal's value and previous state */
  readonly computation: (srcVal: K, prev: { source: K; prevValue: T } | undefined) => T;
  /** Optional equality function to determine if the linked signal's value has changed */
  readonly equal?: (prev: T, next: T) => boolean;
}

/**
 * @internal
 * Represents the internal state of a linked signal, which extends the computed signal state.
 * It includes the current value, listeners, dependencies, and cleanup functions.
 */
export interface iLinkedSignalState<T> extends iComputedSignalState<T> {}
