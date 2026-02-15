import type { ReadonlySignal } from "./types";

/**
 * @internal
 * A context for tracking signal dependencies during computations.
 * This is used internally to determine which signals a computed value depends on.
 * When a computed signal is evaluated, it opens a context that tracks any signals accessed during the computation.
 * This allows the system to automatically subscribe to those signals and update the computed value when any of them change.
 */
export abstract class SignalContext {
  private static readonly _contextStack: Set<ReadonlySignal<any>>[] = [];

  /** Whether there is an active context for tracking signal dependencies. */
  public static get isContextOpen() {
    return SignalContext._contextStack.length > 0;
  }

  /**
   * Scans the provided computation function for signal dependencies.
   * It creates a new context, executes the computation, and collects any signals accessed during the computation.
   */
  public static scan<T>(computation: () => T): Set<ReadonlySignal<any>> {
    const context = new Set<ReadonlySignal<any>>();
    SignalContext._contextStack.push(context);

    try {
      computation();
    } catch {
      // No-op
    } finally {
      SignalContext._contextStack.pop();
    }

    return context;
  }

  /**
   * Registers a signal reference in the current context. This is called when a signal is accessed during a computation.
   * If there is an active context, the signal reference is added to the current context's set of dependencies.
   * This allows the system to track which signals a computed value depends on and update it accordingly when those signals change.
   * @param signalRef - The signal reference being accessed.
   */
  public static register<T>(signalRef: ReadonlySignal<T>) {
    const length = SignalContext._contextStack.length;
    const currentContext = SignalContext._contextStack[length - 1];
    if (currentContext) currentContext.add(signalRef);
  }
}
