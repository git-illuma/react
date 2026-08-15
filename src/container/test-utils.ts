import type { NodeContainer } from "@illuma/core";

/** Lets pending microtasks — notably a scope's deferred release — settle. */
export const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * How many children a container still holds a destroy hook for. Reaches into
 * core's internals on purpose: this is the number the weak parent link exists
 * to keep from growing, and nothing public reports it.
 */
export function childHookCount(container: NodeContainer): number {
  return (container as any)._lifecycle._destroyChildCallbacks.size;
}
