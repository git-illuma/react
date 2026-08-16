import type { NodeContainer } from "@illuma/core";

/** Lets pending microtasks settle. */
export const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/** Whether this run can drive collection. Needs `NODE_OPTIONS=--expose-gc`. */
export const gc = (globalThis as { gc?: () => void }).gc;

/**
 * Collects, then yields long enough for the FinalizationRegistry callbacks to
 * run — they are scheduled on a separate task after a collection.
 *
 * A scope's container is destroyed when the scope itself is collected, so a
 * test that wants to observe teardown has to get there.
 */
export async function collect(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    gc?.();
    await flush();
  }
}

/**
 * How many children a container still holds a destroy hook for. Reaches into
 * core's internals on purpose: this is the number the weak parent link exists
 * to keep from growing, and nothing public reports it.
 */
export function childHookCount(container: NodeContainer): number {
  return (container as any)._lifecycle._destroyChildCallbacks.size;
}
